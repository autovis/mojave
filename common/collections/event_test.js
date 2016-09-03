Collection([

    SetVars({
        input_count: 140
    }),

    Timestep("m5", {

        dual:       Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        pri:        Ind("dual", "stream:DualCandle2AskBidCandles"),

        sdl_fast:   Ind("pri.ask.close", "SDL", 60),
        sdl_slow:   Ind("pri.ask.close", "SDL", 200),

        dnc:        Ind("pri.ask", "Donchian", 10),
        vol_sd:     Ind("pri.ask.volume", "fn:Stdev", 10),

        tstop:      Ind("dual,trade_evts", "cmd:TrailingStop", {
                        distance: 1.0,
                        step: 1.0,
                        use_close: false,
                        start_bar: 0
                    }),

        trend_en:   Ind([
                        "dual",
                        Ind("dual", "bool:True"),
                        Ind("sdl_fast,sdl_slow", "dir:Crosses"),
                        "trade_evts"
                    ], "cmd:EntrySingle", {stop: 15.0, limit: 10.0, label: "T"}),

        all_cmds:   Ind([
                        "trend_en",
                        "tstop"
                    ], "cmd:Union"),

        trade_evts: Ind(["dual", "all_cmds"], "evt:BasicSim")

    })

])
