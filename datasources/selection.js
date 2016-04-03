'use strict';

var _ = require('lodash');
var path = require('path');
var query = require('pg-query');

var requirejs = require('requirejs');
var moment = requirejs('moment-timezone');
var uuid = requirejs('node-uuid');

const debug = true; // enable debug messages

query.connectionParameters = process.env.DATABASE_URL;

// Save changes to fs every 'save_interval' seconds

function get(connection, config) {
    if (!config.srcpath[1]) throw new Error('Selection ID expected in source path');
    var selection_id = config.srcpath[1];
    var condition = [];
    var vidx = 1;
    condition.push([`sel_id = $${vidx}`, [selection_id]]);
    vidx += 1;
    if (config.range) {
        if (!_.isArray(config.range)) config.range = [config.range];
        if (config.range.length === 1) {
            condition.push([`date >= $${vidx}`, [config.range[0]]]);
            vidx += 1;
        } else if (config.range.length === 2) {
            condition.push([`(date >= $${vidx} AND date <= $${vidx + 1})`, config.range]);
            vidx += 2;
        } else {
            return connection.error('Unexpected value for "range": ' + JSON.stringify(config.range));
        }
    }
    var cond = _.unzip(condition);
    var query_string = 'SELECT date, inputs, tags FROM selection_data WHERE ' + cond[0].join(' AND ') + ' ORDER BY date ASC;';
    var cond_vars = _.flatten(cond[1]);
    if (debug) console.log('Query: ', query_string, cond_vars);
    query(query_string, cond_vars, (err, rows, result) => {
        if (err) throw err;
        _.each(rows, row => connection.transmit_data('dated', row));
        connection.end();
    });
    return true;
}

function receive(config, payload) {
    if (!config.id) throw new Error('No selection ID provided');
    var sel_id = config.id;
    var query_string = 'SELECT sel_uuid FROM selections WHERE sel_id = $1';
    var query_vars = [config.id];
    query(query_string, query_vars, (err, rows, results) => {
        if (err) throw err;
        var sel_uuid = rows[0].sel_uuid;
        query_string = 'INSERT INTO selection_data (sel_data_uuid, sel_uuid, sel_id, date, inputs, tags) VALUES ($1, $2, $3, $4, $5, $6)';
        var datestr = moment(payload.date).format("YYYY-MM-DD HH:mmZZ");
        query_vars = [uuid.v4(), sel_uuid, sel_id, datestr, JSON.stringify(_.zipObject(config.inputs, payload.inputs)), JSON.stringify(payload.tags)];
        query(query_string, query_vars, (err, rows, results) => {
            if (err) throw err;
        });
    });
}

/////////////////////////////////////////////////////////////////////////////////////////

module.exports = {
    get: get,
    receive: receive,
    properties: {
        writable: true,            // allows data to be written to source parameter [put()]
        tick_subscriptions: false, // allows subscriptions to real-time ticks on instruments [subscribe(),unsubscribe()]
        historical_api: false,     // allows dynamic queries based on: instrument/timeframe/(count|range) [get_count(),get_range()]
        single_stream: true,       // source parameter references a single stream of data [get()]
        accepts_orders: false,     // bridges to broker and allows orders to be placed on instruments [place_order()]
        use_interpreter: true      // use interpreter indicator to convert incoming data to native type on inputs
    }
};
