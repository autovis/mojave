Collection([

    SetDefaultVars({
        // trade params
        initial_stop:       6.0,
        stop_gap:           0.5,
        near_stop_dist:     5.5,
        initial_limit:      10.0,
        // climate thresholds
        cndl_size_thres:    5.0,
        min_chan_thres:     3.0, // in ATRs
        percb_thres:        0.7
    }),

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    Timestep(Var("ltf"), {

        // price data sources
        ltf_dcdl:   Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        dual:       Ind(["tick", "ltf_dcdl"], "tf:Tick2DualCandle"),
        askbid:     Ind("dual", "stream:DualCandle2AskBidCandles"),
        src_bar:    Ind("dual", "stream:DualCandle2Midpoint"),
        src:        "src_bar.close",

        // traditional indicators -------------------------------------------------------
        atr:        Ind("src_bar", "ATR", 9),

        // moving avgs
        //sdl_slow:   Ind("src", "SDL", 100),
        //ema12:      Ind("src", "EMA", 12),

        // RSI / StochRSI
        rsi_fast:   Ind("src", "RSI", 2),
        srsi_fast:  Ind("src", "StochRSI", 3, 3, 2, 2),
        srsi_med:   Ind("src", "StochRSI", 8, 8, 5, 3),
        srsi_slow:  Ind("src", "StochRSI", 14, 14, 5, 3),

        // MACD
        ema26:      Ind("src", "EMA", 26),
        macd12:     Ind([
                        Ind("src", "EMA", 12),
                        "ema26"
                    ], "fn:Diff"),
        macd12_tl:  Ind("macd12", "EMA", 9),

        // Bollinger / %B / Donchian channel
        bb:         Ind("src", "Bollinger", 14, 2),

        percb:      Ind("src,bb.upper,bb.lower", "PercB"),
        percb_sdl8: Ind("percb", "SDL", 8),

        //dnc:        Ind("src_bar", "Donchian", 14),

        // derivative indicators -------------------------------------------------------
        //ema12_dely: Ind("ema12", "_:BarsAgo", 3),

        /////////////////////////////////////////////////////////////////////////////////
        // Strategy

        // base climate for all trades
        base_clim:    Ind("src_bar", "bool:Climate", 10, {
            hours: [3, 10]      // trading hours start/end
            //atr: [2, 13]      // ATR between given range in pips
            //volume: 0         // min volume
        }),

        cndl_len:   Ind("src_bar", "fn:Calc", "abs($1.close - $1.open) / unitsize"),
        cndl_clim:  Ind("cndl_len", "bool:Calc", "$1 <= thres", {thres: Var("cndl_size_thres")}),

        // width of BB
        chan_width_clim:    Ind("bb,atr", "bool:Calc", "$1.upper - $1.lower >= ${min_chan_thres} * $2"),



        climate:    Ind([
                        "base_clim",
                        "cndl_clim",
                        "chan_width_clim"
                    ], "bool:And"),

        trend_climate_base:     Ind([
                                    "climate",
                                    "trend_pullback"
                                ], "bool:And"),

        trend_climate:          "trend_climate_base",

        swing_climate_base:     Ind([
                                    "climate",
                                    Ind("percb", "bool:Calc", "$1 >= -${percb_thres} && $1 <= ${percb_thres}")
                                ], "bool:And"),

        swing_climate:          "swing_climate_base",

        // ---------------------------------
        // Shared strategy indicators
        // ---------------------------------

        storsi_trig:    Ind([
                            Ind("srsi_fast", "dir:HooksFrom", [20, 80]),
                            Ind([
                                Ind(Ind("srsi_fast", "dir:Threshold", [70, 30]), "dir:Flip"),
                                Ind("rsi_fast", "dir:HooksFrom", [50])
                            ], "dir:And")
                        ], "dir:Or"),

        macd_chk:       Ind("macd12,macd12_tl", "dir:RelativeTo"),

        // get dipping price for last 3 bars
        recent_dip:     Ind("askbid", "_:Calc", `{
                            long:  _.min(_.map([0,1,2], x => $1(x) && $1(x).bid.low)),
                            short: _.max(_.map([0,1,2], x => $1(x) && $1(x).ask.high))
                        }`, {}, [["long", "num"], ["short", "num"]]),

        // test if recent_dip is within <span> pips of close
        near_dip:      Ind("src_bar,recent_dip", "_:Calc", `{
                            long: $1.close - $2.long <= span * unitsize ? 1 : 0,
                            short: $2.short - $1.close <= span * unitsize ? -1 : 0
                        }`, {span: 5}, [["long", "direction"], ["short", "direction"]]),

        // ---------------------------------
        // Exit Strategy
        // ---------------------------------

        // Use piece-wise dynamic stop strategy
        stop:       MapTo(["trend", "swing", "main"],
                        Ind([
                            "dual",                     // price
                            Source("trades", Item()),   // trade events
                            "recent_dip",
                            "askbid"
                        ], "cmd:StopLoss2", `(function() {
                                if (bar <= 2) {
                                    return dir > 0 ? $3 && $3.long - (${stop_gap} * unitsize) : $3 && $3.short + (${stop_gap} * unitsize);
                                } else {
                                    return dir > 0 ? $4.bid.low - (1.0 * unitsize) : $4.ask.high + (1.0 * unitsize);
                                }
                            })()`, {
                            mode: "price"
                        })),

        //movetobe:   Ind("dual,trade_evts", "cmd:MoveToBE", 6.0),

        // ##############################################################################
        // ##############################################################################
        // Trend/Correction/Reversal Entry Strategies

        // retracement to BB-AL: price within [35%, 65%] range of %B
        trend_pullback:         Ind("percb", "bool:Calc", "_.some([0,1,2,3], x => $1(x) >= 0.3 && $1(x) <= 0.7)"),

        // ---------------------------------
        // T :: Trend
        // ---------------------------------

        trend: {

            base:   Ind([
                        Ind("src,bb.mean", "dir:RelativeTo"),
                        //Ind("percb", "dir:Calc", "$1 > ${percb_thres} ? 1 : ($1 < -${percb_thres} ? -1 : 0)"),
                        "macd_chk",
                        "storsi_trig"
                    ], "dir:And"),

                        // SKIP IF: clear divergence (on OBV) OR
                        //          deep hook OR
                        //          scalloped top

            entry:  Ind([
                        "dual",
                        "trend_climate",
                        Ind("trend.base,near_dip", "dir:Calc", `$1 === 1 && $2.long === 1 ? 1 : ($1 === -1 && $2.short === -1 ? -1 : 0)`),
                        "trades.trend"
                    ], "cmd:EntrySingle", {stop: Var("initial_stop"), limit: Var("initial_limit"), label: "T"}),

            exit:   "stop.trend"
        },

        // ##############################################################################
        // ##############################################################################
        // Swing Strategies

        // Slow StochRSI is: (rising and < 50) OR (falling and > 50)
        /*
        srsi_slow_rev:  Ind([
                            Ind("srsi_slow", "dir:Direction"),
                            Ind(Ind("srsi_slow", "dir:Threshold", 50), "dir:Flip")
                        ], "dir:And"),
        */

        // ---------------------------------
        // S :: Swing entry with no trend
        // ---------------------------------

        swing: {

            base:   Ind([
                        Ind([
                            Ind("srsi_slow", "dir:ThresholdFlip", [80, 20]),
                            Ind(Ind("srsi_slow", "dir:Threshold", [50]), "_:BarsAgo", 6)
                        ], "dir:And"),
                        "storsi_trig"
                    ], "dir:And"),

            entry:  Ind([
                        "dual",
                        "swing_climate",
                        Ind("swing.base,near_dip", "dir:Calc", `$1 === 1 && $2.long === 1 || $1 === -1 && $2.short === -1`),
                        "trades.swing"
                    ], "cmd:EntrySingle", {stop: Var("initial_stop"), limit: Var("initial_limit"), label: "S"}),

            exit:   "stop.swing"
        },

        // ==================================================================================
        // REDUCE STRATEGIES

        main:  {

            entry:  Ind([
                        "trend.entry",
                        "swing.entry"
                    ], "cmd:Union"),

            exit:   "stop.main"
        },

        // ==================================================================================
        // TRADE SIMULATION

        trades:     MapTo(["trend", "swing", "main"],
                        Ind(["dual",
                            Ind([
                                Source(Item(), "entry"),
                                Source(Item(), "exit")
                            ], "cmd:Union")
                        ], "evt:BasicSim")),

        trade_evts: "trades.main"

        // ==================================================================================
        // TRADE EXECUTION

        //trade_evts: Ind(["dual", "all_cmds"], "evt:Broker")

    }),

    Timestep("m30", {
        m30:        Ind("src_bar", "tf:Candle2Candle")
    }),

    Timestep("D1", {
        d1:         Ind("src_bar", "tf:Candle2Candle"),
        dpivot:     Ind("d1", "pivot:Standard")
    })

])
