'use strict';

var fs = require('fs');
var csv = require('csv');
var _ = require('lodash');
var path = require('path');
var csv_parse = require('csv-parse');

var debug = true; // enable debug messages

var default_config = {};

function get(connection, config) {

    if (debug) console.log('New CSV connection: ' + JSON.stringify(config));

    if (!config.type) throw new Error('"type" config parameter expected');

    config = _.defaults(config, default_config);

    var csv_path = path.join.apply(config.srcpath, [__dirname, '../common/data'].concat(_.rest(config.srcpath))) + '.csv';

    var parser = csv_parse();
    var first = true;
    var header = [];
    var record;

    parser.on('readable', function(){
        while (record = parser.read()) {
            if (connection.closed) break;
            if (first) {
                header = record;
                first = false;
            }
            var data = _.zipObject(header, record);
            connection.transmit_data(config.type, data);
            if (debug) console.log(data);
        }
    });
    parser.on('error', function(err) {
      connection.emit('error', err);
      console.log(err.message);
    });
    parser.on('finish', function() {
        if (!config.omit_end_marker) connection.end();
    });

    var inputstream = fs.createReadStream(csv_path);

    inputstream.on('data', function(chunk) {
        parser.write(chunk);
    });
    inputstream.on('end', function () {  // done
        parser.end();
    });

    connection.on('closed', function() {
        parser.end();
        parser = null;
    });

    return true;
}

function put(connection, config) {
    throw new Error("'put' not supported");
}

module.exports = {
    get: get,
    put: put,
    properties: {
        writable: true,            // allows data to be written to source parameter [put()]
        tick_subscriptions: false, // allows subscriptions to real-time ticks on instruments [subscribe(),unsubscribe()]
        historical_api: false,     // allows dynamic queries based on: instrument/timeframe/(count|range) [get_count(),get_range()]
        single_stream: true,       // source parameter references a single stream of data [get()]
        accepts_orders: false,     // bridges to broker and allows orders to be placed on instruments [place_order()]
        use_interpreter: true      // use interpreter indicator to convert incoming data to native type on inputs
    }
};
