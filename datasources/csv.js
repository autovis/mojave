'use strict';

var fs = require('fs');
var _ = require('lodash');
var path = require('path');
var csv_parse = require('csv-parse');

const debug = true; // enable debug messages

const default_config = {
    csv_delimiter: ';',
    csv_date_format: 'YYYYMMDD HHmmss',
    csv_header: [],
    count: 1000
};

function get(connection, config) {

    if (debug) console.log('New CSV connection: ' + JSON.stringify(config));

    if (!config.type) throw new Error('"type" config parameter expected');

    config = _.defaults(config, default_config);

    var csv_path = path.join.apply(config.srcpath, [__dirname, '../common/data'].concat(_.drop(config.srcpath))) + '.csv';

    var parser = csv_parse();
    var first = true;
    var record;

    parser.on('readable', () => {
        let line = -1;
        while (record = parser.read()) {
            line += 1;
            if (connection.closed) break;
            if (first && _.isEmpty(config.header)) {
                config.csv_header = record;
                first = false;
                continue;
            }
            var data = _.fromPairs(config.csv_header, record);
            connection.transmit_data(config.type, data);
            if (debug) console.log(data);
        }
    });
    parser.on('error', err => {
        connection.emit('error', err);
        console.log(err.message);
    });
    parser.on('finish', () => {
        if (!config.omit_end_marker) connection.end();
    });

    var inputstream = fs.createReadStream(csv_path);

    inputstream.on('data', chunk => {
        parser.write(chunk);
    });
    inputstream.on('end', () => {  // done
        parser.end();
    });

    connection.on('closed', () => {
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
