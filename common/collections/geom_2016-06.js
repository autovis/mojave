Collection([

    SetDefaultVars({
        // trade params
        initial_stop:       6.0,
        stop_gap:           0.5,
        near_stop_dist:     4.5,

        initial_limit:      10.0,
        target_atr_dist:    2.5
    }),

    Timestep("D1", {
        D1: {
            dual:   Ind("H1.dual", "tf:DualCandle2DualCandle"),
            mid:    Ind("D1.dual", "stream:DualCandle2Midpoint"),
            pivots: Ind("D1.mid", "pivot:Standard")
        }
    }),

    Timestep("H1", {
        H1: {
            input:  Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            dual:   Ind("m5.dual,H1.input", "tf:DualCandle2DualCandle"),
            askbid: Ind("H1.dual", "stream:DualCandle2AskBidCandles"),
            ask:    "H1.askbid.ask",
            bid:    "H1.askbid.bid",
            mid:    Ind("H1.dual", "stream:DualCandle2Midpoint"),

            atr:    Ind("H1.mid", "ATR", 9),

            zz: {
                one:    Ind("H1.mid", "ZigZag", 4, 15),
                two:    Ind("H1.mid", "ZigZag", 8, 30),
                three:  Ind("H1.mid", "ZigZag", 32, 60)
            },

            trends:     Ind("H1.zz.three,H1.zz.two,H1.zz.one", "mark:Trend", {})
        },
        dpivots:    "D1.pivots"
    }),

    Timestep("m5", {
        m5: {
            // sources
            input:      Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            dual:       Ind("m1.dual,m5.input", "tf:DualCandle2DualCandle"),
            askbid:     Ind("m5.dual", "stream:DualCandle2AskBidCandles"),
            ask:        "m5.askbid.ask",
            bid:        "m5.askbid.bid",
            mid:        Ind("m5.dual", "stream:DualCandle2Midpoint"),
            mid_trim:   Ind("m5.mid", "stream:TrimTails", 0.33),

            atr:        Ind("m5.mid", "ATR", 9),

            zz: {
                one:    Ind("m5.mid_trim", "ZigZag", 6, 5),
                two:    Ind("m5.mid_trim", "ZigZag", 12, 10),
                three:  Ind("m5.mid_trim", "ZigZag", 36, 15)
            },

            trends:     Ind("m5.zz.three,m5.zz.two,m5.zz.one,frac", "mark:Trend", {
                gen_back: 2,
                peak_weights: {
                    4: 100,
                    3: 20,
                    2: 5,
                    1: 0.01
                }
            }),

            bounce:     Ind("m5.mid,m5.trends,m5.atr", "dir:TrendBounce", {})
        },

        // common/base indicators -------------------------------------------------------

        obv:        Ind("m5.mid", "OBV"),
        obv_ema:    Ind("obv", "EMA", 13),

        frac:       Ind("m5.mid", "Fractal")

    }),

    Timestep("m1", {
        m1: {
            input:  Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            dual:   Ind("tick,m1.input", "tf:Tick2DualCandle"),
            askbid: Ind("m1.dual", "stream:DualCandle2AskBidCandles"),
            ask:    "m1.askbid.ask",
            bid:    "m1.askbid.bid",
            mid:    Ind("m1.dual", "stream:DualCandle2Midpoint"),

            atr:        Ind("m1.mid", "ATR", 9),

            zz: {
                one:    Ind("m1.mid,m1.atr", "ZigZag", 4, 2),
                two:    Ind("m1.mid,m1.atr", "ZigZag", 20, 10)
                //three:  Ind("m1.mid,m1.atr", "ZigZag", 42, 15)
            },

            trends:     Ind("m1.zz.two,m1.zz.one", "mark:Trend", {
                            gen_back: 1,
                            peak_weights: {
                                2: 1,
                                1: 1
                            }
                        }),

            bounce:     Ind("m1.mid,m1.trends,m1.atr", "dir:TrendBounce", {})
        },

        /////////////////////////////////////////////////////////////////////////////////
        // Strategy

        // base climate for all trades
        climate:    Ind("m5.mid", "bool:Climate", 10, {
            hours: [2, 22]      // trading hours start/end
            //atr: [2, 13]      // ATR between given range in pips
            //volume: 0         // min volume
        }),

        // ---------------------------------
        // Shared strategy indicators
        // ---------------------------------


        pullback:       Ind(Ind(Ind(Ind("m1.mid.close", "EMA", 5), "_:BarsAgo", 1), "dir:Direction"), "dir:Flip"),

        nsnd:           Ind([
                            Ind("m1.mid", "dir:vsa_NSND"),
                            "pullback"
                        ], "dir:Calc", `$1 || $2`),

        // get dipping price for last 3 bars
        recent_dip:     Ind("m1.askbid", "_:Calc", `{
                            long:  _.min(_.map([0,1,2], x => $1(x) && $1(x).bid.low)),
                            short: _.max(_.map([0,1,2], x => $1(x) && $1(x).ask.high))
                        }`, {}, [["long", "num"], ["short", "num"]]),

        // test if recent_dip is within <span> pips of close
        near_dip:       Ind("m1.mid,recent_dip", "_:Calc", `{
                            long: $1.close - $2.long <= ${near_stop_dist} * unitsize ? 1 : 0,
                            short: $2.short - $1.close <= ${near_stop_dist} * unitsize ? -1 : 0
                        }`, {}, [["long", "direction"], ["short", "direction"]]),

        // ---------------------------------
        // Exit Strategy
        // ---------------------------------

        // Use piece-wise dynamic stop strategy
        stop:       MapOn(["geom", "main"],
                        Ind([
                            "m1.dual",                  // price
                            Source("trades", Item()),   // trade events
                            "recent_dip",
                            "m1.askbid"
                        ], "cmd:StopLoss2", `(function() {
                                let retval;
                                if (bar <= 2) {
                                    retval = dir > 0 ? $3 && $3.long - (${stop_gap} * unitsize) : $3 && $3.short + (${stop_gap} * unitsize);
                                } else {
                                    retval = dir > 0 ? $4.bid.low - (${stop_gap} * unitsize) : $4.ask.high + (${stop_gap} * unitsize);
                                }
                                return retval;
                            })()`, {
                            mode: "price"
                        })),

        // ##############################################################################
        // ##############################################################################

        // ---------------------------------
        // G :: Geometric
        // ---------------------------------

        geom: {

            base:   Ind([
                        //"pullback",
                        "m1.bounce.dir"
                        //"nsnd"
                    ], "dir:And"),

            entry:  Ind([
                        "m1.dual",
                        "climate",
                        Ind("geom.base,near_dip", "dir:Calc", `$1 === 1 && $2.long === 1 ? 1 : ($1 === -1 && $2.short === -1 ? -1 : 0)`),
                        "trades.geom",
                        "m1.bounce.target_price"
                    ], "cmd:EntrySingle", {stop: Var("initial_stop"), limit_price: `$5`, label: "GT"}),

            exit:   "stop.geom"
        },

        main:  {

            entry:  Ind([
                        "geom.entry"
                    ], "cmd:Union"),

            exit:   "stop.main"
        },

        // ==================================================================================
        // TRADE SIMULATION

        trades:     MapOn(["geom", "main"],
                        Ind(["m1.dual",
                            Ind([
                                Source(Item(), "entry"),
                                Source(Item(), "exit")
                            ], "cmd:Union")
                        ], "evt:BasicSim")),

        trade_evts: "trades.main"

        // ==================================================================================
        // TRADE EXECUTION

        //trade_evts: Ind(["m5.dual", "all_cmds"], "evt:Broker")

    }),

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    })

])
