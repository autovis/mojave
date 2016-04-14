Collection([

    /*
    SetVars({
        "default_stop": 10.0,
        "default_limit": 15.0
    }),
    */

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

        sdl_slow:   Ind("src", "SDL", 100),
        rsi_fast:   Ind("src", "RSI", 2),
        srsi_fast:  Ind("src", "StochRSI", 3, 3, 2, 2),
        srsi_med:   Ind("src", "StochRSI", 8, 8, 5, 3),
        srsi_slow:  Ind("src", "StochRSI", 14, 14, 5, 3),

        obv:        Ind("m5", "OBV"),
        obv_ema:    Ind("obv", "EMA", 13),
        obv_sdl:    Ind("obv", "SDL", 13),
        obv_sl:     Ind("obv_sdl", "fn:Slope"),

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
        macd12_tl:  Ind("macd12", "EMA", 9),

        // BB
        bb:         Ind("src", "Bollinger", 14, 2),
        dnc:        Ind("src_bar", "Donchian", 14),

        bbm_sdl:    Ind("bb.mean", "SDL", 10),

        sdl_slow_sl:    Ind("sdl_slow", "fn:Slope"),

        /////////////////////////////////////////////////////////////////////////////////
        // Strategy
        /*

        Questions:

        */
        // Climate outputs a boolean that dictates whether the current condition are favorable for trading in general,
        // regardless of which direction you enter.
        climate:    Ind("src_bar", "bool:Climate", 10, { // period=10
            // The following conditions must all be true
            hours: [3, 10]  // Trading hours: between 3am and 11am
            //atr: [2, 13]     // ATR is between 2 and 13 pips
            //volume: 0      // Mimimum volume [Needs fix to compensate for ]
        }),


        // ---------------------------------
        // Exit Strategy
        // ---------------------------------

        /*

        #### StopLoss:

        nogoback: true // stop can never move in reverse

        piecewise:
        {
            //0: -6,
            2: 4,
            4: 2,
            6: 0  // (break-even)
        }

        Cancel position when OBV recrosses OBVSDL

        */


        // Use "trailing stop" and "move to break-even" exit strategies
        stop:       Ind("dual,trade_evts", "cmd:StopLoss", {
                        dist: 1.0,
                        step: 1.0,
                        use_close: false, // "true" to calculate from "close" price, otherwise use high/low
                        start_bar: 2     // wait "start_bar" number of bars before activating trailing stop
                    }),

        //movetobe:   Ind("dual,trade_evts", "cmd:MoveToBE", 6.0),

        exit_strat: Ind("stop", "cmd:Union"),

        //

        storsi_trig:    Ind([
                            Ind("srsi_fast", "dir:HooksFrom", [20, 80]),
                            Ind([
                                Ind(Ind("srsi_fast", "dir:Threshold", [80, 20]), "dir:Flip"),
                                Ind("rsi_fast", "dir:HooksFrom", [50])
                            ], "dir:And")
                        ], "dir:Or"),

        // ---------------------------------
        // Common strategy indicators
        // ---------------------------------

        trend_climate_base:     Ind([
                                    "climate",
                                    Ind("src_bar", "bool:Timestep", "H1")
                                ], "bool:And"),
        trend_climate:          "climate",

        // ##############################################################################
        // ##############################################################################
        // Trend/Correction/Reversal Entry Strategies

        // ---------------------------------
        // A. Trend
        // ---------------------------------

        trend_base: Ind([
                        Ind("bbm_sdl", "dir:Direction"),
                        Ind("macd12,macd12_tl", "dir:RelativeTo"),
                        Ind("macd12", "dir:Direction"),
                        Ind("macd6", "dir:Direction"),
                        "storsi_trig"
                    ], "dir:And"),

                    // SKIP IF: clear divergence (on OBV) OR
                    //          deep hook OR
                    //          scalloped top

        trend_en:   Ind([
                        "dual",
                        "trend_climate",
                        Ind("trend_base", "dir:And"),
                        "trade_evts"
                    ], "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "T"}),

        // ---------------------------------
        // B. Correction
        // ---------------------------------

        corr_base:  Ind([
                        Ind("bbm_sdl", "dir:Direction"),
                        Ind("macd12_tl", "dir:Direction"),
                        // SVC: price bounces off BB
                        "storsi_trig"
                    ], "dir:And"),

                    // - macd12 and macd6 may have turned red

        corr_en:    Ind("dual,climate,corr_base,trade_evts", "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "T-C"}),

        // ---------------------------------
        // C. Reversal
        // ---------------------------------

        rev_dir:    Ind([
                        //Ind(), // 1. bbm_sdl10 is flattening, may still be red
                        Ind("obv_ema", "dir:Direction"),                // 2. OBV EMA 13 is green
                        Ind("obv,obv_ema", "dir:RelativeTo"),           // 3. OBV > OBV SDL 13
                        Ind("macd12", "dir:Direction"),                 // 4a. macd12 is green
                        Ind("macd6", "dir:Direction"),                  // 4b. macd12-tl is green
                        "storsi_trig"
                    ], "dir:And"),

        rev_en:     Ind("dual,climate,rev_dir,trade_evts", "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "T-R"}),

        // ##############################################################################
        // ##############################################################################
        // Swing Entry Strategies

        swing_climate_base:     Ind([
                                    "climate",
                                    Ind("src_bar", "bool:Timestep", "H1")
                                ], "bool:And"),

        // Slow StochRSI is: (rising and < 50) OR (falling and > 50)
        srsi_slow_rev:  Ind([
                            Ind("srsi_slow", "dir:Direction"),
                            Ind(Ind("srsi_slow", "dir:Threshold", 50), "dir:Flip")
                        ], "dir:And"),

        // ---------------------------------
        // S1. Swing entry with no trend
        // ---------------------------------

        s1_climate:     "climate",

        s1_base:    Ind([

                        // 1. Entry bar bounces off lower BB
                        //Ind(),

                        // 2. STO14 or 80 < 20 from > 50.  First entry *no linger*
                        Ind([
                            // sto 14
                            Ind([
                                Ind("srsi_slow", "dir:ThresholdFlip", [80, 20]),
                                Ind(Ind("srsi_slow", "dir:Threshold", [50]), "_:BarsAgo", 6)
                            ], "dir:And"),
                            // sto 8
                            Ind([
                                Ind("srsi_med", "dir:ThresholdFlip", [80, 20]),
                                Ind(Ind("srsi_med", "dir:Threshold", [50]), "_:BarsAgo", 6)
                            ], "dir:And")

                        ], "dir:Or"),

                        // 3. STO3/RSI2 hook
                        "storsi_trig"

                    ], "dir:And"),

        s1_en:      Ind("dual,s1_climate,s1_base,trade_evts", "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "S1"}),

        // ---------------------------------
        // S2. Swing entry with trend
        // ---------------------------------

        /*
        s2_base:     Ind([
                        "storsi_trig",                      // 1. (STO3 / RSI) Hook < 20
                        Ind("srsi_slow", "dir:Direction"),  // 2. STO14 Green
                        Ind("macd6", "dir:Direction"),      // 4. MACD 6 green
                        Ind([
                            Ind("obv_sdl", "dir:Direction"),    // 3a. OBV SDL green
                            Ind("src", "dir:Direction"),        // 3b. OBV clearly crosses up SDL 13
                            Ind("src", "dir:Direction")         // 3c. OBV just touches SDL 13 if a divergence
                        ], "dir:Or")
                    ], "dir:And"),

        s2_en:      Ind("dual,swing_climate,s2_base,trade_evts", "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "S2"}),
        */

        // ---------------------------------
        // S3. Swing entry on 4 indicators
        // ---------------------------------

        s3_climate: "climate",

        s3_base:    Ind([
                        // 1. STO 14 green and coming from <20 but still <50
                        Ind("srsi_slow", "dir:Direction"),
                        Ind(Ind("srsi_slow", "dir:ThresholdFlip", [80, 20]), "_:Sticky", 6),
                        Ind("srsi_slow", "dir:ThresholdFlip", [50]),

                        // 2. MACD12 and MACD6 and OBV.SDL = green
                        Ind("macd12", "dir:Direction"),
                        Ind("macd6", "dir:Direction"),
                        Ind("obv_sdl", "dir:Direction"),

                        "storsi_trig"

                    ], "dir:And"),

        // (second bar entry) ?

        s3_en:      Ind("dual,s3_climate,s3_base,trade_evts", "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "S3"}),

        // ==================================================================================
        // REDUCE STRATEGIES

        all_cmds:   Ind([
                        "trend_en",
                        "corr_en",
                        "rev_en",
                        "s1_en",
                        //"s2_en",
                        "s3_en",
                        "exit_strat" // trailing stop
                    ], "cmd:Union"),

        // ==================================================================================
        // TRADE SIMULATION

        trade_evts: Ind(["dual", "all_cmds"], "evt:BasicSim")

        // ==================================================================================
        // TRADE EXECUTION

        //trade_evts: Ind(["dual", "all_cmds"], "evt:Broker")

    }),

    Timestep("m30", {
        m30:        Ind("src_bar", "tf:Candle2Candle")
    }),

    Timestep(Var("htf"), {
        //htf_dcdl:   Input("dual_candle_bar", {interpreter: "stream:DualCandle"})
    }),

    Timestep("D1", {
        d1:         Ind("src_bar", "tf:Candle2Candle"),
        dpivot:     Ind("d1", "pivot:Standard")
    })

])