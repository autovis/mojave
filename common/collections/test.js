Collection([

    // Defines a set of variables and assigns them a default value
    /*
    Vars({
        source: "oanda", // csv:oanda_eurusd_2015-10-25_0650
        ltf: "m5",
        htf: "H1"
    }),
    */

    Timestep("T", {
        tick:             Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    Timestep(Var("ltf"), {
        ltf_dcdl:               Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        dual:                   Ind(["tick", "ltf_dcdl"],        "tf:Tick2DualCandle"),
        pri:                    Ind("dual",                     "stream:DualCandle2AskBidCandles"),
        src:                    "src_bar.close",
        src_bar:                "pri.ask",
        m5:                     Ind("src_bar",                  "tf:Candle2Candle"),
        atr:                    Ind("src_bar",                  "ATR", 9),
        sdl_slow:               Ind("src",                      "SDL", 65),
        rsi_fast:               Ind("src",                      "RSI", 2),
        srsi_fast:              Ind("src",                      "StochRSI", 3, 3, 3, 2),
        obv:                    Ind("m5",                       "OBV"),
        obv_trig:               Ind("obv",                      "EMA", 13),
        obv_sdl:                Ind("obv",                      "SDL", 13),
        macd:                   Ind([Ind("src", "EMA", 12),
                                     Ind("src", "EMA", 26)],    "fn:Diff"),
        macd_sdl:               Ind("macd",                     "SDL", 13),

        bb:                     Ind("src",                      "Bollinger", 20, 2),

        ////////////////////////////////////

        // Climate outputs a boolean that dictates whether the current condition are favorable for trading in general,
        // regardless of which direction you enter.
        //tails:                  Ind("src_bar", "bool:Tails", 4, 0.60),      // Candle body must be > 60% of overall length, for avg period of 4 bars
        hours_atr_vol:          Ind("src_bar",                  "bool:Climate", 10, { // Use period 10 to average Volume and ATR values
                                    // The following conditions must all be true
                                    hours: [3, 11],  // Trading hours: between 3am and 11am
                                    atr: [2, 13],    // ATR is between 2 and 13 pips
                                    volume: 0        // Mimimum volume (0 means ignore volume)
                                }),
        // climate = (hours_atr_vol AND tails)
        climate:                Ind("hours_atr_vol"),

        // ----------------------------------------------------------------------------------

        //  Direction:
        obv_ema_diff:           Ind("obv,obv_trig",             "dir:Difference"),
        trend:                  Ind([Ind("sdl_slow", "dir:Direction"),
                                     "obv_ema_diff"],      "dir:And"),

        //  Execution (Entry):
        rsi_fast_hook:          Ind("rsi_fast",                 "dir:HooksFrom", [50]),
        srsi_fast_thres:        Ind(Ind("srsi_fast.K", "dir:Threshold", [80, 20]), "dir:Flip"),
        // trend_hook = (trend AND rsi_fast_hook AND srsi_fast_thres)
        trend_hook:             Ind("trend,rsi_fast_hook,srsi_fast_thres",  "dir:And"),
        exec:                   Ind("trend_hook",               "dir:And"),

        // ----------------------------------------------------------------------------------

        // Qualifiers
        //"kvo_t_sl":               ["kvo.T",                           "fn:Slope"],
        //"obv_t_sl":               ["obv_t",                           "fn:Slope"],
        //"obvkvo_conf":            ["kvo_t_sl,obv_t_sl",               "fn:Expr", ["kvo", "obv"],
        //                                                              "(kvo + obv) / 2"],
        // ==================================================================================
        // Strategy
        strat:                  Ind("dual,climate,trend,exec,sim",      "cmd:TrendExec", {
                                                                            stop: 6.0,   // initial stop loss
                                                                            limit: 10.0, // initial limit
                                                                            gap: 0.5     // space to leave between order placement and "close" price
                                                                        }),
        tstop:                  Ind("dual,sim",                         "cmd:TrailingStop", {
                                                                            distance: 2.0,
                                                                            step: 0.5,
                                                                            use_close: true, // "true" to calculate from "close" price, otherwise use high/low
                                                                            start_bar: 2     // wait "start_bar" number of bars before activating trailing stop
                                                                        }),
        movetobe:               Ind("dual,sim",                         "cmd:MoveToBE", 6.0),

        cmds:                   Ind("strat,tstop,movetobe",             "cmd:Union"),

        // Trade Simulation
        sim:                    Ind("dual,cmds",                        "evt:BasicSim"),

        // ==================================================================================
        // exports:

        trade_evts:             "sim"  // "trade_events" indicator looked for by backtester

    }),

    Timestep("m30", {
        m30:                    Ind("src_bar",                          "tf:Candle2Candle")
    }),

    Timestep(Var("htf"), {
        htf_dcdl:               Input("dual_candle_bar", {interpreter: "stream:DualCandle"})
    }),

    Timestep("D1", {
        d1:                     Ind("src_bar",                          "tf:Candle2Candle"),
        dpivot:                 Ind("d1",                               "pivot:Standard")
    })

])
