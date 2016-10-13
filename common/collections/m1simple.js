Collection([

    SetDefaultVars({
        // trade params
        default_stop: 5,     // default stop loss order distance (in pips)
        default_limit: 7, // default take-profit target order distance (in pips)

        stop_atr_dist: 2
    }),

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    // define m1 timeframe
    Timestep("m1", {

        m1: {
            input:      Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            dual:       Ind(["<-tick", "m1.input"], "tf:Tick2DualCandle"),
            askbid:     Ind("m1.dual", "stream:DualCandle2AskBidCandles"),
            mid:        Ind("m1.dual", "stream:DualCandle2Midpoint"),

            atr:        Ind("m1.mid", "ATR", 9)
        },

        // RSI / StochRSI
        rsi_fast:   Ind("m1.mid.close", "RSI", 2),
        srsi_fast:  Ind("m1.mid.close", "StochRSI", 3, 3, 2, 2),
        srsi_med:   Ind("m1.mid.close", "StochRSI", 8, 8, 5, 3),
        srsi_slow:  Ind("m1.mid.close", "StochRSI", 14, 14, 5, 3),

        // OBV
        obv:        Ind("m1.mid", "OBV"),
        obv_ema:    Ind("obv", "EMA", 13),
        obv_sdl:    Ind("obv", "SDL", 13),

        // MACD
        ema26:      Ind("m1.mid.close", "EMA", 26),
        macd12:     Ind([
                        Ind("m1.mid.close", "EMA", 12),
                        "ema26"
                    ], "fn:Diff"),
        macd12_tl:  Ind("macd12", "EMA", 9),

        // BB
        bb:         Ind("m1.mid.close", "Bollinger", 14, 2),

        // -- Studies --

        bb_al_dir:  Ind("bb.mean", "dir:Direction"),

        obv_ema_dir:    Ind("obv_ema", "dir:Direction"),

        macd_tl_dir:    Ind("macd12_tl", "dir:Direction"),

        storsi_trig:    Ind([
                    Ind("srsi_fast", "dir:HooksFrom", [20, 80]),
                    Ind([
                        Ind(Ind("srsi_fast", "dir:Threshold", [70, 30]), "dir:Flip"),
                        Ind("rsi_fast", "dir:HooksFrom", [50])
                    ], "dir:And")
                ], "dir:Or"),

        // -- Trading --

        trigger:    Ind([
                        "bb_al_dir",
                        "obv_ema_dir",
                        "macd_tl_dir",
                        "storsi_trig"
                    ], "dir:And"),

        entry:      Ind([
                        "m1.dual",
                        Ind("m1.dual", "bool:True"),  // always allow trading
                        "trigger",
                        "trades"
                    ], "cmd:EntrySingle", {
                        label: "T",
                        stop: Var("default_stop"),
                        limit: Var("default_limit")
                    }),

        // Use piece-wise dynamic stop strategy
        stop:       Ind([
                        "m1.dual",     // price
                        "trades",      // trade events
                        "m1.atr"       // $3
                    ], "cmd:StopLoss2", "-${stop_atr_dist} * ($3 / unitsize)", {
                        lock_at: 0
                    }),

        cmds:       Ind([
                        "entry",
                        "stop"
                    ], "cmd:Union"),

        trades:     Ind(["m1.dual", "cmds"], "evt:BasicSim"),

        trade_evts: "trades"
    }),

    Timestep("D1", {
        d1:         Ind("<-m1.mid", "tf:Candle2Candle"),
        dpivot:     Ind("d1", "pivot:Standard")
    })

])
