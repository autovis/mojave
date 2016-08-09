Collection([
    Timestep("T", {

        // ------------------------------------------------------------------------------
        // single source

        // B has 2 input w/ cycles
        /*
        a:  Input("tick"),

        b:  Ind("a,c,d", "_:Calc", "0"),
        c:  Ind("e", "_:Calc", "0"),
        d:  Ind("e", "_:Calc", "0"),
        e:  Ind("b", "_:Calc", "0")
        */

        /* B is circular input for 2 indicators
        a:  Input("tick"),

        b:  Ind("a,e", "_:Calc", "0"),
        c:  Ind("b", "_:Calc", "0"),
        d:  Ind("b", "_:Calc", "0"),
        e:  Ind("c,d", "_:Calc", "0"),
        */

        // ------------------------------------------------------------------------------
        // multi source

        a:  Input("tick", {instrument: "eurusd"}),
        b:  Input("tick", {instrument: "gbpusd"}),

        w: {
            x:  Input("dual_candle_bar", {instrument: "gbpusd"}),
            y:  Input("dual_candle_bar", {instrument: "eurusd"}),
            z:  Input("dual_candle_bar", {instrument: "eurusd"})
        },

        c:  Ind("a", "_:Calc", "0"),
        d:  Ind("w.x", "_:Calc", "0"),
        e:  Ind("c", "_:Calc", "0"),
        f:  Ind("e,d", "_:Calc", "0"),

        g:  Ind("f", "_:Calc", "0"),
        h:  Ind("g", "_:Calc", "0"),
        i:  Ind("h", "_:Calc", "0"),
        j:  Ind("i", "_:Calc", "0")

        // ------------------------------------------------------------------------------
        // embedded indicators

        /*
        a:  Input("tick"),

        b:  Ind([
            Ind("a,c", "_:Calc", "0")
        ], "_:Calc", "0"),
        c:  Ind([
            Ind("b", "_:Calc", "0")
        ], "_:Calc", "0")
        */

    }),

    Timestep("m5", {
        s:  Ind("j", "_:Calc", "0")
    })
])
