'use strict';

var _ = require('lodash');
var path = require('path');
var pg = require('pg');

var requirejs = require('requirejs');

const debug = true; // enable debug messages

pg.defaults.ssl = true;
pg.connect(process.env.POSTGRES_URL_SECONDARY, function(err, client) {
  if (err) throw err;
  /*
  client
    .query('SELECT table_schema,table_name FROM information_schema.tables;')
    .on('row', function(row) {
      console.log(JSON.stringify(row));
    });
  */
});

function get(connection, config) {
    return true;
}

function put(connection, config) {

}

module.exports = {
    get: get,
    get_last_period: get,
    get_range: get,
    properties: {
        writable: true,            // allows data to be written to source parameter [put()]
        tick_subscriptions: false, // allows subscriptions to real-time ticks on instruments [subscribe(),unsubscribe()]
        historical_api: false,     // allows dynamic queries based on: instrument/timeframe/(count|range) [get_count(),get_range()]
        single_stream: true,       // source parameter references a single stream of data [get()]
        accepts_orders: false,     // bridges to broker and allows orders to be placed on instruments [place_order()]
        use_interpreter: true      // use interpreter indicator to convert incoming data to native type on inputs
    }
};

