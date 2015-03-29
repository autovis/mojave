define(['underscore', 'machina', 'moment'], function(_, machina, moment) {

    var dir = {up:1,flat:0,down:-1};

    return {

        param_names: ['options'],

        input: ['dual_candle_bar'],
        output: [
            ['trade', 'trade'],
            ['state', 'string'],
            ['notes', 'string'],
            ['stats', 'json']
        ],

        // ======================================================================

        initialize: function(params, inputs, output) {

            // inputs
            var ask = inputs[0];  // ask prices
            var bid = inputs[1];  // bid prices
            var ind = inputs[2];  // indicators

            // AWSMs
            //this.wsm.trigger = new AWsm();

            this.options = params.options;
            var this_ind = this;

            this.fsm = new machina.Fsm({

                initialState: "offline",

                // This init occurs during construction before delegate's initialize() is called
                initialize: function() {
                    this.out = {trade:{},stats:{},notes:[]};
                    this.options = params.options;
                    this.trade_dir = 0;
                    this.checkTradingClimate();
                },

                states: {

                    "offline": { // Trading is disabled
                        _onEnter: function() {
                            this.trade_dir = dir.flat;
                        },
                        "bar_update": function() {
                            this.checkTradingClimate();
                        }
                    },

                    "flat": { // Default initial state, ready for trading
                        _onEnter: function() {
                            this.trade_dir = dir.flat;
                        },
                        "bar_update": function() {
                            this.checkTradingClimate();
                            if (ind.obv_sdl_dir.get(0) != 0) {  // obv_sdl is not flat
                                this.trade_dir = ind.obv_sdl_dir.get(0);
                                this.out.notes.push("OBV SDL is going "+dirname(this.trade_dir));
                                this.transition("trend_start");
                            }
                        }
                    },

                    "trend_start": { // Trend direction established
                        _onEnter: function() {
                            this.out.notes.push("Setting direction to "+tdirname(this.trade_dir));
                        },
                        "bar_update": function() {
                            this.checkTradingClimate();
                            if (ind.obv_sdl_dir.get(0) == -(this.trade_dir)) {
                                this.out.notes.push("OBV_SDL turned to opposite dir");
                                this.transition("flat");
                            } else if (ind.kvo_sdl_dir.get(0) == -(this.trade_dir)) {
                                this.out.notes.push("KVO_SDL going opposite trend, assume pullback starting");
                                this.transition("trend_pullback_start");
                            }
                         }
                    },

                    "trend_pullback_start": { // A correction is starting
                        _onEnter: function() {
                            this.pullback_age = 0;
                        },
                        _onExit: function() {
                            delete this.pullback_age;
                        },
                        "bar_update": function() {
                            this.pullback_age++;
                            if (ind.obv_sdl_dir.get(0) == -(this.trade_dir)) {  // possible trend reversal
                                this.out.notes.push("OBV SDL is reversing, cancelling setup");
                                this.transition("flat");
                            } else if (ind.kvo_sdlcross.get(0) == this.trade_dir) {  // KVO crosses its SDL
                                this.out.notes.push("TRIGGER: KVO crossed back over its SDL");
                                this.transition("trend_positioned");
                            } else if (ind.kvo_sdl_dir.get(0) == this.trade_dir) {  // KVO pullback weakens w/o crossing SDL
                                this.transition("trend_start");
                            }
                        }
                    },

                    "trend_positioned": { // In trade
                        _onEnter: function() {
                            this.out.notes.push("Entering "+tdirname(this.trade_dir)+" position");
                            this.emit(this.trade_dir == 1 ? "enter_long" : "enter_short", {});
                        },
                        _onExit: function() {
                            this.out.notes.push("Exiting "+tdirname(this.trade_dir)+" position");
                            this.emit("exit");
                        },
                        "bar_update": function() {
                            if (ind.kvo_sdlcross.get(0) == -this.trade_dir) {
                                this.out.notes.push("KVO SDL crossed back");
                                this.transition("flat");
                            }
                        }
                    }

                },

                // -------------------------------------------------------------

                eventListeners: {
                    transition: [function(arg) {
                        this.out.stats.statechange = [arg.fromState, arg.toState];
                    }],

                    // Custom:

                    enter_long: [function(arg) {
                        this.out.trade = _.extend(arg, {action: "enter_trade", dir:"long"});
                    }],
                    enter_short: [function(arg) {
                        this.out.trade = _.extend(arg, {action: "enter_trade", dir:"short"});
                    }],
                    set_stop: [function(arg) {
                        this.out.trade = {action: "set_stop", value: arg};
                    }],
                    set_limit: [function(arg) {
                        this.out.trade = {action: "set_limit", value: arg};
                    }],
                    exit: [function() {
                        this.out.trade = {action: "exit_trade"};
                    }]
                },

                // -------------------------------------------------------------

                checkTradingClimate: function() {
                    if (this_ind.current_index() % 6 != 0) return;  // Check only every 6 bars
                    // Correct trading hours
                    if (this.state == "offline") {
                        var curr_hour = ask.get(0).date.getHours();
                        if (curr_hour >= this.options.start_hour && curr_hour <= this.options.end_hour) {
                            this.transition("flat");
                            this.out.notes.push("Trading conditions became favorable (Time window)");
                        } else {
                            // stay offline
                        }
                    } else if (this.state != "offline") {
                        var curr_hour = ask.get(0).date.getHours();
                        if (curr_hour >= this.options.start_hour && curr_hour <= this.options.end_hour) {
                            // stay online/flat
                        } else {
                            this.transition("offline")
                            this.out.notes.push("Trading conditions no longer favorable (Time window)");
                        }
                    }
                }

            });

        },

        // ======================================================================

        on_bar_update: function(params, inputs, output) {
            this.fsm.out = {trade:{},stats:{},notes:[]};
            this.fsm.handle("bar_update");
            this.fsm.out.state = this.fsm.state;
            this.fsm.out.stats.trade_dir = this.fsm.trade_dir;
            this.fsm.out.notes = this.fsm.out.notes.join("; ");
            output.set(this.fsm.out);
        }
    }

    function dirname(dir) {
        return (dir > 0 ? "UP" : (dir < 0 ? "DOWN" : "FLAT"));
    }

    function tdirname(dir) {
        return (dir > 0 ? "LONG" : (dir < 0 ? "SHORT" : "FLAT"));
    }
})
