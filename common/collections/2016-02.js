Collection([

    // Defines a set of variables and assigns them a default value
    /*
    Vars({
        source: "oanda", // csv:oanda_eurusd_2015-10-25_0650
        ltf: "m5",
        htf: "H1"
    }),
    */

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
        src:        "src_bar.close",
        src_bar:    "pri.ask",
        m5:         Ind("src_bar", "tf:Candle2Candle"),

        // common/base indicators -------------------------------------------------------
        atr:        Ind("src_bar", "ATR", 9),

        sdl_slow:   Ind("src", "SDL", 65),
        rsi_fast:   Ind("src", "RSI", 2),
        srsi_fast:  Ind("src", "StochRSI", 3, 3, 3, 2),

        obv:        Ind("m5", "OBV"),
        obv_ema13:  Ind("obv", "EMA", 13),
        obv_sdl13:  Ind("obv", "SDL", 13),

        // MACD
        ema26:      Ind("src", "EMA", 26),
        macd12:     Ind([
                        Ind("src", "EMA", 12),
                        "ema26"
                    ], "fn:Diff"),
        macd6:      Ind([
                        Ind("src", "EMA", 6),
                        "ema26"
                    ], "fn:Diff"),
        macd12_sdl: Ind("macd12", "SDL", 13),
        macd12_tl:  "macd12_sdl",

        // BB
        bb:         Ind("src", "Bollinger", 20, 2),

        bbm_sdl10:  Ind("bb.mean", "SDL", 10),

        /////////////////////////////////////////////////////////////////////////////////
        // Strategy

        // Climate outputs a boolean that dictates whether the current condition are favorable for trading in general,
        // regardless of which direction you enter.
        climate:    Ind("src_bar", "bool:Climate", 10, { // period=10
            // The following conditions must all be true
            hours: [3, 11],  // Trading hours: between 3am and 11am
            atr: [2, 13]     // ATR is between 2 and 13 pips
            //volume: 0        // Mimimum volume [Needs fix to compensate ]
        }),

        // ---------------------------------

        trend_dir:  Ind([
                        Ind("bbm_sdl10", "dir:Direction"), // SDL 10 on BB-AL is green
                        Ind([
                            Ind("obv_ema", "dir:Direction"),
                            Ind("obv_ema,obv_sdl", "dir:Crosses")
                        ], "dir:Or"), // OBV EMA Green or crossed up
                        Ind([
                            Ind("macd12_tl", "dir:Direction"),
                            Ind("macd12,macd12_tl", "dir:Crosses")
                        ], "dir:Or"), // MACD TL green or crossed up
                        Ind("macd12", "dir:Direction"), // MACD 12 green
                        Ind("macd6", "dir:Direction") // MACD 6 green
                    ], "dir:ConcordDir"), // All above are green

        trend_str:  Ind(null, "bool:Tautology"), // "Trend strength"
        trend_exe:  Ind([
                        Ind("obv,obv_sdl13", "dir:Difference"), // OBV > SDL 13 [No clear divergence nor deep hook]
                        Ind([
                            "trnd_str", // if trend is strong ...
                            Ind("srsi_fast", "dir:HooksFrom", [50]), // then
                            Ind("srsi_fast", "dir:HooksFrom", [20, 80]) // else
                        ], "logic:IfThenElse") // STO 3 < 20 (or STO 3 < 50 if trend is strong)
                    ], "dir:ConcordDir"),

        // ---------------------------------

        /*
        corr_dir:   Ind([
                        Ind("bbm_sdl10", "dir:Direction"), // SDL 10 on BB-AL is green
                        Ind("macd12_tl", "dir:Direction") // MACD TL green
                    ], "dir:ConcordDir"),

        corr_exe:   Ind([
                        Ind(),
                    ], "dir:ConcordDir"),
        */

        // - MACDs may have turned red

        // ---------------------------------

        rev_dir:    Ind(),

        rev_exe:    Ind(),

        // ---------------------------------

        swing_dir:  Ind(),

        swing_exe:  Ind(),

        /// ---

        //  Direction:
        obv_ema_diff: Ind("obv,obv_trig", "dir:Difference"),
        trend:      Ind([
                        Ind("sdl_slow", "dir:Direction"),
                        "obv_ema_diff"
                    ], "dir:And"),

        //  Execution (Entry):
        rsi_fast_hook:          Ind("rsi_fast",                 "dir:HooksFrom", [50]),
        srsi_fast_thres:        Ind(Ind("srsi_fast.K", "dir:Threshold", [80, 20]), "dir:Flip"),
        // trend_hook = (trend AND rsi_fast_hook AND srsi_fast_thres)
        trend_hook:             Ind("trend,rsi_fast_hook,srsi_fast_thres",  "dir:And"),
        exec:                   Ind("trend_hook",               "dir:And"),

        // ----------------------------------------------------------------------------------

        // Qualifiers
        //"kvo_t_sl":               ["kvo.T",                           "fn:Slope"],
        //"obv_t_sl":               ["obv_t",                           "fn:Slope"],
        //"obvkvo_conf":            ["kvo_t_sl,obv_t_sl",               "fn:Expr", ["kvo", "obv"],
        //                                                              "(kvo + obv) / 2"],
        // ==================================================================================
        // Strategy
        strat:                  Ind("dual,climate,trend,exec,sim",      "tr:TrendExec", {
                                                                            stop: 6.0,   // initial stop loss
                                                                            limit: 10.0, // initial limit
                                                                            gap: 0.5     // space to leave between order placement and "close" price
                                                                        }),
        tstop:                  Ind("dual,sim",                         "tr:TrailingStop", {
                                                                            distance: 2.0,
                                                                            step: 0.5,
                                                                            use_close: true, // "true" to calculate from "close" price, otherwise use high/low
                                                                            start_bar: 2     // wait "start_bar" number of bars before activating trailing stop
                                                                        }),
        movetobe:               Ind("dual,sim",                         "tr:MoveToBE", 6.0),

        cmds:                   Ind("strat,tstop,movetobe",             "tr:TradeCmdsMrg"),

        // Trade Simulation
        sim:                    Ind("dual,cmds",                        "tr:BasicSim"),

        // ==================================================================================
        // exports:

        trade_events:           "sim"  // "trade_events" indicator looked for by backtester

    }),

    Timestep("m30", {
        m30:                    Ind("src_bar",                          "tf:Candle2Candle")
    }),

    Timestep(Var("htf"), {
        htf_dcdl:               Input("dual_candle_bar", {interpreter: "stream:DualCandle"})
    }),

    Timestep("D1", {
        d1:                     Ind("src_bar",                          "tf:Candle2Candle"),
        dpivot:                 Ind("d1",                               "pivot:Standard")
    })

])
