define({

    // Input streams
    "tick":                   ["0",                              "stream:Tick"],
    "dual":                   [{tf:"m5"}, "tick",                "tf:Tick2DualCandle"],
    "ask":                    ["dual.ask"]
})