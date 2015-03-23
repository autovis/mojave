var _ = require('underscore');
var machina = require('machina')(_);

function create_delegate() {

    var input;
    var options;
    var delegate;

    // trading vars
    var trend_dir = 0;
    var direction = {flat: 0, up: 1, down: -1};
    var trade_stats = {};

    // Indicators whose outputs are accessible as properties in ind stream
    var indicator_defs = {

        "atr":                   ["0",                             "tsATR", 9],
        "sdl_s":                 ["0.close",                       "SDL", 78],
        "sdl_m":                 ["0.close",                       "SDL", 48],
        "sdl_f":                 ["0.close",                       "SDL", 10],
        "stochrsi_s":            ["0.close",                       "tsStochRSI", 80, 80, 30, 8],
        "stochrsi_m":            ["0.close",                       "tsStochRSI", 8, 5, 3, 2],
        "kvo":                   ["0",                             "tsKVO", 34, 55, 21],
        "kvo_sdl":               ["kvo.KO",                        "SDL", 13],
        "obv":                   ["0",                             "OBV"],
        "obv_T":                 ["obv",                           "SDL", 21],
        "obv_sdl":               ["obv",                           "SDL", 13],

        // -------------------------------------------------------------------

        "sdl_s_dir":             ["sdl_s",                         "dir:Direction"],
        "kvo_sdl_dir":           ["kvo_sdl",                       "dir:Direction"],
        "srsi_s_trgdir":         ["stochrsi_s.K,stochrsi_s.D",     "dir:Difference", 1.0],
        "kvo_trgcross":          ["kvo.KO,kvo.T",                  "dir:Crosses"],
        "kvo_sdlcross":          ["kvo.KO,kvo_sdl",                "dir:Crosses"],
        "obv_sdlcross":          ["obv,obv_sdl",                   "dir:Crosses"]

    };

    var indstr;           // stream of indicator outputs
    var ind;              // keymapped stream
    var ind_collection;   // indicator collection

    var fsm = new machina.Fsm({

        initialState: "init",

        // This init occurs during construction before delegate's initialize() is called
        initialize: function() {},

        states: {

            "init": { // This init is called from the delegate's initialize() function                
                "initialize": function() {
                    this.transition("flat");    
                }
            },

            "flat": { // Default initial state, ready for trading
                _onEnter: function() {
                    delegate.emit("debug", "Entering flat");
                    trade_stats = {};
                },
                "bar_update": function() {
                    if (ind.sdl_s_dir(0) != 0) {

                    }
                }                    
            },

            "trend_start": { // Trend direction has been established

            },

            "trend_confirmed": {
                
            },

            "correction_begin": {
                
            },

            "correction_mature": {
                
            },

            "reversal_begin": {
                
                
            }

        }

    });

    return {

        // Initialize delegate
        initialize: function(opt, input_streams, callback) {
            input = input_streams[0].simple_stream();
            delegate = this;
            options = opt;
            ind_collection = this.indicator_collection(indicator_defs, input_streams);
            indstr = this.stream(null, "indicators");
            ind = indstr.map_property_stream(_.keys(indicator_defs));
            //fsm.emit = this.emit.bind(this); // Bind FSM's emit() to the delegate's
            fsm.handle("initialize");
            callback();
        },

        // Called when input streams are updated
        on_bar_update: function(callback) {
            indstr.set(ind_collection.update_and_evaluate());
            fsm.handle("bar_update");
            this.emit("debug", ind.sdl_s_slope(0)+" : "+ind.sdl_s_dir(0));
            callback();
        }
    };
};

module.exports = create_delegate;
