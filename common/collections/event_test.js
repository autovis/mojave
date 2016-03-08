Collection([

    // Defines a set of variables and assigns them a default value
    /*
    Vars({
        source: "oanda", // csv:oanda_eurusd_2015-10-25_0650
        ltf: "m5",
        htf: "H1"
    }),
    */

    //Expand("@source"), // Separate collection per instrument

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    Timestep(Var("ltf"), {

        /////////////////////////////////////////////////////////////////////////////////
        // Setup

        // sources
        ltf_dcdl:   Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        dual:       Ind(["tick", "ltf_dcdl"], "tf:Tick2DualCandle"),
        pri:        Ind("dual", "stream:DualCandle2AskBidCandles"),
        src_bar:    "pri.ask",
        src:        "src_bar.close",

        sdl_fast:   Ind("src", "SDL", 65),
        sdl_slow:   Ind("src", "SDL", 120),

        climate:    Ind("src_bar", "bool:Climate", 10, { // period=10
            // The following conditions must all be true
            hours: [3, 10]  // Trading hours: between 3am and 11am
            //atr: [2, 13]     // ATR is between 2 and 13 pips
            //volume: 0      // Mimimum volume [Needs fix to compensate for ]
        }),

        tstop:      Ind("dual,trade_evts", "cmd:TrailingStop", {
                        distance: 1.0,
                        step: 1.0,
                        use_close: false, // "true" to calculate from "close" price, otherwise use high/low
                        start_bar: 0     // wait "start_bar" number of bars before activating trailing stop
                    }),

        trend_en:   Ind([
                        "dual",
                        "climate",
                        Ind("sdl_fast,sdl_slow", "dir:Crosses"),
                        "trade_evts"
                    ], "cmd:EntrySingle", {stop: 15.0, limit: 10.0, label: "T"}),

        all_cmds:   Ind([
                        "trend_en",
                        "tstop"
                    ], "cmd:Union"),

        trade_evts: Ind(["dual", "all_cmds"], "evt:BasicSim")

    })

])
