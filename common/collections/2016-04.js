Collection([

    SetDefaultVars({
        default_stop:       10.0,
        default_limit:      15.0,
        // climate thresholds
        cndl_size_thres:    5.0,
        min_chan_thres:     12.0
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
        sdl_slow:   Ind("src", "SDL", 100),
        ema12:      Ind("src", "EMA", 12),

        // RSI / StochRSI
        rsi_fast:   Ind("src", "RSI", 2),
        srsi_fast:  Ind("src", "StochRSI", 3, 3, 2, 2),
        srsi_med:   Ind("src", "StochRSI", 8, 8, 5, 3),
        srsi_slow:  Ind("src", "StochRSI", 14, 14, 5, 3),

        // OBV
        obv:        Ind("src_bar", "OBV"),
        obv_ema:    Ind("obv", "EMA", 13),
        obv_sdl:    Ind("obv", "SDL", 13),

        // MACD
        ema26:      Ind("src", "EMA", 26),
        macd12:     Ind([
                        Ind("src", "EMA", 12),
                        "ema26"
                    ], "fn:Diff"),
        macd12_tl:  Ind("macd12", "EMA", 9),
        /*
        macd6:      Ind([
                        Ind("src", "EMA", 6),
                        "ema26"
                    ], "fn:Diff"),
        */

        // Bollinger / %B / Donchian channel
        bb:         Ind("src", "Bollinger", 14, 2),

        percb:      Ind("src,bb.upper,bb.lower", "PercB"),
        percb_sdl8: Ind("percb", "SDL", 8),

        dnc:        Ind("src_bar", "Donchian", 14),

        // derivative indicators -------------------------------------------------------
        //sdl_slow_sl:    Ind("sdl_slow", "fn:Slope"),
        //obv_sdl_sl: Ind("obv_sdl", "fn:Slope"),
        ema12_dely: Ind("ema12", "_:BarsAgo", 3),

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

        // width of BB and DNC bands averaged together
        chan_width:         Ind("bb,dnc", "fn:Calc", "abs(avg($1.upper,$2.upper) - avg($1.lower,$2.lower)) / unitsize"),
        chan_width_clim:    Ind("chan_width", "bool:Calc", "$1 >= thres", {thres: Var("min_chan_thres")}),

        climate:    Ind([
                        "base_clim",
                        "cndl_clim",
                        "chan_width_clim"
                    ], "bool:And"),

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
                            long: $1.close - $2.long <= ${near_stop_dist} * unitsize ? 1 : 0,
                            short: $2.short - $1.close <= ${near_stop_dist} * unitsize ? -1 : 0
                        }`, {}, [["long", "direction"], ["short", "direction"]]),

        // ---------------------------------
        // Exit Strategy
        // ---------------------------------

        // Use piece-wise dynamic stop strategy
        stop:       MapTo(["trend", "rev", "s1", "main"],
                        Ind([
                            "dual",                     // price
                            Source("trades", Item()),   // trade events
                            "recent_dip",
                            "askbid"
                        ], "cmd:StopLoss2", `(function() {
                                let retval;
                                if (bar <= 2) {
                                    retval = dir > 0 ? $3 && $3.long - (${stop_gap} * unitsize) : $3 && $3.short + (${stop_gap} * unitsize);
                                } else {
                                    retval = dir > 0 ? $4.bid.low - (${stop_gap} * unitsize) : $4.ask.high + (${stop_gap} * unitsize);
                                }
                                return dir > 0 ? Math.min(retval, entry) : Math.max(retval, entry);
                            })()`, {
                            mode: "price"
                        })),

        //movetobe:   Ind("dual,trade_evts", "cmd:MoveToBE", 6.0),

        // ##############################################################################
        // ##############################################################################
        // Trend/Correction/Reversal Entry Strategies

        // retracement to BB-AL: price within [35%, 65%] range of %B
        trend_pullback:         Ind([
                                    "percb",
                                    Ind("percb", "_:BarsAgo", 1),
                                    Ind("percb", "SDL", 4)
                                ], "bool:Calc", "($1 >= 0.3 && $1 <= 0.7) || ($2 >= 0.3 && $2 <= 0.7) || ($3 >= 0.3 && $3 <= 0.7)"),


        trend_climate_base:     Ind([
                                    "climate",
                                    "trend_pullback"
                                ], "bool:And"),

        trend_climate:          "trend_climate_base",

        // ---------------------------------
        // T :: Trend
        // ---------------------------------

        trend: {

            base:   Ind([
                        Ind("src,bb.mean", "dir:RelativeTo"),
                        // Retracement to BB-AL (see trend_pullback)
                        "macd_chk",
                        "storsi_trig"
                        // train: divergence
                    ], "dir:And"),

                        // SKIP IF: clear divergence (on OBV) OR
                        //          deep hook OR
                        //          scalloped top

            entry:  Ind([
                        "dual",
                        "trend_climate",
                        "trend.base",
                        "trades.trend"
                    ], "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "T"}),

            exit:   "stop.trend"
        },

        // ---------------------------------
        // T-R :: Reversal
        // ---------------------------------

        rev: {

            base:   Ind([
                        Ind(Ind("ema12_dely", "dir:Direction"), "dir:Flip"),
                        Ind("src,bb.mean", "dir:RelativeTo"),
                        "macd_chk",
                        "storsi_trig"
                    ], "dir:And"),

            entry:  Ind([
                        "dual",
                        "trend_climate",
                        "rev.base",
                        "trades.rev"
                    ], "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "T-R"}),

            exit:   "stop.rev"
        },


        // ##############################################################################
        // ##############################################################################
        // Swing Strategies

        swing_climate_base:     Ind([
                                    "climate"
                                ], "bool:And"),

        swing_climate:          "swing_climate_base",

        // Slow StochRSI is: (rising and < 50) OR (falling and > 50)
        /*
        srsi_slow_rev:  Ind([
                            Ind("srsi_slow", "dir:Direction"),
                            Ind(Ind("srsi_slow", "dir:Threshold", 50), "dir:Flip")
                        ], "dir:And"),
        */

        // ---------------------------------
        // S1 :: Swing entry with no trend
        // ---------------------------------

        s1: {

            base:   Ind([
                        Ind([
                            Ind("srsi_slow", "dir:ThresholdFlip", [80, 20]),
                            Ind(Ind("srsi_slow", "dir:Threshold", [50]), "_:BarsAgo", 6)
                        ], "dir:And"), // STO 14 <20 and from >50
                        "storsi_trig"
                    ], "dir:And"),

            entry:  Ind([
                        "dual",
                        "swing_climate",
                        "s1.base",
                        "trades.s1"
                    ], "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "S1"}),

            exit:   "stop.s1"
        },

        // ---------------------------------
        // S3 :: Swing entry on 4 indicators
        // ---------------------------------

        /*
        s3: {

            base:  Ind([
                        // 1. STO 14 green and coming from <20 but still <50
                        Ind("srsi_slow", "dir:Direction"),
                        Ind(Ind("srsi_slow", "dir:ThresholdFlip", [80, 20]), "_:Sticky", 6),
                        Ind("srsi_slow", "dir:ThresholdFlip", [50]),

                        // 2. MACD12 and OBV.SDL = green
                        Ind("macd12", "dir:Direction"),
                        Ind("obv_sdl", "dir:Direction"),

                        "storsi_trig"

                    ], "dir:And"),

            // (second bar entry) ?

            entry:  Ind([
                        "dual",
                        "swing_climate",
                        "s3.base",
                        "trades.s3"
                    ], "cmd:EntrySingle", {stop: Var("default_stop"), limit: Var("default_limit"), label: "S3"}),

            exit:   "stop.s3"
        },
        */

        // ==================================================================================
        // REDUCE STRATEGIES

        main:  {

            entry:  Ind([
                        "trend.entry",
                        "rev.entry",
                        "s1.entry"
                        //"s3.entry"
                    ], "cmd:Union"),

            exit:   "stop.main"
        },

        // ==================================================================================
        // TRADE SIMULATION

        trades:     MapTo(["trend", "rev", "s1", "main"],
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

    Timestep(Var("htf"), {
        //htf_dcdl:   Input("dual_candle_bar", {interpreter: "stream:DualCandle"})
    }),

    Timestep("D1", {
        d1:         Ind("src_bar", "tf:Candle2Candle"),
        dpivot:     Ind("d1", "pivot:Standard")
    })

])
