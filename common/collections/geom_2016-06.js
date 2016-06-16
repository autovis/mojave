Collection([

    SetDefaultVars({
        // trade params
        initial_stop:       6.0,
        stop_gap:           0.5,
        near_stop_dist:     4.5,

        initial_limit:      10.0,
        target_atr_dist:    2.5
    }),

    SetVars({
        count: {
            H1input: 12,
            m5input: 100,
            m1input: 100
        }
    }),

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    Timestep("m1", {
        m1input:    Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        m1dual:     Ind("tick,m1input", "tf:Tick2DualCandle"),
        m1:         Ind("m1dual", "stream:DualCandle2AskBidCandles"),
        m1mid:      Ind("m5dual", "stream:DualCandle2Midpoint")
    }),

    Timestep("m5", {

        // sources
        m5input:    Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        m5dual:     Ind("tick,m5input", "tf:Tick2DualCandle"),
        m5:         Ind("m5dual", "stream:DualCandle2AskBidCandles"),
        m5mid:      Ind("m5dual", "stream:DualCandle2Midpoint"),
        m5mid_trim: Ind("m5mid", "stream:TrimTails", 0.33),

        // common/base indicators -------------------------------------------------------
        atr:        Ind("m5mid", "ATR", 9),

        obv:        Ind("m5mid", "OBV"),
        obv_ema:    Ind("obv", "EMA", 13),

        zz: {
            one:    Ind("m5mid_trim", "ZigZag", 6, 5),
            two:    Ind("m5mid_trim", "ZigZag", 12, 10),
            three:  Ind("m5mid_trim", "ZigZag", 36, 15)
        },

        frac:       Ind("m5mid", "Fractal"),

        trends:     Ind("zz.three,zz.two,zz.one,frac", "mark:Trend", {}),
        bounce:     Ind("m5mid,trends,atr", "dir:TrendBounce", {}),

        /////////////////////////////////////////////////////////////////////////////////
        // Strategy

        // base climate for all trades
        climate:    Ind("m5mid", "bool:Climate", 10, {
            hours: [2, 22]      // trading hours start/end
            //atr: [2, 13]      // ATR between given range in pips
            //volume: 0         // min volume
        }),

        // ---------------------------------
        // Shared strategy indicators
        // ---------------------------------

        // get dipping price for last 3 bars
        recent_dip:     Ind("m5", "_:Calc", `{
                            long:  _.min(_.map([0,1,2], x => $1(x) && $1(x).bid.low)),
                            short: _.max(_.map([0,1,2], x => $1(x) && $1(x).ask.high))
                        }`, {}, [["long", "num"], ["short", "num"]]),

        // test if recent_dip is within <span> pips of close
        near_dip:       Ind("m5mid,recent_dip", "_:Calc", `{
                            long: $1.close - $2.long <= ${near_stop_dist} * unitsize ? 1 : 0,
                            short: $2.short - $1.close <= ${near_stop_dist} * unitsize ? -1 : 0
                        }`, {}, [["long", "direction"], ["short", "direction"]]),

        pullback:       Ind(Ind(Ind(Ind("m5mid.close", "EMA", 5), "_:BarsAgo", 1), "dir:Direction"), "dir:Flip"),

        nsnd:           Ind([
                            Ind("m5mid", "dir:NSND"),
                            "pullback"
                        ], "dir:Calc", `$1 || $2`),

        chop:           Ind(Ind(Ind("obv,obv_ema", "dir:Crosses"), "_:Calc", `!!$1`), "SMA", 5),

        // ---------------------------------
        // Exit Strategy
        // ---------------------------------

        // Use piece-wise dynamic stop strategy
        stop:       MapTo(["geom", "main"],
                        Ind([
                            "m5dual",                     // price
                            Source("trades", Item()),   // trade events
                            "recent_dip",
                            "m5"
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
                        "pullback",
                        "bounce.dir"
                        //"nsnd"
                    ], "dir:And"),

            entry:  Ind([
                        "m5dual",
                        "climate",
                        Ind("geom.base,near_dip", "dir:Calc", `$1 === 1 && $2.long === 1 ? 1 : ($1 === -1 && $2.short === -1 ? -1 : 0)`),
                        "trades.geom",
                        "bounce.target_price"
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

        trades:     MapTo(["geom", "main"],
                        Ind(["m5dual",
                            Ind([
                                Source(Item(), "entry"),
                                Source(Item(), "exit")
                            ], "cmd:Union")
                        ], "evt:BasicSim")),

        trade_evts: "trades.main"

        // ==================================================================================
        // TRADE EXECUTION

        //trade_evts: Ind(["dual", "all_cmds"], "evt:Broker")

    }),

    Timestep("H1", {
        H1input:    Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        H1dual:     Ind("tick,H1input", "tf:Tick2DualCandle"),
        H1:         Ind("H1dual", "stream:DualCandle2AskBidCandles"),
        H1mid:      Ind("H1dual", "stream:DualCandle2Midpoint")
    })

])
