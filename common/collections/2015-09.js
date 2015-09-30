define({

    // Input streams
    "tick":                   ["0",                                    "stream:Tick"],
    "m5_dcdl":                ["1",                                    "stream:DualCandle"],
    "d1_dcdl?":               ["2",                                    "stream:DualCandle"],

    //////////////

    "dual":                   [{tf:"m5"}, ["$xs","tick","m5_dcdl"],    "tf:Tick2DualCandle"],
    "pri":                    ["dual",                                 "stream:DualCandle2AskBidCandles"],
    "src_bar":                ["pri.ask"],
    //"m30":                    [{tf:"m30"}, "src_bar",                  "tf:Candle2Candle"],
    "m5":                     [{tf:"m5"}, "src_bar",                   "tf:Candle2Candle"],
    "m30":                    [{tf:"m30"}, "src_bar",                  "tf:Candle2Candle"],
    "h1":                     [{tf:"H1"}, "src_bar",                   "tf:Candle2Candle"],
    "d1":                     [{tf:"D1"}, "src_bar",                   "tf:Candle2Candle"],
    "dpivot":                 ["d1",                                   "pivot:Standard"],
    "src":                    ["src_bar.close"],


    // Traditional indicator definitions
    "atr":                    ["src_bar",                              "ATR", 9],
    "sdl_slow":               ["src",                                  "SDL", 55],
    "sdl_fast":               ["src",                                  "SDL", 34],
    "rsi_fast":               ["src",                                  "RSI", 2],
    "srsi_fast":              ["src",                                  "StochRSI", 3, 3, 3, 2],
    "obv":                    ["m5",                                   "OBV"],
    "obv_trig":               ["obv",                                  "EMA", 13],
    "obv_sdl":                ["obv",                                  "SDL", 13],
    "macd":                   [["$xs", ["src", "EMA", 12],
                                       ["src", "EMA", 26]],            "fn:Diff"],
    "macd_sdl":               ["macd",                                 "SDL", 13],

    "bb":                     ["src",                                  "Bollinger", 20, 2],

    // Climate outputs a boolean that dictates whether the current condition are favorable for trading in general,
    // regardless of which direction you enter.
    "climate":                 [['$xs',
                               'src_bar'],                             "bool:Climate", 10, {
                                   // The following conditions must all be true
                                   hours: [3, 11],  // between 3am and 11am
                                   atr: [2, 13],    // ATR is betweeen 2 and 13
                                   volume: 150      // volume is at least 150 (avg of last 10)
                               }],

    //

    //  Direction:
    "obv_ema_diff":           ["obv,obv_trig",                         "dir:Difference"],
    "trend":                  [["$xs", ["sdl_fast", "dir:Direction"],
                                       ["obv_ema_diff"]],              "dir:And"],

    //  Execution (Entry):
    "rsi_fast_hook":          ["rsi_fast",                              "dir:HooksFrom", [20, 80]],
    "srsi_fast_hook":         ["srsi_fast.K",                          "dir:HooksFrom", [20, 80]],
    // rsi_fast_hook *OR* srsi_fast_hook
    "trend_hook":             [["$xs", ["rsi_fast_hook,trend",  "dir:And"],
                                       ["srsi_fast_hook,trend", "dir:And"]],  "dir:Or"],
    //"dbl_hook":               ["obv",                                  "dir:DblHook", 6],
    //"obv_bounce":             ["obv,obv_sdl",                          "dir:DiffLastSwing", 0, 3],
    //"exec":                   ["trend_hook,obv_bounce",                "dir:And"],
    "exec":                   ["trend_hook",                "dir:And"],

    // ----------------------------------------------------------------------------------

    // Qualifiers
    //"kvo_t_sl":               ["kvo.T",                           "fn:Slope"],
    //"obv_t_sl":               ["obv_t",                           "fn:Slope"],
    //"obvkvo_conf":            ["kvo_t_sl,obv_t_sl",               "fn:Expr", ["kvo", "obv"],
    //                                                              "(kvo + obv) / 2"],
    // ==================================================================================
    // Strategy
    "strat":                   ["dual,climate,trend,exec,sim",      "tr:TrendExec", {
                                                                        stop: 10.0,
                                                                        limit: 15.0
                                                                    }],
    "tstop":                   ["dual,sim",                         "tr:TrailingStop", {
                                                                        distance: 10.0,
                                                                        step: 5.0
                                                                    }],

    "cmds":                    ["strat,tstop",                    "tr:TradeCmdsMrg"],

    // Trade Simulation
    "sim":                     ["dual,cmds",                      "tr:BasicSim"],

    // ==================================================================================
    // exports:

    "trade_events":  ["sim"]  // 'trade_events' indicator looked for by backtester

});
