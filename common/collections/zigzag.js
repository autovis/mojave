Collection([

    SetDefaultVars({
        default_stop:   10.0,
        default_limit:  15.0
    }),

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    Timestep(Var("ltf"), {

        // sources
        ltf_dcdl:   Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        dual:       Ind(["tick", "ltf_dcdl"], "tf:Tick2DualCandle"),
        askbid:     Ind("dual", "stream:DualCandle2AskBidCandles"),
        src:        "src_bar.close",
        src_bar:    Ind("dual", "stream:DualCandle2Midpoint"),
        m5:         Ind("src_bar", "tf:Candle2Candle"),

        // common/base indicators -------------------------------------------------------
        atr:        Ind("src_bar", "ATR", 9),

        climate:    Ind("src_bar", "bool:Climate", 10, { // period=10
            // The following conditions must all be true
            hours: [3, 10]  // Trading hours: between 3am and 11am
            //atr: [2, 13]     // ATR is between 2 and 13 pips
            //volume: 0      // Mimimum volume [Needs fix to compensate for ]
        })

    })

])
