define({

    // Input streams
    "tick":                   ["0",                                    "stream:Tick"],
    "m5_dcdl":                ["1",                                    "stream:DualCandle"],
    "d1_dcdl?":               ["2",                                    "stream:DualCandle"],
    "dual":                   [{tf:"m5"}, ["$xs","tick","m5_dcdl"],    "tf:Tick2DualCandle"],
    "pri":                    ["dual",                                 "stream:DualCandle2AskBidCandles"],
    //"m30":                    [{tf:"m30"}, "pri.ask",                  "tf:Candle2Candle"],
    "m5":                     [{tf:"m5"}, "pri.ask",                   "tf:Candle2Candle"],
    "m30":                    [{tf:"m30"}, "pri.ask",                  "tf:Candle2Candle"],
    "h1":                     [{tf:"H1"}, "pri.ask",                   "tf:Candle2Candle"],
    "d1":                     [{tf:"D1"}, "pri.ask",                   "tf:Candle2Candle"],
    "dpivot":                 ["d1",                                   "pivot:Standard"],
    "src":                    ["pri.ask.close"],


    // Traditional indicator definitions
    "atr":                    ["pri.ask",                              "ATR", 9],
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

    // Climate:
    //   - volume above 300
    //   - ATR above 4.0

    //"volvol":                ["pri.ask.volume,atr",                    "bool:VolVol", 300, 4],
    "climate":               [['$xs',
                               'pri.ask',
                               'atr',
                               ['pri.ask.volume', 'EMA', 5]],          "bool:Climate", [3, 11], 3, 200],

    //  Direction:
    "obv_ema_diff":           ["obv,obv_trig",                         "dir:Difference"],
    "trend":                  [["$xs", ["macd_sdl", "dir:Direction"],
                                       ["obv_ema_diff"]],              "dir:And"],

    //  Execution (Entry):
    "rsi_fast_hook":          ["rsi_fast",                             "dir:HooksFrom", [25, 75]],
    "srsi_fast_hook":         ["srsi_fast.K",                          "dir:HooksFrom", [25, 75]],
    // rsi_fast_hook *OR* srsi_fast_hook
    "trend_hook":             [["$xs", ["rsi_fast_hook,trend",  "dir:And"],
                                       ["srsi_fast_hook,trend", "dir:And"]],  "dir:Or"],
    "dbl_hook":               ["obv",                                  "dir:DblHook", 6],
    "obv_bounce":             ["obv,obv_sdl",                          "dir:DiffLastSwing", 0, 3],
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
    "test":                   ["dual,climate,trend,exec,trade_events",    "st:TrendExec"],

    // ==================================================================================
    // Trade Simulation
    "trade_events":           ["dual,test",                            "sim:Basic"]

    // ----------------------------------------------------------------------------------

});
