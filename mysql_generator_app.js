var fs = require("fs");
var path = require("path");
var mysql = require("mysql");

var requirejs = require("requirejs").config({

    baseUrl: path.join(__dirname, "common"),

    shim: {
        'simple-statistics': {
            exports: 'ss'
        }
    },

    paths: {
        'underscore': 'lib/underscore',
        'async': 'lib/async',
        'd3': 'lib/d3_stripped',
        'machina': 'lib/machina',
        'moment': 'lib/moment.min',
        'simple-statistics': 'lib/simple-statistics',
        'eventemitter2': 'lib/eventemitter2'
    },

    nodeRequire: require
});

var _ = requirejs("underscore");
var async = requirejs("async");
var Stream = requirejs("stream");
var stream_types = requirejs("config/stream_types");
var IndicatorCollection = requirejs("indicator_collection");

// ################################################################################################

var config = {

    mysql_source: {
        host     : 'localhost',
        user     : 'root',
        password : '',
        database : 'forex',
        table    : 'obv55kvo'
    },

    input_params: {
        //start: "2007-01-01 00:00:00",
        tf: "m5",
        type: "object"
    },

    output_table: "spot_test",      // table to write indicator output values

    collection: "spot_test",

    // m30 14
    //"stochrsi_s":            ["avg.close",                     "StochRSI", 80, 80, 30, 8],

    cached_rows: 5000,             // max table records fetched at a time
    input_buffer_size: 200,        // max num of bars for input streams
    indicator_buffer_size: 200     // max num of indicator output bars
};

config.indicator_defs = requirejs("collections/"+config.collection);

// ################################################################################################

var read_conn = mysql.createConnection(config.mysql_source);
var write_conn = mysql.createConnection(config.mysql_source);

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

var current_index=0;
var total_rows;

var in_queue = async.queue(process_record, 1);
in_queue.empty = function() {read_conn.resume();}

/*
_.each(config.input_sources, function(val) {
    var strm = new stream(config.input_buffer_size, _.first(val), _.rest(val));
    input_streams.push(strm);
});
*/
var input_streams = [];
(function() { // Support for single source for now
    var strm = new Stream(config.input_buffer_size, "<"+config.mysql_source.table+">", config.input_params);
    strm.type = config.input_params.type;
    input_streams.push(strm);
})();

//try {
    var collection = new IndicatorCollection(config.indicator_defs, input_streams);
//} catch (e) {
//    exit_callback(e);
//}

var record_transporter = stream_types.flatRecordTransporter(collection);
var schema = record_transporter.getSchema();

async.auto({

    read_connect: function(cb) {
        read_conn.connect(cb);
    },

    write_connect: ['read_connect', function(cb) {
        write_conn.connect(cb);
    }],

    check_tables: ['write_connect', function(cb) {
        create_output_table(function(err) {
            if (err) return cb(err);
            cb();
        })
    }],

    get_total_rows: ['check_tables', function(cb) {
        read_conn.query("SELECT COUNT(*) count FROM "+(config.mysql_source.database)+"."+(config.mysql_source.table)+";", function(err, rows) {
            if (err) return cb(err);
            total_rows = rows[0].count;
            cb();
        });
    }],

    process_market_data: ['get_total_rows', function(cb) {

        var condition = ["TRUE"];
        if (config.input_params.start) condition.push("date >= "+read_conn.escape(config.input_params.start));
        if (config.input_params.end) condition.push("date <= "+read_conn.escape(config.input_params.end));
        var condition_str = condition.join(" AND ");

        var query = read_conn.query("SELECT * FROM "+(config.mysql_source.database)+"."+(config.mysql_source.table)+" WHERE "+condition_str+" ORDER BY date;");

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

var rec_count = 0;

function process_record(rec, callback) {
    if (rec===false) return exit_callback();

    ///////////////
    process.stdout.write("\n")
    process.stdout.write("============================================================\n");
    process.stdout.write(rec.date+"\n");
    process.stdout.write("\n")
    ///////////////
    input_streams[0].next();
    input_streams[0].set(rec);
    input_streams[0].emit("update", {timeframes: [config.input_params.tf]});

    //if (rec_count > 1)
    //    process.exit(0);
    rec_count++;

    var output_record = record_transporter.export();
    console.log(output_record);

    out_function(output_record, function(err) {
        if (err) return exit_callback(err);
        current_index++;
        //if (current_index % 1000 == 0) console.log(Math.round(current_index * 100 / total_rows, 2)+"%");
        callback();
    });
}

function out_function(rec, callback) {

    write_conn.query("REPLACE "+config.output_table+" SET ?", rec, function(err) {
        //process.stdout.write('<');
        if (err) {
            console.log("ERROR on REPLACE: ", err);
            console.log("RECORD: ", rec);
            return callback(err);
        }
        return callback();
    });
}

function create_output_table(callback) {

    //var outfields = collection.get_output_fields();
    var table_fields = record_transporter.getSchema();

    write_conn.query("DROP TABLE IF EXISTS "+config.output_table, function(err) {
        if (err) return callback(err);
        var create_sql = "CREATE TABLE "+config.output_table+" (\n";
        create_sql += _.map(table_fields, function (val) {
            if (_.isArray(val))
                return "`"+val[0]+"` "+val[1];
            else
                return "`"+val+"` FLOAT";
        }).join(",\n")+"\n";
        //create_sql += "UNIQUE INDEX `date` (`date`)\n";
        create_sql += ")\n";
        create_sql += "COLLATE='ascii_bin' ENGINE=MyISAM;\n";
        console.log(create_sql);
        write_conn.query(create_sql, callback);
    });

}
