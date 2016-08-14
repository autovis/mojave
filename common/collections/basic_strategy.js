Collection([

    /*

    Example collection showing the most basic set up for a trading strategy:

    Define a fast and slow moving average (using EMA)
    * if fast_ema crosses above slow_ema: enter long position
    * if fast_ema crosses below slow_ema: enter short position

    */

    SetVars({
        fast_period: 10,
        slow_period: 30,

        default_stop: 10.0, // default stop loss order distance (in pips)
        default_limit: 15.0 // default take-profit target order distance (in pips)
    }),

    // define tick timeframe (used only when subscribed to live streaming)
    Timestep("T", {
        // tick input source
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    // define m1 timeframe
    Timestep("m1", {

        // m1 input source
        m1_input:   Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        // merge tick source to create main dual_candle input
        dual:       Ind(["<-tick", "m1_input"], "tf:Tick2DualCandle"),
        // create separate ask/bid candles
        askbid:     Ind("dual", "stream:DualCandle2AskBidCandles"),
        // create mid candle that averages params of ask/bid candles
        mid:    Ind("dual", "stream:DualCandle2Midpoint"),

        // common/base indicators -------------------------------------------------------

        atr:        Ind("mid", "ATR", 9),
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
    })

])
