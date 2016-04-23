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

        sdl_slow:   Ind("src", "SDL", 100),
        rsi_fast:   Ind("src", "RSI", 2),
        srsi_fast:  Ind("src", "StochRSI", 3, 3, 2, 2),
        srsi_med:   Ind("src", "StochRSI", 8, 8, 5, 3),
        srsi_slow:  Ind("src", "StochRSI", 14, 14, 5, 3),

        obv:        Ind("m5", "OBV"),
        obv_ema:    Ind("obv", "EMA", 13),
        obv_sdl:    Ind("obv", "SDL", 13),
        obv_sdl_sl: Ind("obv_sdl", "fn:Slope"),

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
        macd12_tl:  Ind("macd12", "EMA", 9),

        // Bollinger + Donchian bands
        bb:         Ind("src", "Bollinger", 14, 2),
        percb:      Ind("src,bb.upper,bb.lower", "PercB"),
        percb_sdl8: Ind("percb", "SDL", 8),
        dnc:        Ind("src_bar", "Donchian", 14),

        // Derivatives
        sdl_slow_sl:    Ind("sdl_slow", "fn:Slope"),

        /////////////////////////////////////////////////////////////////////////////////
        // Strategy

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

        nogoback: true // stop can never move in reverse (default)

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
        exit:       Expand(["trend", "rev", "s1", "s3", "final"],
                        // stop
                        //Ind([
                            Ind(["dual", Source("trades", Item())], "cmd:StopLoss", {
                                dist: 1.0,
                                step: 1.0,
                                mode: "pips",
                                pos: {
                                    0: -5.2,
                                    2: -3.2
                                },
                                use_close: false, // "true" to calculate relative to "close" price, otherwise use high/low
                                start_bar: 2      // wait "start_bar" number of bars before activating trailing stop
                            })),
                        //], "cmd:Union")),

        //movetobe:   Ind("dual,trade_evts", "cmd:MoveToBE", 6.0),

        // ---------------------------------
        // Shared strategy indicators
        // ---------------------------------

        storsi_trig:    Ind([
                            Ind("srsi_fast", "dir:HooksFrom", [20, 80]),
                            Ind([
                                Ind(Ind("srsi_fast", "dir:Threshold", [80, 20]), "dir:Flip"),
                                Ind("rsi_fast", "dir:HooksFrom", [50])
                            ], "dir:And")
                        ], "dir:Or"),

        trend_climate_base:     Ind([
                                    "climate",
                                    Ind("src_bar", "bool:Timestep", "H1")
                                ], "bool:And"),

        trend_climate:          "climate",
        swing_climate:          "climate",

        // ##############################################################################
        // ##############################################################################
        // Trend/Correction/Reversal Entry Strategies

        // ---------------------------------
        // T :: Trend
        // ---------------------------------

        trend: {

            base:   Ind([
                        Ind("src,bb.mean", "dir:RelativeTo"),
                        // train: sdl5 pullback; bb-a bounce
                        Ind([
                            Ind("macd12", "dir:Direction"),
                            Ind("macd12,macd12_tl", "dir:RelativeTo")
                        ], "dir:Or"),
                        "storsi_trig"
                        // train: divergence
                    ], "dir:And"),

                        // SKIP IF: clear divergence (on OBV) OR
                        //          deep hook OR
                        //          scalloped top

            entry:  Ind([
                        "dual",
                        "trend_climate",
                        "trend.base",
                        "trades.trend"
                    ], "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "T"})
        },

        // ---------------------------------
        // T-R :: Reversal
        // ---------------------------------

        rev: {

            base:   Ind([
                        Ind("src,bb.mean", "dir:RelativeTo"),
                        Ind([
                            Ind("macd12", "dir:Direction"),
                            Ind("macd12,macd12_tl", "dir:RelativeTo")
                        ], "dir:Or"),
                        "storsi_trig"
                    ], "dir:And"),

            entry:  Ind([
                        "dual",
                        "trend_climate",
                        "rev.base",
                        "trades.rev"
                    ], "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "T-R"})

        },


        // ##############################################################################
        // ##############################################################################
        // Swing Strategies

        // Slow StochRSI is: (rising and < 50) OR (falling and > 50)
        /*
        srsi_slow_rev:  Ind([
                            Ind("srsi_slow", "dir:Direction"),
                            Ind(Ind("srsi_slow", "dir:Threshold", 50), "dir:Flip")
                        ], "dir:And"),
        */

        // ---------------------------------
        // S1 :: Swing entry with no trend
        // ---------------------------------

        s1: {

            base:   Ind([
                        Ind([
                            Ind("srsi_slow", "dir:ThresholdFlip", [80, 20]),
                            Ind(Ind("srsi_slow", "dir:Threshold", [50]), "_:BarsAgo", 6)
                        ], "dir:And"), // STO 14 <20 and from >50
                        "storsi_trig"
                    ], "dir:And"),

            entry:  Ind([
                        "dual",
                        "swing_climate",
                        "s1.base",
                        "trades.s1"
                    ], "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "S1"})
        },

        // ---------------------------------
        // S3 :: Swing entry on 4 indicators
        // ---------------------------------

        s3: {

            base:  Ind([
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

            entry: Ind([
                        "dual",
                        "swing_climate",
                        "s3.base",
                        "trades.s3"
                    ], "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "S3"})
        },

        // ==================================================================================
        // REDUCE STRATEGIES

        final:  {

            entry:   Ind([
                            "trend.entry",
                            "rev.entry",
                            "s1.entry"
                            //"s3.entry"
                        ], "cmd:Union")

        },

        // ==================================================================================
        // TRADE SIMULATION

        trades:     Expand(["trend", "rev", "s1", "s3", "final"],
                        Ind(["dual",
                            Ind([
                                Source(Item(), "entry"),
                                Source("exit", Item())
                            ], "cmd:Union")
                        ], "evt:BasicSim")),

        trade_evts: "trades.final"

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
