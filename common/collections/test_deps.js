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

        a:  Input("tick"),

        c:  Ind("a,d", "_:Calc", "0"),
        d:  Ind("a", "_:Calc", "0"),
        e:  Ind("c", "_:Calc", "0"),
        f:  Ind("d,e", "_:Calc", "0"),

        g:  Ind("h", "_:Calc", "0"),
        h:  Ind("f,i,j", "_:Calc", "0"),
        i:  Ind("j", "_:Calc", "0"),
        j:  Ind("f", "_:Calc", "0")

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

    })
])
