define({

    // Input streams
    "ask":                   ["0",                              "stream:AskBar"],
    "bid":                   ["0",                              "stream:BidBar"],
    "m30":                   [{tf:"m30"}, "ask",                "tf:Candle2Candle"],

    // Indicator definitions
    "test":                   ["ask.close",                      "test:EmbeddedIndicator", 10],
    "atr":                    ["ask",                            "ATR", 9],
    "sdl_s":                  ["ask.close",                      "SDL", 78],
    "sdl_f":                  ["ask.close",                      "SDL", 10],
    "srsi_m":                 ["ask.close",                      "StochRSI", 14, 14, 5, 3],
    "srsi_f":                 ["ask.close",                      "StochRSI", 3, 3, 3, 2],
    "kvo":                    ["ask",                            "KVO", 34, 55, 21],
    "kvo_sdl":                ["kvo.KO",                         "SDL", 13],
    "obv":                    ["ask",                            "OBV"],
    "ema":                    ["ask.close",                      "EMA", 10],
    "m30ema":                 ["m30.close",                      "EMA", 10],
    "m30obv":                 ["m30",                            "OBV"],
    "m30sdl":                 ["m30.close",                      "SDL", 10],
    "obv_t":                  ["obv",                            "SDL", 13],
    "obv_sdl":                ["obv",                            "SDL", 55]

})