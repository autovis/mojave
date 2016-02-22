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
        src:        "src_bar.close",
        src_bar:    "pri.ask",
        m5:         Ind("src_bar", "tf:Candle2Candle"),

        // common/base indicators -------------------------------------------------------
        atr:        Ind("src_bar", "ATR", 9),

        sdl_slow:   Ind("src", "SDL", 65),
        rsi_fast:   Ind("src", "RSI", 2),
        srsi_fast:  Ind("src", "StochRSI", 3, 3, 3, 2),

        obv:        Ind("m5", "OBV"),
        obv_ema:    Ind("obv", "EMA", 13),
        obv_sdl:    Ind("obv", "SDL", 13),

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

        bbm_sdl:    Ind("bb.mean", "SDL", 10),

        /////////////////////////////////////////////////////////////////////////////////
        // Strategy
        /*

        Questions:
        - Are rules for stop/limit the same for all 6 strategies?  If not, what are the rules for each?


        */
        // Climate outputs a boolean that dictates whether the current condition are favorable for trading in general,
        // regardless of which direction you enter.
        climate:    Ind("src_bar", "bool:Climate", 10, { // period=10
            // The following conditions must all be true
            hours: [3, 11],  // Trading hours: between 3am and 11am
            atr: [2, 13]     // ATR is between 2 and 13 pips
            //volume: 0        // Mimimum volume [Needs fix to compensate ]
        }),


        // ---------------------------------
        // Exit Strategy
        // ---------------------------------

        // Use "trailing stop" and "move to break-even" exit strategies
        tstop:      Ind("dual,trade_evts", "cmd:TrailingStop", {
                        distance: 2.0,
                        step: 0.5,
                        use_close: true, // "true" to calculate from "close" price, otherwise use high/low
                        start_bar: 2     // wait "start_bar" number of bars before activating trailing stop
                    }),

        movetobe:   Ind("dual,trade_evts", "cmd:MoveToBE", 6.0),

        exit_strat: Ind("tstop,movetobe", "cmd:Union"),

        // ---------------------------------
        // A. Trend
        // ---------------------------------

        trend_en:   Ind(["dual,climate",
                        Ind([ // exec : direction
                            Ind("bbm_sdl", "dir:Direction"),              // 1. SDL 10 on BB-AL is green
                            Ind("obv_ema,obv_sdl", "dir:Difference"),   // 2. OBV EMA Green or crossed up
                            Ind("macd12,macd12_tl", "dir:Difference"),      // 3. MACD TL green or crossed up
                            Ind("macd12", "dir:Direction"),                 // 4a. MACD 12 green
                            Ind("macd6", "dir:Direction"),                  // 4b. MACD 6 green
                            Ind("obv,obv_sdl", "dir:Difference"),         // 5. OBV > SDL 13
                            // trigger:
                            Ind([
                                Ind("dual", "bool:True"),                       // if trend is strong
                                Ind("srsi_fast.K", "dir:HooksFrom", [50]),      // then
                                Ind("srsi_fast.K", "dir:HooksFrom", [20, 80])   // else
                            ], "_:IfThenElse") // 6. if (strong trend) then (STO 3 < 50) else (STO 3 < 20)
                        ], "dir:ConcordDir"), // All above are green
                        "trade_evts"
                    ], "cmd:ExecSingle"),

                    // SKIP IF: clear divergence (on OBV) OR
                    //          deep hook OR
                    //          scalloped top

        // ---------------------------------
        // B. Correction
        // ---------------------------------

        corr_en:    Ind(["dual,climate",
                        Ind([
                            Ind("bbm_sdl", "dir:Direction"),      // 1. SDL 10 on BB-AL is green
                            Ind("macd12_tl", "dir:Direction"),      // 2. MACD TL is green
                            Ind("obv,obv_ema", "dir:Crosses"),    // 3. OBV recrosses OBVEMA (+ SDL10 pref)
                                                                    // 4. MACD may be red
                            // trigger:
                            Ind("srsi_fast.K", "dir:HooksFrom", [20, 80])   // 5. STO 3 hooks from 20
                        ], "dir:ConcordDir"),
                        "trade_evts"
                    ], "cmd:ExecSingle"),

                    // - macd12 and macd6 may have turned red

        // ---------------------------------
        // C. Reversal
        // ---------------------------------

        rev_en:     Ind(["dual,climate",
                        Ind([
                            //Ind(), // 1. bbm_sdl10 is flattening, may still be red
                            Ind("obv_ema", "dir:Direction"),      // 2. OBV EMA 13 is green
                            Ind("obv,obv_ema", "dir:Difference"), // 3. OBV > OBV SDL 13
                            Ind("macd12", "dir:Direction"),         // 4a. macd12 is green
                            Ind("macd6", "dir:Direction"),          // 4b. macd12-tl is green
                            // trigger:
                            Ind("srsi_fast.K", "dir:HooksFrom", [20, 80])   // srsi_fast hooks from 20
                        ], "dir:ConcordDir"),
                        "trade_evts"
                    ], "cmd:ExecSingle"),


        // ##############################################################################
        // Swing Entry Strategies

        // ---------------------------------
        // S1. Swing entry with no trend
        // ---------------------------------

        // 1. STO14 enters OS from >50
        // 2. STO3 hooks < 20 or RSI HK if OBV signal strong (RF or divergence)
        // 3. OBV rising from below EMA, crosses up SDL 13 *OR* touches OBV BB and SDL 13 *OR* re-crosses up lower BB with sharp hook

        // ---------------------------------
        // S2. String entry with trend
        // ---------------------------------

        // 1. (STO3 / RSI) Hook < 20
        // 2. STO14 Green
        // 3. OBV SDL green, or clearly crosses up SDL 13 *OR* just touch if a divergence
        // 4. MACD 6 green

        // ---------------------------------
        // S3. Swing entry on four indicators
        // ---------------------------------

        // 1a. STO14 green but <50
        // 1b. OBVSDL green or crossed up
        // 1c. MACD 6 green
        // 1d. MACD 12 green
        // 2. OBVEMA green or clearly crossed up (skip if OBV flat)
        // 3. STO hk < 50

        // (second bar entry) ?

        // ==================================================================================
        // REDUCE STRATEGIES

        all_cmds:   Ind([
                        "trend_en",
                        "corr_en",
                        "exit_strat"
                    ], "cmd:Union"),

        // ==================================================================================
        // TRADE SIMULATION

        trade_evts: Ind(["dual", "all_cmds"], "evt:BasicSim")
    }),

    Timestep("m30", {
        m30:        Ind("src_bar", "tf:Candle2Candle")
    }),

    Timestep(Var("htf"), {
        htf_dcdl:   Input("dual_candle_bar", {interpreter: "stream:DualCandle"})
    }),

    Timestep("D1", {
        d1:         Ind("src_bar", "tf:Candle2Candle"),
        dpivot:     Ind("d1", "pivot:Standard")
    })

])
