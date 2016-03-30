'use strict';

var _ = require('lodash');
var path = require('path');
var query = require('pg-query');

var requirejs = require('requirejs');
var moment = requirejs('moment-timezone');

const debug = true; // enable debug messages

const default_config = {
};

query.connectionParameters = process.env.DATABASE_URL;

// Save changes to fs every 'save_interval' seconds

function get(connection, config) {
    if (!config.srcpath[1]) throw new Error('Selection ID expected in source path');
    var selection_id = srcpath[1];
    var condition = [];
    condition.push(['id = $1', selection_id]);
    var cond = _.unzip(condition);
    var query = 'SELECT * FROM selection_data WHERE ' + cond[0].join(' AND ') + ';';

    ///

    var db = get_db(config.srcpath[1]);
    var selections = db.getData('/selections');
    _.each(selections, sel => {
        if (sel.date) sel.date = new Date(moment(sel.date).toDate());
    });
    selections = _.sortBy(selections, sel => sel.date);
    setTimeout(() => {

  console.log('Connected to postgres! Getting schemas...');

  dbclient.query('SELECT * FROM selection_data WHERE id = $1;')
    .on('row', row => {
      console.log(JSON.stringify(row));
    });

        _.each(selections, sel => {
            connection.transmit_data('dated', sel);
        });
        connection.end();
    }, 0);
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
        var db = new JsonDB(path.join(__dirname, '../common/data/selections', sel_id), true, true); // params: (filename, autosave, human-readable)
        // initialize json document structure
        var selections = db.getData('/selections');
        if (_.isEmpty(selections)) {
            db.push('/', {
                selections: []
            });
            db.save();
        }
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
