'use strict';

var url = require('url');
var _ = require('lodash');
var pg = require('pg');

var requirejs = require('requirejs');
var async = requirejs('async');
var moment = requirejs('moment-timezone');
var uuid = requirejs('node-uuid');

const debug = true; // enable debug messages

var pg_params = url.parse(process.env.POSTGRES_URL_PRIMARY);
var auth = pg_params.auth.split(':');
var pg_client = new pg.Client({
    user: auth[0],
    password: auth[1],
    database: pg_params.pathname.slice(1),
    port: pg_params.port,
    host: pg_params.hostname
    //ssl: true
});

pg_client.connect();

// Save changes to fs every 'save_interval' seconds

function get(connection, config) {
    if (!config.srcpath[1]) throw new Error('Selection ID expected in source path');
    var selection_id = config.srcpath[1];
    var condition = [];
    var vidx = 1;
    condition.push(['sd.sel_uuid = sel.sel_uuid', []]);
    condition.push([`sel.sel_id = $${vidx}`, [selection_id]]);
    vidx += 1;
    if (config.range) {
        if (!_.isArray(config.range)) config.range = [config.range];
        if (config.range.length === 1) {
            condition.push([`sd.date >= $${vidx}`, [config.range[0]]]);
            vidx += 1;
        } else if (config.range.length === 2) {
            condition.push([`(sd.date >= $${vidx} AND sd.date <= $${vidx + 1})`, config.range]);
            vidx += 2;
        } else {
            return connection.error('Unexpected value for "range": ' + JSON.stringify(config.range));
        }
    }
    var cond = _.unzip(condition);
    var query_string = 'SELECT sel.instrument, sd.date, sd.inputs, sd.tags FROM selection_data sd, selections sel WHERE ' + cond[0].join(' AND ') + ' ORDER BY sd.date ASC;';
    var cond_vars = _.flatten(cond[1]);
    if (debug) console.log('QUERY: ', query_string, cond_vars);
    pg_client.query({
        text: query_string,
        values: cond_vars
    }, (err, result) => {
        if (err) throw err;
        _.each(result.rows, row => connection.transmit_data('dated', row));
        connection.end();
    });
    return true;
}

function receive(config, payload) {
    if (!config.id) throw new Error('No selection ID provided');
    var sel_id = config.id;
    var datestr = moment(payload.date).format("YYYY-MM-DD HH:mmZZ");
    var query_string, query_vars;
    var sel_uuid = null;

    async.series([
        function(cb) {
            pg_client.query({
                text: 'SELECT sel_uuid FROM selections WHERE instrument = $1 AND sel_id = $2',
                values: [config.instrument, config.id]
            }, (err, result) => {
                if (err) return cb(err);
                if (result.rows.length > 0) sel_uuid = rows[0].sel_uuid;
                cb();
            });
        },
        function(cb) {
            if (sel_uuid) { // if selection exists, update bounds
                cb();
            } else { // otherwise create new selection
                var srcpath = config.source.split('/');
                sel_uuid = uuid.v4();
                var bounds = '[' + datestr + ',' + datestr + ']';
                pg_client.query({
                    text: 'INSERT INTO selections (sel_uuid, sel_id, origin, instrument, bounds) VALUES ($1, $2, $3, $4, $5)',
                    values: [sel_uuid, sel_id, srcpath[0], config.instrument, bounds]
                }, (err, result) => {
                    cb(err);
                });
            }
        },
        function(cb) {
            var tags_json = JSON.stringify(payload.tags);
            var inputs_json = JSON.stringify(_.zipObject(config.inputs, payload.inputs));
            pg_client.query({
                text: 'INSERT INTO selection_data (sel_data_uuid, sel_uuid, sel_id, date, inputs, tags) VALUES ($1, $2, $3, $4, $5, $6)',
                values: [uuid.v4(), sel_uuid, sel_id, datestr, inputs_json, tags_json]
            }, (err, result) => {
                if (err && parseInt(err.code) === 23505) { // unique-key conflict
                    pg_client.query({
                        text: 'UPDATE selection_data SET tags = $1, inputs = $2 WHERE sel_uuid = $3 AND date = $4',
                        values: [tags_json, inputs_json, sel_uuid, datestr]
                    }, (err, result) => {
                        cb(err);
                    });
                } else {
                    cb(err);
                }
            });
        }
    ], err => {
        if (err) {
            console.error(err);
            throw err;
        }
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
