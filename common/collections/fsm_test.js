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
                        State("initial", [
                            ResetOnEntry(),
                            TransitionOn("trending", Src("is_trend"))
                        ]),
                        State("trending", [
                            TransitionOn("initial", Ind("is_trend", "bool:Not")),
                            TransitionOn("potential_break", )
                        ]),
                        State("potential_break", [

                        ]),
                        State("confirmed_break", [

                        ])
                    ]),

        fsmtest2:   Ind([
                            "is_trend",
                            Ind("is_trend", "bool:Not")
                        ], "_:FiniteStateMachine", {
                        "initial": {
                            reset_on_entry: true,
                            transition_on: ["trending", `$1`]
                        },
                        "trending": {
                            transition_on: ["initial", `$2`]
                        },
                        "potential_break": {

                        },
                        "confirmed_break": {

                        }
                    })

    })

])
