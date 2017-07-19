Collection([

    /*
    SetVars({
        "default_stop": 10.0,
        "default_limit": 15.0
    }),
    */

    SetVars({
        input_count: 140
    }),

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    Timestep(Var("ltf"), {

        // sources
        ltf_dcdl:   Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        dual:       Ind(["tick", "ltf_dcdl"], "tf:Tick2DualCandle"),
        askbid:     Ind("dual", "stream:DualCandle2AskBidCandles"),
        src_bar:    Ind("dual", "stream:DualCandle2Midpoint"),
        src:        "src_bar.close",
        m5:         Ind("src_bar", "tf:Candle2Candle"),

        // common/base indicators -------------------------------------------------------
        atr:        Ind("src_bar", "ATR", 9),

        /////////////////////////////////////////////////////////////////////////////////

        ema20:      Ind("src_bar.close", "EMA", 20),
        trending:   Ind(""),

        fsmtest:    FiniteStateMachine([
                        Define("trend", Ind("src_bar.close", "Trending")),
                        EvalOn("close"),
                        State("initial", [
                            OnEnter(Reset()), // clear vars
                            Transition("trending", "trend.dir")
                        ]),
                        State("trending", [
                            Define(),
                            OnEnter(SetVar("dir", Ind("src.close,bb.mean", "dir:RelativeTo"))),
                            OnEnter(SetVar("start_bar", `idx`)),
                            Transition("initial", Ind("is_trend", "bool:Not")),
                            Transition("potential_break", Ind("something"))
                        ]),
                        State("potential_break", [
                            // ...
                        ]),
                        State("confirmed_break", [
                            // ...
                        ]),
                        State("entry", [

                            EvalOn("update")
                        ])
                    ]),

        fsmtest2:   Ind([
                            "is_trend",
                            Ind("is_trend", "bool:Not"),
                            Ind("something"),
                            Ind("src.close,bb.al", "dir:Difference")
                        ], "_:FiniteStateMachine", {
                        initial: {
                            enter: [
                                "reset"
                            ],
                            exit: [],
                            transitions: {
                                trending: [`$1`]
                            },
                            options: {}
                        },
                        trending: {
                            enter: [
                                ["setvar", "dir", `$4`],
                                ["setvar", "start_bar", `idx`]
                            ],
                            exit: [],
                            transitions: {
                                initial: [`$2`],
                                potential_break: [`$3`]
                            }
                        },
                        potential_break: {
                            // ...
                        },
                        confirmed_break: {
                            // ...
                        }
                    ], {eval_on: "close"})

    })

])
