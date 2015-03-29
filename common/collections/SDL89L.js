define({

    // Input streams
    "tick":                   ["0",                              "stream:Tick"],
    "m5_dcdl":                ["1",                              "stream:DualCandle"],
    "d1_dcdl":                ["2",                              "stream:DualCandle"],
    "dual":                   [{tf:"m5"}, "tick,m5_dcdl",        "tf:Tick2DualCandle"],
    "pri":                    ["dual",                           "stream:DualCandle2AskBidCandles"],
    "m30":                    [{tf:"m30"}, "pri.ask",            "tf:Candle2Candle"],
    "d1":                     [{tf:"D1"}, "m30",                 "tf:Candle2Candle"],

    // Indicator definitions
    "cci14":                  [["pri.ask", "price:typical"],     "njtr:CCI", 14],
    "atr":                    ["pri.ask",                        "ATR", 9],
    "sdl_s":                  ["pri.ask.close",                  "SDL", 89],
    "sdl_m":                  ["pri.ask.close",                  "SDL", 21],
    "sdl_f":                  ["pri.ask.close",                  "SDL", 5],
    "rsi":                    ["pri.ask.close",                  "RSI", 4],
    "srsi_m":                 ["pri.ask.close",                  "StochRSI", 14, 14, 5, 3],
    "srsi_f":                 ["pri.ask.close",                  "StochRSI", 3, 3, 3, 2],
    "kvo":                    ["pri.ask",                        "KVO", 34, 55, 21],
    "kvo_sdl":                ["kvo.KO",                         "SDL", 13],
    "obv":                    ["pri.ask",                        "OBV"],
    "obv_t":                  ["obv",                            "SDL", 13],
    "obv_sdl":                ["obv",                            "SDL", 55],

    // ----------------------------------------------------------------------------------

    //"sdl_s_slope":           ["sdl_s",                          "fn:Slope"],
    "sdl_s_dir":              ["sdl_s",                          "dir:Direction"],
    "kvo_sdl_dir":            ["kvo_sdl",                        "dir:Direction", 30],
    "kvo_sdl_slope":          ["kvo_sdl",                        "fn:Slope"],
    "obv_sdl_slope":          ["obv_sdl",                        "fn:Slope"],
    "obv_sdl_dir":            ["obv_sdl",                        "dir:Direction", 25],
    //"srsi_s_trgdir":         ["stochrsi_s.K,stochrsi_s.D",      "dir:Difference", 1.0],
    "kvo_trgcross":           ["kvo.KO,kvo.T",                   "dir:Crosses"],
    "kvo_sdlcross":           ["kvo.KO,kvo_sdl",                 "dir:Crosses"],
    //"obv_sdlcross":          ["obv,obv_sdl",                    "dir:Crosses"],
    "srsi_m_hook":            ["srsi_m.K",                       "dir:HooksFrom", 50],
    "srsi_f_hook":            ["srsi_f.K",                       "dir:HooksFrom", 50],

    // ----------------------------------------------------------------------------------

    /*
    "dirdiff":                ["ask,bid,obv_sdl",               "pip:DirectionRange", {
                                                                    flat_thres: 25,
                                                                    start_hour: 5,
                                                                    end_hour: 10
                                                                }]
    */
    /*
    "obv55kvo":               ["dual.ask,dual.bid,$",            "cus:OBV55KVO", {
                                                                    start_hour: 5,  // Trading hours
                                                                    end_hour: 13
                                                                }]
    */
})