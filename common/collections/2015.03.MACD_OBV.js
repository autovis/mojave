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
    "sdl_slow":               ["src",                                  "SDL", 34],
    "sdl_fast":               ["src",                                  "SDL", 21],
    "rsi_fast":               ["src",                                  "RSI", 2],
    "srsi_fast":              ["src",                                  "StochRSI", 3, 3, 3, 2],
    "obv":                    ["m5",                                   "OBV"],
    "obv_trig":               ["obv",                                  "EMA", 13],
    "obv_sdl":                ["obv",                                  "SDL", 13],
    "macd":                   [["$xs", ["src", "EMA", 12],
                                       ["src", "EMA", 26]],            "fn:Diff"],

    // Climate:
    //   - volume above 300
    //   - ATR above 4.0

    "volvol":                ["pri.ask.volume,atr",                    "bool:VolVol", 300, 4],
    "climate":               ["volvol"],

    //  Direction:
    //  dir:ConcordDir
    //      sdl_fast
    //      obv_trig
    //      obv_sdl
    //      macd
    "trend":                  ["sdl_fast,obv_trig,obv_sdl,macd",       "dir:ConcordDir"],


    //  Entry:
    //  AND:
    //      WForm(obv)

    "exec":                   ["obv",                                  "dir:WFormation"],


    // Qualifiers
    //"kvo_t_sl":               ["kvo.T",                           "fn:Slope"],
    //"obv_t_sl":               ["obv_t",                           "fn:Slope"],
    //"obvkvo_conf":            ["kvo_t_sl,obv_t_sl",              "fn:Expr", ["kvo", "obv"],
    //                                                              "(kvo + obv) / 2"],
    // ==================================================================================
    // Strategy
    "test":                   ["dual,climate,trend,exec",         "st:TrendExec"],
    "basic_sim":              ["dual,test",                       "sim:Basic"]

    // ----------------------------------------------------------------------------------

})