define({

    // Input streams
    "tick":                   ["0",                              "stream:Tick"],
    "m5_dcdl":                ["1",                              "stream:DualCandle"],
    "d1_dcdl?":               ["2",                              "stream:DualCandle"],
    "dual":                   [{tf:"m5"}, "tick,m5_dcdl",        "tf:Tick2DualCandle"],
    "pri":                    ["dual",                           "stream:DualCandle2AskBidCandles"],
    //"m30":                    [{tf:"m30"}, "pri.ask",            "tf:Candle2Candle"],
    "d1":                     [{tf:"D1"}, "pri.ask",             "tf:Candle2Candle"],

    // Indicator definitions
    "atr9":                    ["pri.ask",                       "ATR", 9],
    "sdl89":                  ["pri.ask.close",                  "SDL", 89],
    "sdl5":                   [["pri.ask", "price:weighted"],    "SDL", 5],
    "rsi4":                   ["pri.ask.close",                  "RSI", 4],
    "lreg34":                 ["pri.ask.close",                  "fn:LinReg", 34],
    "preg34":                 ["pri.ask.close",                  "fxts:PolyRegSlope", 34, 2],
    "srsi8853":               ["pri.ask.close",                  "StochRSI", 8, 8, 5, 3],
    "srsi3332":               ["pri.ask.close",                  "StochRSI", 3, 3, 3, 2],
    "kvo":                    ["pri.ask",                        "KVO", 34, 55, 13],
    "kvo_sdl":                ["kvo.KO",                         "SDL", 8],
    "obv":                    ["pri.ask",                        "OBV"],
    "obv_t":                  ["obv",                            "EMA", 13],
    "kvo_lreg":               ["kvo.T",                          "fn:LinReg", 21]

    // Qualifiers

    // ----------------------------------------------------------------------------------

})