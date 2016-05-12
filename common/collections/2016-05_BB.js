Collection([

    SetDefaultVars({
        // trade params
        initial_stop:       10.0,
        initial_limit:      15.0,
        // climate thresholds
        cndl_size_thres:    5.0,
        min_chan_thres:     12.0,
        percb_thres:        0.7
    }),

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    Timestep(Var("ltf"), {

        // price data sources
        ltf_dcdl:   Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        dual:       Ind(["tick", "ltf_dcdl"], "tf:Tick2DualCandle"),
        askbid:     Ind("dual", "stream:DualCandle2AskBidCandles"),
        src_bar:    Ind("dual", "stream:DualCandle2Midpoint"),
        src:        "src_bar.close",

        // traditional indicators -------------------------------------------------------
        atr:        Ind("src_bar", "ATR", 9),

        // moving avgs
        //sdl_slow:   Ind("src", "SDL", 100),
        //ema12:      Ind("src", "EMA", 12),

        // RSI / StochRSI
        rsi_fast:   Ind("src", "RSI", 2),
        srsi_fast:  Ind("src", "StochRSI", 3, 3, 2, 2),
        srsi_med:   Ind("src", "StochRSI", 8, 8, 5, 3),
        srsi_slow:  Ind("src", "StochRSI", 14, 14, 5, 3),

        // MACD
        ema26:      Ind("src", "EMA", 26),
        macd12:     Ind([
                        Ind("src", "EMA", 12),
                        "ema26"
                    ], "fn:Diff"),
        macd12_tl:  Ind("macd12", "EMA", 9),

        // Bollinger / %B / Donchian channel
        bb:         Ind("src", "Bollinger", 14, 2),

        percb:      Ind("src,bb.upper,bb.lower", "PercB"),
        percb_sdl8: Ind("percb", "SDL", 8),

        //dnc:        Ind("src_bar", "Donchian", 14),

        // derivative indicators -------------------------------------------------------
        //ema12_dely: Ind("ema12", "_:BarsAgo", 3),

        /////////////////////////////////////////////////////////////////////////////////
        // Strategy

        // base climate for all trades
        base_clim:    Ind("src_bar", "bool:Climate", 10, {
            hours: [3, 10]      // trading hours start/end
            //atr: [2, 13]      // ATR between given range in pips
            //volume: 0         // min volume
        }),

        cndl_len:   Ind("src_bar", "fn:Calc", "abs($1.close - $1.open) / unitsize"),
        cndl_clim:  Ind("cndl_len", "bool:Calc", "$1 <= thres", {thres: Var("cndl_size_thres")}),

        // width of BB
        chan_width:         Ind("bb", "fn:Calc", "abs($1.upper - $1.lower) / unitsize"),
        chan_width_clim:    Ind("chan_width", "bool:Calc", "$1 >= thres", {thres: Var("min_chan_thres")}),

        climate:    Ind([
                        "base_clim",
                        "cndl_clim",
                        "chan_width_clim"
                    ], "bool:And"),

        // ---------------------------------
        // Exit Strategy
        // ---------------------------------

        // Use piece-wise dynamic stop strategy
        stop:       MapTo(["trend", "swing", "main"],
                        Ind([
                            "dual",                     // price
                            Source("trades", Item())    // trade events
                            //"last_swing"
                        ], "cmd:StopLoss", {
                            //step: 1.0,
                            pos: CondSeq(-5.3, [
                                ["dur > 2", -2.3],
                                ["dur > 4", -0.3],
                                ["dur <= 1", Reset()]
                            ])
                        })),

        //movetobe:   Ind("dual,trade_evts", "cmd:MoveToBE", 6.0),

        // ---------------------------------
        // Shared strategy indicators
        // ---------------------------------

        storsi_trig:    Ind([
                            Ind("srsi_fast", "dir:HooksFrom", [20, 80]),
                            Ind([
                                Ind(Ind("srsi_fast", "dir:Threshold", [70, 30]), "dir:Flip"),
                                Ind("rsi_fast", "dir:HooksFrom", [50])
                            ], "dir:And")
                        ], "dir:Or"),

        macd_chk:       Ind("macd12,macd12_tl", "dir:RelativeTo"),

        // ##############################################################################
        // ##############################################################################
        // Trend/Correction/Reversal Entry Strategies

        // retracement to BB-AL: price within [35%, 65%] range of %B
        trend_pullback:         Ind([
                                    "percb",
                                    Ind("percb", "_:BarsAgo", 1),
                                    Ind("percb", "SDL", 4)
                                ], "bool:Calc", "($1 >= 0.3 && $1 <= 0.7) || ($2 >= 0.3 && $2 <= 0.7) || ($3 >= 0.3 && $3 <= 0.7)"),


        trend_climate_base:     Ind([
                                    "climate",
                                    "trend_pullback"
                                ], "bool:And"),

        trend_climate:          "trend_climate_base",

        trend_dir:              Ind("percb", "dir:Calc", "$1 > ${percb_thres} ? 1 : ($1 < -${percb_thres} ? -1 : 0)"),

        // ---------------------------------
        // T :: Trend
        // ---------------------------------

        trend: {

            base:   Ind([
                        Ind("src,bb.mean", "dir:RelativeTo"),
                        "trend_dir",
                        "macd_chk",
                        "storsi_trig"
                    ], "dir:And"),

                        // SKIP IF: clear divergence (on OBV) OR
                        //          deep hook OR
                        //          scalloped top

            entry:  Ind([
                        "dual",
                        "trend_climate",
                        "trend.base",
                        "trades.trend"
                    ], "cmd:EntrySingle", {stop: Var("initial_stop"), limit: Var("initial_limit"), label: "T"}),

            exit:   "stop.trend"
        },

        // ##############################################################################
        // ##############################################################################
        // Swing Strategies

        swing_climate_base:     Ind([
                                    "climate",
                                    Ind("percb", "bool:Calc", "$1 >= -${percb_thres} && $1 <= ${percb_thres}")
                                ], "bool:And"),

        swing_climate:          "swing_climate_base",

        // Slow StochRSI is: (rising and < 50) OR (falling and > 50)
        /*
        srsi_slow_rev:  Ind([
                            Ind("srsi_slow", "dir:Direction"),
                            Ind(Ind("srsi_slow", "dir:Threshold", 50), "dir:Flip")
                        ], "dir:And"),
        */

        // ---------------------------------
        // S :: Swing entry with no trend
        // ---------------------------------

        swing: {

            base:   Ind([
                        Ind([
                            Ind("srsi_slow", "dir:ThresholdFlip", [80, 20]),
                            Ind(Ind("srsi_slow", "dir:Threshold", [50]), "_:BarsAgo", 6)
                        ], "dir:And"),
                        "storsi_trig"
                    ], "dir:And"),

            entry:  Ind([
                        "dual",
                        "swing_climate",
                        "swing.base",
                        "trades.swing"
                    ], "cmd:EntrySingle", {stop: Var("initial_stop"), limit: Var("initial_limit"), label: "S"}),

            exit:   "stop.swing"
        },

        // ==================================================================================
        // REDUCE STRATEGIES

        main:  {

            entry:  Ind([
                        "trend.entry",
                        "swing.entry"
                    ], "cmd:Union"),

            exit:   "stop.main"
        },

        // ==================================================================================
        // TRADE SIMULATION

        trades:     MapTo(["trend", "swing", "main"],
                        Ind(["dual",
                            Ind([
                                Source(Item(), "entry"),
                                Source(Item(), "exit")
                            ], "cmd:Union")
                        ], "evt:BasicSim")),

        trade_evts: "trades.main"

        // ==================================================================================
        // TRADE EXECUTION

        //trade_evts: Ind(["dual", "all_cmds"], "evt:Broker")

    }),

    Timestep("m30", {
        m30:        Ind("src_bar", "tf:Candle2Candle")
    }),

    Timestep("D1", {
        d1:         Ind("src_bar", "tf:Candle2Candle"),
        dpivot:     Ind("d1", "pivot:Standard")
    })

])
