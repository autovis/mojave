Collection([

    /*

    Define an EMA on m5 timeframe: htf_ema
    Define a fast and slow EMA on m1 timeframe: fast_ema and slow_ema
    * if (htf_ema is rising AND fast_ema crosses above slow_ema): enter long position
    * if (htf_ema is falling AND fast_ema crosses below slow_ema): enter short position

    */

    SetVars({
        htf_period: 50,
        fast_period: 10,
        slow_period: 30,

        default_stop: 11.1, // default stop loss order distance (in pips)
        default_limit: 15.0 // default take-profit target order distance (in pips)
    }),

    // define tick timeframe (used only when subscribed to live streaming)
    Timestep("T", {
        // tick input source
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    // define m1 timeframe
    Timestep("m1", {

        m1: {
            // m1 input source
            input:      Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            // merge tick source to create main dual_candle input
            dual:       Ind(["<-tick", "m1.input"], "tf:Tick2DualCandle"),
            // create separate ask/bid candles
            askbid:     Ind("m1.dual", "stream:DualCandle2AskBidCandles"),
            // create mid candle that averages params of ask/bid candles
            mid:        Ind("m1.dual", "stream:DualCandle2Midpoint"),

            atr:        Ind("m1.mid", "ATR", 9)
        },

        // common/base indicators -------------------------------------------------------

        fast_ema:   Ind("m1.mid.close", "EMA", Var("fast_period")),
        slow_ema:   Ind("m1.mid.close", "EMA", Var("slow_period")),

        // strategy setup/execution -----------------------------------------------------

        // direction trigger

        trigger:    Ind([
                        //Ind("htf_ema", "dir:Direction"),
                        "==htf_ema_dir",
                        Ind("fast_ema,slow_ema", "dir:Crosses")
                    ], "dir:And"),

        trades:     Ind(["m1.dual", "entry"], "evt:BasicSim"),

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

        trade_evts: "trades"
    }),

    // define m5 timeframe
    Timestep("m5", {

        m5: {
            // m1 input source
            input:      Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
            // m1 dual_candle src to create m5 dual_candle input
            dual:       Ind("<-m1.dual,m5.input", "tf:DualCandle2DualCandle"),
            // create separate ask/bid candles
            askbid:     Ind("m5.dual", "stream:DualCandle2AskBidCandles"),
            // create mid candle that averages params of ask/bid candles
            mid:        Ind("m5.dual", "stream:DualCandle2Midpoint"),

            atr:        Ind("m5.mid", "ATR", 9)
        },

        htf_ema:        Ind("m5.mid.close", "EMA", Var("htf_period")),
        htf_ema_dir:    Ind("htf_ema", "dir:Direction")

    })

])
