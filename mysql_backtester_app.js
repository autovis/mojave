
var fs = require("fs");
var path = require("path");
var mysql = require("mysql");
var async = require("async");
var _ = require("underscore");

var stream = require("./stream.js");
var indicator_collection = require("./indicator_collection.js");
var delegate_instance = require("./delegate_instance.js");

// ################################################################################################

var config = {

    mysql_connection: {
        host     : 'localhost',
        user     : 'root',
        password : '',
        database : 'forex'
    },

    input_sources: [
        // Table to get data from and context information
        //["eur_usd_m5", "EURUSD", "m5"],
        ["fxts_import2", "EURUSD", "m5"]
    ],

    results_table: "backtest",      // table to write backtest output

    delegates: [
        ["FsmDelegate", {id:"fsm_delegate"}]
    ],

    // Additional indicators to evaluate dynamically and supplement input
    indicators: {
        // Input streams
        "~ask":                 ["0",                               "stream:Ask"],
        "~bid":                 ["0",                               "stream:Bid"],
        "avg":                  ["0",                               "stream:AskBidAvg"],
        //"m30":                  ["avg",                             ""],

        // Indicator definitions
        "cci14":                 [["avg", "price:typical"],         "njtr:CCI", 14],
        "atr":                   ["avg",                            "ATR", 9],
        "sdl_s":                 ["avg.close",                      "SDL", 78],
        "sdl_f":                 ["avg.close",                      "SDL", 10],
        "stochrsi_m":            ["avg.close",                      "StochRSI", 14, 14, 5, 3],
        "stochrsi_f":            ["avg.close",                      "StochRSI", 3, 3, 3, 2],
        "kvo":                   ["avg",                            "KVO", 34, 55, 21],
        "kvo_sdl":               ["kvo.KO",                         "SDL", 13],
        "obv":                   ["avg",                            "OBV"],
        "obv_T":                 ["obv",                            "SDL", 21],
        "obv_sdl":               ["obv",                            "SDL", 55],
    },

    optimization: {
            
        
    },

    cached_rows: 5000,             // max table records fetched at a time
    input_buffer_size: 200         // max num of bars for input streams
    //indicator_buffer_size: 200     // max num of indicator output bars
};

// ################################################################################################

var read_conn = mysql.createConnection(config.mysql_connection);
var write_conn = mysql.createConnection(config.mysql_connection);

var select_sql = "SELECT * FROM forex."+(config.input_sources[0][0])+" ORDER BY date;";

var exit_callback = function(err) {
    read_conn.end();
    write_conn.end();
    if (err) {
        console.log("ERROR: ", err);
        console.log(new Date());
        console.log("Aborting with exit status 1");
        process.exit(1);
    }
    console.log("Normal exit.");
    process.exit(0);
};
  
var in_queue = async.queue(process_record, 1);
var input_streams = [];

var current_index=0;
var total_rows;

in_queue.empty = function() {read_conn.resume();}

_.each(config.input_sources, function(val) {
    var strm = new stream(config.input_buffer_size, _.first(val), _.rest(val));
    input_streams.push(strm);
});

var ind_collection = new indicator_collection(config.indicators, input_streams);

// root-level delegates
var delegates = config.delegates.map(function(dlg_def) {
    var delegate = delegate_instance(dlg_def[0], dlg_def[1], input_streams);
    delegate.onAny(function(value) {
        on_delegate_event(this.name, this.event, value);    
    });
    return delegate;
});

async.auto({

    read_connect: function(cb) {
        read_conn.connect(cb);
    },

    write_connect: ['read_connect', function(cb) {
        write_conn.connect(cb);
    }],

    init_delegates: ['write_connect', function(cb) {
        async.each(delegates, function(delegate, cb2) {
            delegate.initialize(cb2);            
        }, cb);
    }],

    get_total_rows: ['init_delegates', function(cb) {
        read_conn.query("SELECT COUNT(*) count FROM "+(config.mysql_connection.database)+"."+(config.input_sources[0][0])+";", function(err, rows) {
            if (err) return cb(err);
            total_rows = rows[0].count;
            cb();                
        }); 
    }],

    process_market_data: ['get_total_rows', function(cb) {

        var query = read_conn.query(select_sql);
        
        query.on('result', function(row) {
            //process.stdout.write('>');
            in_queue.push(row);
            if (in_queue.length() >= config.cached_rows) read_conn.pause();
        }).on('error', function(err) {
            cb(err);
        }).on('end', function() {
            in_queue.push(false);   // task of value "false" signifies end of stream
            cb();
        });
    }]
    
}, function(err) {
    if (err) exit_callback(err);    
});

function process_record(record, callback) {

    // quit on "false" value
    if (record===false) return exit_callback();

    var indicators_record = ind_collection.update_and_evaluate();
    var output_record = _.extend(record, indicators_record);

    input_streams[0].next();
    input_streams[0].set(output_record);

    async.eachSeries(delegates, function(dlg, cb) {
        dlg.update(cb);
    }, function(err) {
        if (err) return exit_callback(err);
        callback();
    });

}

function on_delegate_event(delegate_name, event, args) {
    console.log("### event["+delegate_name+"] ("+event+"): "+JSON.stringify(args));
}
