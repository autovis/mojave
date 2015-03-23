define({

    // Input streams
    "tick":                   ["0",                              "stream:Tick"],
    "m1_dcdl":                ["1",                              "stream:DualCandle"],
    "d1_dcdl?":               ["2",                              "stream:DualCandle"],
    "dual":                   [{tf:"m1"}, ["$xs","tick","m1_dcdl"],        "tf:Tick2DualCandle"],
    "pri":                    ["dual",                           "stream:DualCandle2AskBidCandles"],
    //"m30":                    [{tf:"m30"}, "pri.ask",            "tf:Candle2Candle"],
    "m5":                     [{tf:"m5"}, "pri.ask",             "tf:Candle2Candle"],
    "m15":                    [{tf:"m15"}, "pri.ask",            "tf:Candle2Candle"],
    "h1":                     [{tf:"H1"}, "pri.ask",             "tf:Candle2Candle"],
    "d1":                     [{tf:"D1"}, "pri.ask",             "tf:Candle2Candle"],
    "dpivot":                 ["d1",                             "pivot:Standard"],

    // Indicator definitions
    "atr9":                    ["pri.ask",                       "ATR", 9],
    "sdl89":                  ["pri.ask.close",                  "SDL", 89],
    "sdl5":                   [["pri.ask", "price:weighted"],    "SDL", 5],
    "rsi2":                   ["pri.ask.close",                  "RSI", 2],
    "lreg34":                 ["pri.ask.close",                  "fn:LinReg", 34],
    "preg34":                 ["pri.ask.close",                  "fxts:PolyRegSlope", 34, 2],
    "srsi8853":               ["pri.ask.close",                  "StochRSI", 8, 8, 5, 3],
    "srsi3332":               ["pri.ask.close",                  "StochRSI", 3, 3, 3, 2],
    "kvo":                    ["m5",                             "KVO", 34, 55, 13],
    "kvo_sdl":                ["kvo.KO",                         "SDL", 8],
    "obv":                    ["m5",                             "OBV"],
    "obv_t":                  ["obv",                            "EMA", 13],
    "kvo_lreg":               ["kvo.T",                          "fn:LinReg", 21],

    // Qualifiers
    "kvo_t_sl":               ["kvo.T",                           "fn:Slope"],
    "obv_t_sl":               ["obv_t",                           "fn:Slope"],
    "obvkvo_conf":            ["kvo_t_sl,obv_t_sl",              "fn:Expr", ["kvo", "obv"], 
                                                                  "(kvo + obv) / 2"],
    //"frac":                   ["pri.ask",                         "Fractal"]
    "zz1":                    ["pri.ask",                         "ZigZag", 4, 3],
    "zz2":                    ["pri.ask",                         "ZigZag", 10, 7],
    "zz3":                    ["pri.ask",                         "ZigZag", 30, 20],
    "zigzag_m5":                 ["m5",                           "ZigZag", 12, 3],

    "test":                   ["dual",                            "st:Test"],
    "basic_sim":              ["dual,test",                       "sim:Basic"]

    // ----------------------------------------------------------------------------------

})