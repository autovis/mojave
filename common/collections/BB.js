Collection([

    SetDefaultVars({
        // trade params
        default_stop: 5,  // default stop loss order distance (in pips)
        default_limit: 10, // default take-profit target order distance (in pips)

        initial_stop:       6.0,
        stop_gap:           0.5,
        near_stop_dist:     4.5,
        initial_limit:      10.0,
        // climate thresholds
        cndl_size_thres:    5.0,
        min_chan_thres:     3.0, // in ATRs
        percb_thres:        0.7
    }),

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    // define m1 timeframe
    Timestep("m1", {

        m1: {
            input:      Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            dual:       Ind(["<-tick", "m1.input"], "tf:Tick2DualCandle"),
            askbid:     Ind("m1.dual", "stream:DualCandle2AskBidCandles"),
            mid:        Ind("m1.dual", "stream:DualCandle2Midpoint"),

            atr:        Ind("m1.mid", "ATR", 9),

            zz: {
                one:    Ind("m1.mid,m1.atr", "ZigZag", 4, 2),
                two:    Ind("m1.mid,m1.atr", "ZigZag", 20, 10)
                //three:  Ind("m1.mid,m1.atr", "ZigZag", 42, 15)
            }

        },

        trades:     Ind(["m1.dual",
                        Ind([
                            "entry",
                            "stop"
                        ], "cmd:Union")
                    ], "evt:BasicSim"),

        trigger:    Ind("m1.dual", "dir:Null"),

        entry:      Ind([
                        "m1.dual",
                        Ind("m1.dual", "bool:True"),  // always allow trading
                        "trigger",
                        "trades"
                    ], "cmd:EntrySingle", {
                        label: "T",
                        stop: Var("default_stop"),
                        limit: Var("default_limit")
                    }),

        // Use piece-wise dynamic stop strategy
        stop:       Ind([
                        "m1.dual",                     // price
                        Source("trades", Item())    // trade events
                    ], "cmd:StopLoss2", `(function() {
                            return 5;
                        })()`, {
                    }),


        trade_evts: "trades"
    }),

    Timestep("m5", {

        m5: {
            input:      Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            dual:       Ind(["<-m1.dual", "m5.input"], "tf:DualCandle2DualCandle"),
            askbid:     Ind("m5.dual", "stream:DualCandle2AskBidCandles"),
            mid:        Ind("m5.dual", "stream:DualCandle2Midpoint"),
            mid_trim:   Ind("m5.mid", "stream:TrimTails"),

            atr:        Ind("m5.mid", "ATR", 9),

            zz: {
                one:  Ind("m5.mid", "ZigZag", 6, 5),
                two:  Ind("m5.mid", "ZigZag", 24, 10),
                three:  Ind("m5.mid", "ZigZag", 72, 20)
            },

            polys:      Ind([
                            //"m5.zz.three",
                            "m5.zz.two",
                            "m5.zz.one"
                        ], "mark:HighLowPolyReg", {
                            gen_back: 1,
                            peak_weights: {
                                //3: 20,
                                2: 5,
                                1: 0.01
                            }
                        }),

            trending:   Ind("m5.mid,m5.polys", "cx:Trending")
        },

        fsm1:       Ind(Ind("m5.mid.close,bb", "fn:Calc", `$1 > $2.upper || $1 < $2.lower ? 1 : 0`), "EMA", 5), // 1 - is outside bb1
        fsm2:       Ind("m5.mid.close,bb.mean", "dir:RelativeTo"),  // 2 - dir

        trend_fsm:  Ind([
                        "fsm1",
                        "fsm2"
                    ], "_:FiniteStateMachine", {
                        initial: { // 0 - initial state
                            enter: ["reset"],
                            exit: [],
                            transitions: {
                                cross_bb1: [`$1`]
                            }
                        },
                        cross_bb1: { // 1 - prices have crossed up and close above upper BB1
                            enter: [
                                ["setvar", "dir", `$2`]
                            ],
                            transitions: {
                                initial: [`!$1`]
                            }
                        },
                        pullback: { // 2 - prices pull back, recross and close below upper BB1
                            transitions: {

                            }
                        },
                        bounce: { // 3 - prices bounce off AL or a support line
                            transitions: {

                            }
                        },
                        entry: { // 4 - entry candle stays within BB1 and STO3 hooks up
                            transitions: {

                            },
                            options: {eval_on: "update"}
                        }

                    }, {eval_on: "update"}),

        /*
        setup_fsm2: FiniteStateMachine([
                        EvalOn("close"),
                        State("initial", [
                            OnEnter(Reset()),
                            Transition("cross_al",  Ind([
                                                        Ind("m5.mid.close,bb.mean", "dir:Crosses")
                                                    ], "bool:NotFlat"))
                        ]),
                        State("cross_al", [
                            OnEnter(SetVar("dir", Ind("m5.mid.close,bb.mean", "dir:RelativeTo")),
                            OnEnter(SetVar("start_bar", `idx`)),
                            Transition("initial",   Ind()),
                            Transition("potential_break", Ind("something"))
                        ]),
                        State("cross_bb1", [

                        ]),
                        State("pullback", [

                        ]),
                        State("bounce", [

                        ]),
                        State("entry", [
                            EvalOn("update")
                        ])
                    ]),
        */

        // traditional indicators -------------------------------------------------------

        // moving avgs
        //sdl_slow:   Ind("mid.close", "SDL", 100),
        //ema12:      Ind("mid.close", "EMA", 12),

        // RSI / StochRSI
        rsi_fast:   Ind("m5.mid.close", "RSI", 2),
        srsi_fast:  Ind("m5.mid.close", "StochRSI", 3, 3, 2, 2),
        srsi_med:   Ind("m5.mid.close", "StochRSI", 8, 8, 5, 2),
        //srsi_slow:  Ind("mid.close", "StochRSI", 14, 14, 5, 3),

        // OBV
        obv:        Ind("m5.mid", "OBV"),
        obv_ema:    Ind("obv", "EMA", 13),

        // Bollinger / %B / Donchian channel
        bb:         Ind("m5.mid.close", "Bollinger", 13, 1),

        percb:      Ind("m5.mid.close,bb.upper,bb.lower", "PercB"),
        percb_sdl8: Ind("percb", "SDL", 8),

        //dnc:        Ind("mid", "Donchian", 14),

        // derivative indicators -------------------------------------------------------
        //ema12_dely: Ind("ema12", "_:BarsAgo", 3),

        /////////////////////////////////////////////////////////////////////////////////
        // Strategy

        // base climate for all trades
        base_clim:    Ind("m5.mid", "bool:Climate", 10, {
            hours: [3, 10]      // trading hours start/end
            //atr: [2, 13]      // ATR between given range in pips
            //volume: 0         // min volume
        }),

        // width of BB
        chan_width_clim:    Ind("bb,m5.atr", "bool:Calc", "$1.upper - $1.lower >= ${min_chan_thres} * $2"),

        climate:    Ind("m5.dual", "bool:True")

    }),

    Timestep("m30", {
        m30:        Ind("<-m5.mid", "tf:Candle2Candle")
    }),

    Timestep("D1", {
        d1:         Ind("<-m30", "tf:Candle2Candle"),
        dpivot:     Ind("d1", "pivot:Standard")
    })

])
