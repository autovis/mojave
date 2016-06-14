Collection([

    SetDefaultVars({
        // trade params
        initial_stop:       6.0,
        stop_gap:           0.5,
        near_stop_dist:     4.5,
        initial_limit:      10.0
    }),

    Timestep("T", {
        tick:       Input("tick", {subscribe: true, interpreter: "stream:Tick"})
    }),

    Timestep(Var("ltf"), {

        // sources
        ltf_dcdl:   Input("dual_candle_bar", {interpreter: "stream:DualCandle"}),
        dual:       Ind(["tick", "ltf_dcdl"], "tf:Tick2DualCandle"),
        askbid:     Ind("dual", "stream:DualCandle2AskBidCandles"),
        src_bar:    Ind("dual", "stream:DualCandle2Midpoint"),
        src_bar_trim:   Ind("src_bar", "stream:TrimTails", 0.33),
        src:        "src_bar.close",
        m5:         Ind("src_bar", "tf:Candle2Candle"),

        // common/base indicators -------------------------------------------------------
        atr:        Ind("src_bar", "ATR", 9),

        srsi_med:   Ind("src", "StochRSI", 5, 3, 2, 2),

        zz: {
            one:  Ind("src_bar", "ZigZag", 6, 5),
            two:  Ind("src_bar_trim", "ZigZag", 12, 10),
            three:  Ind("src_bar_trim", "ZigZag", 36, 15)
        },

        channel:    Ind("zz.three,zz.two,zz.one", "mark:Trend", {}),
        bounce:     Ind("src_bar,channel", "dir:TrendBounce", {}),

        /////////////////////////////////////////////////////////////////////////////////
        // Strategy

        // base climate for all trades
        climate:    Ind("src_bar", "bool:Climate", 10, {
            hours: [2, 22]      // trading hours start/end
            //atr: [2, 13]      // ATR between given range in pips
            //volume: 0         // min volume
        }),

        // ---------------------------------
        // Shared strategy indicators
        // ---------------------------------

        // get dipping price for last 3 bars
        recent_dip:     Ind("askbid", "_:Calc", `{
                            long:  _.min(_.map([0,1,2], x => $1(x) && $1(x).bid.low)),
                            short: _.max(_.map([0,1,2], x => $1(x) && $1(x).ask.high))
                        }`, {}, [["long", "num"], ["short", "num"]]),

        // test if recent_dip is within <span> pips of close
        near_dip:       Ind("src_bar,recent_dip", "_:Calc", `{
                            long: $1.close - $2.long <= ${near_stop_dist} * unitsize ? 1 : 0,
                            short: $2.short - $1.close <= ${near_stop_dist} * unitsize ? -1 : 0
                        }`, {}, [["long", "direction"], ["short", "direction"]]),

        pullback:       Ind(Ind(Ind(Ind("src", "EMA", 5), "_:BarsAgo", 1), "dir:Direction"), "dir:Flip"),

        nsnd:           Ind([Ind("src_bar", "dir:NSND"), "bounce"], "dir:Calc", `$1 || $2`),

        // ---------------------------------
        // Exit Strategy
        // ---------------------------------

        // Use piece-wise dynamic stop strategy
        stop:       MapTo(["geom", "main"],
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
                                return retval;
                            })()`, {
                            mode: "price"
                        })),

        // ##############################################################################
        // ##############################################################################

        // ---------------------------------
        // G :: Geometric
        // ---------------------------------

        geom: {

            base:   Ind([
                        "pullback",
                        "bounce",
                        "nsnd",
                    ], "dir:And"),

            entry:  Ind([
                        "dual",
                        "climate",
                        Ind("geom.base,near_dip", "dir:Calc", `$1 === 1 && $2.long === 1 ? 1 : ($1 === -1 && $2.short === -1 ? -1 : 0)`),
                        "trades.geom"
                    ], "cmd:EntrySingle", {stop: Var("initial_stop"), limit: Var("initial_limit"), label: "T"}),

            exit:   "stop.geom"
        },

        main:  {

            entry:  Ind([
                        "geom.entry"
                    ], "cmd:Union"),

            exit:   "stop.main"
        },

        // ==================================================================================
        // TRADE SIMULATION

        trades:     MapTo(["geom", "main"],
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

    })

])
