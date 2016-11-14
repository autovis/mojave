Collection([

    SetDefaultVars({

        stop_atr_dist:      2.0,

        default_stop:       5.0,
        default_limit:      10.0,
        target_atr_dist:    2.5
    }),

    Timestep("D1", {
        D1: {
            dual:   Ind("<-m30.dual", "tf:DualCandle2DualCandle"),
            mid:    Ind("D1.dual", "stream:DualCandle2Midpoint"),
            pivots: Ind("D1.mid", "pivot:Standard")
        }
    }),

    Timestep("m30", {
        m30: {
            input:  Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            dual:   Ind("<-m5.dual,m30.input", "tf:DualCandle2DualCandle"),
            askbid: Ind("m30.dual", "stream:DualCandle2AskBidCandles"),
            ask:    "m30.askbid.ask",
            bid:    "m30.askbid.bid",
            mid:    Ind("m30.dual", "stream:DualCandle2Midpoint"),

            atr:    Ind("m30.mid", "ATR", 9)
        },

        dpivots:    "<-D1.pivots"
    }),

    Timestep("m5", {
        m5: {
            // sources
            input:      Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            dual:       Ind("<-m1.dual,m5.input", "tf:DualCandle2DualCandle"),
            askbid:     Ind("m5.dual", "stream:DualCandle2AskBidCandles"),
            ask:        "m5.askbid.ask",
            bid:        "m5.askbid.bid",
            mid:        Ind("m5.dual", "stream:DualCandle2Midpoint"),
            mid_trim:   Ind("m5.mid", "stream:TrimTails", 0.33),

            atr:        Ind("m5.mid", "ATR", 9),

            highlow: {
                one:    Ind("m5.mid,m5.atr", "ZigZag", 6, `0.5 * $2 / unit_size`),
                two:    Ind("m5.mid,m5.atr", "ZigZag", 12, `1.0 * $2 / unit_size`),
                three:  Ind("m5.mid,m5.atr", "ZigZag", 36, `3.0 * $2 / unit_size`)
            },

            polys:      Ind([ // polynomial curve fitting to highs/lows
                            "m5.mid",
                            "m5.highlow.three",
                            "m5.highlow.two",
                            "m5.highlow.one"
                        ], "mark:HighLowPolyReg", {
                            gen_back: 1,
                            peak_weights: {
                                3: 20,
                                2: 5,
                                1: 0.01
                            }
                        }),

            trend_bnc:  Ind("m5.mid,m5.polys,m5.atr", "dir:TrendBounce", {})
        },

        // base climate for all trades
        climate:    Ind("m5.mid", "bool:True")
        /*
        climate:    Ind("<-m5.mid", "bool:Climate", 10, {
            hours: [2, 22]      // trading hours start/end
            //atr: [2, 13]      // ATR between given range in pips
            //volume: 0         // min volume
        })
        */

    }),

    Timestep("m1", {

        m1: {

            input:  Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            dual:   Ind("<-tick,m1.input", "tf:Tick2DualCandle"),
            askbid: Ind("m1.dual", "stream:DualCandle2AskBidCandles"),
            ask:    "m1.askbid.ask",
            bid:    "m1.askbid.bid",
            mid:    Ind("m1.dual", "stream:DualCandle2Midpoint"),

            atr:        Ind("m1.mid", "ATR", 9),

            highlow: {
                one:    Ind("m1.mid,<-m5.atr", "ZigZag", 6, `0.5 * $2 / unit_size`),
                two:    Ind("m1.mid,<-m5.atr", "ZigZag", 12, `1.0 * $2 / unit_size`),
                three:  Ind("m1.mid,<-m5.atr", "ZigZag", 36, `3.0 * $2 / unit_size`)
            },

            polys:      Ind([ // polynomial curve fitting to highs/lows
                            "m1.mid",
                            //"m1.highlow.four",
                            "m1.highlow.three",
                            "m1.highlow.two",
                            "m1.highlow.one"
                        ], "mark:HighLowPolyReg", {
                            //degrees: [1],
                            gen_back: 1,
                            peak_weights: {
                                //4: 20,
                                3: 5,
                                2: 1,
                                1: 0.01
                            }
                        }),

            polychan:   Ind("m1.mid,m1.polys", "cx:PolyTrendChannel", {}),

            //trend_bnc:  Ind("m1.mid,m1.polys,m1.atr", "dir:TrendBounce", {}),
            //m5_trend_bnc:    "<-m5.trend_bnc",

            perc_thres: Ind("m1.polychan", "dir:Calc", `(function() {
                if ($1.dir === 1 && $1.chan_perc >= -0.2 && $1.chan_perc <= 0.2) {
                    return 1;
                } else if ($1.dir === -1 && $1.chan_perc >= -0.2 && $1.chan_perc <= 0.2) {
                    return -1;
                } else {
                    return null;
                }
            })()`),

            trend: {

                base:   Ind([
                            "m1.polychan.dir",
                            "m1.perc_thres"
                        ], "dir:And"),

                entry:  Ind([
                            "m1.dual",
                            "<-climate",
                            "m1.trend.base",
                            "m1.trades",
                            "m1.polychan.target"
                        ], "cmd:EntrySingle", {stop: Var("default_stop"), limit_price: `$5`, label: "T"}),

                stop:   Ind([
                            "m1.dual",     // price
                            "m1.trades",   // trade events
                            "m1.atr"       // $3
                        ], "cmd:StopLoss2", "-${stop_atr_dist} * ($3 / unitsize)", {
                            lock_at: 0
                        })
            },

            /*
            rev: { // Trend Reversal

                base:   Ind([
                            Ind("m1.dual", "dir:Flat")
                        ], "dir:And"),

                entry:  Ind([
                            "m1.dual",
                            "<-climate",
                            "m1.rev.base",
                            "m1.trades"
                        ], "cmd:EntrySingle", {stop: Var("initial_stop"), limit: Var("initial_limit"), label: "R"}),

                stop:   Ind([
                            "m1.dual",
                            "m1.trades"
                        ], "cmd:StopLoss2", `-1`)

            },
            */

            cmds:       Ind([
                            "m1.dual",
                            "m1.trend.entry",
                            "m1.trend.stop"
                        ], "cmd:Union"),

            trades:     Ind(["m1.dual", "m1.cmds"], "evt:BasicSim")

        },

        trade_evts: "m1.trades"

    }),

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    })

])
