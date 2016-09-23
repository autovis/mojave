Collection([

    SetVars({
        default_stop: 10.0,
        default_limit: 15.0
    }),

    // define tick timeframe (used only when subscribed to live streaming)
    Timestep("T", {
        // tick input source
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    Timestep("m5", {

        "m5.input": Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        dual:       Ind(["<-tick", "m5.input"], "tf:Tick2DualCandle"),
        askbid:     Ind("dual", "stream:DualCandle2AskBidCandles"),
        mid:        Ind("dual", "stream:DualCandle2Midpoint"),
        ha_ask:     Ind("askbid.ask", "stream:HeikinAshi"),
        ha_bid:     Ind("askbid.bid", "stream:HeikinAshi"),
        ha_mid:     Ind("mid", "stream:HeikinAshi"),

        // common/base indicators -------------------------------------------------------

        atr:        Ind("mid", "ATR", 9),
        srsi_med:   Ind("ha_mid.close", "StochRSI", 8, 8, 5, 2)

        /*
        fast_ema:   Ind("mid.close", "EMA", Var("fast_period")),
        slow_ema:   Ind("mid.close", "EMA", Var("slow_period")),

        // strategy setup/execution -----------------------------------------------------

        // direction trigger
        trigger:    Ind("fast_ema,slow_ema", "dir:Crosses"),

        trades:     Ind(["dual", "entry"], "evt:BasicSim"),

        entry:      Ind([
                        "dual",
                        Ind("dual", "bool:True"),  // always allow trading
                        "trigger",
                        "trades"
                    ], "cmd:EntrySingle", {
                        label: "T",
                        stop: 3,
                        limit: 6
                    }),

        trade_evts: "trades"

        */
    })

])
