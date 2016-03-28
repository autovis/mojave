'use strict';

var fs = require('fs');
var _ = require('lodash');
var path = require('path');
var JsonDB = require('node-json-db');

const debug = true; // enable debug messages

const default_config = {
    save_interval: 30 // time interval in which changes are saved
};

var selections = {}; // keep json files open

// Save changes to fs every 'save_interval' seconds

function get(connection, config) {
    if (!config.srcpath[1]) throw new Error('Selection ID expected in source path');
    var db = get_db(config.srcpath[1]);
    connection.end();
    return true;
}

function put(connection, config) {
    var db = get_db(config.selection);
    db.push();
    return true;
}

/////////////////////////////////////////////////////////////////////////////////////////

function get_db(sel_id) {
    if (_.has(selections, sel_id)) {
        return selections[sel_id];
    } else {
        var db = new JsonDB(path.join('../common/data/selections', sel_id), true, true); // params: (filename, autosave, human-readable)
        // initialize json document structure
        db.push('/', {
            selections: []
        });
        selections[sel_id] = db;
        setInterval(() => db.save(), default_config.save_interval * 1000);
        return db;
    }
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
