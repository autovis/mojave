'use strict';
var async = require('async');
var _ = require('lodash');
var request = require('request');

var requirejs = require('requirejs');
var accounts = requirejs('config/accounts');

if (!process.env.OANDA_ACCOUNT_ID) throw new Error("Environment variable 'OANDA_ACCOUNT_ID' must be defined");
if (!process.env.OANDA_ACCESS_TOKEN) throw new Error("Environment variable 'OANDA_ACCESS_TOKEN' must be defined");

var default_config = {
    user: 'default',
    timeframe: 'm5',
    history: 100, // number of historical bars to fetch when subscribing
};

//var api_server = 'https://api-fxpractice.oanda.com';
//var stream_server = 'https://stream-fxpractice.oanda.com';
var api_server = 'http://api-sandbox.oanda.com';
var stream_server = 'http://stream-sandbox.oanda.com';

var instrument_mapping = {
    'audcad': 'AUD_CAD',
    'audjpy': 'AUD_JPY',
    'audusd': 'AUD_USD',
    'eurusd': 'EUR_USD',
    'gbpusd': 'GBP_USD',
    'usdcad': 'USD_CAD',
    'usdchf': 'USD_CHF',
    'usdjpy': 'USD_JPY',
    'nzdusd': 'NZD_USD'
};

var instrument_mapping_reversed = _.invert(instrument_mapping);

/////////////////////////////////////////////////////////////////////////////////////////

var user_streams = {}; // {user => <Stream>}
var user_instruments = {}; // {user => [instrument]}
var instrument_connections = {}; // {instrument => [<Connection>]}

function fetch(connection, params, options, callback) {
    if (!_.isFunction(callback)) callback = function() {};
    if (!_.has(instrument_mapping, params[0])) throw new Error("Instrument '" + params[0] + "' not mapped to OANDA equivalent identifier");
    var instrument = instrument_mapping[params[0]];
    options = _.defaults(options, default_config);

    var auth_token = accounts.get_value(options.user + '.brokers.oanda.access_token');
    var http_options = {
        method: 'GET',
        url: api_server + '/v1/candles?candleFormat=bidask&granularity=' + (params[1] || options.timeframe).toUpperCase() + '&count=' + (params[2] || options.history) + '&instrument=' + instrument,
        headers: {'Authorization': 'Bearer ' + auth_token},
        gzip: true
    };
    var payload = '';
    var hist_req = request(http_options);
    hist_req.on('data', function(chunk) {
        payload += chunk.toString();
    });
    hist_req.on('end', function() {
        var resp;
        try {
            resp = JSON.parse(payload);
        } catch (e) {
            connection.emit('error', e);
            return;
        }
        _.each(resp.candles, function(candle) {
            var bar = {
                date: date2string(new Date(candle.time)),
                ask: {
                    open: candle.openAsk,
                    high: candle.highAsk,
                    low: candle.lowAsk,
                    close: candle.closeAsk
                },
                bid: {
                    open: candle.openBid,
                    high: candle.highBid,
                    low: candle.lowBid,
                    close: candle.closeBid
                },
                volume: candle.volume
            };
            connection.transmit_data('dual_candle_bar', bar);
        });
        if (!options.omit_end_marker) connection.end();
        callback();
    });
    hist_req.on('error', callback);
    hist_req.end();
}

function subscribe(connection, params, config, callback) {
    if (!_.isFunction(callback)) callback = function() {};
    if (!_.has(instrument_mapping, params[0])) throw Error("Instrument '" + params[0] + "' not mapped to equivalent identifier in OANDA API");
    config = _.defaults(config, default_config);
    add_subscription(params[0], connection, config);
}

function unsubscribe(connection, config) {

    // find connection in instrument_connections and return instrument
    var instrument = _.findKey(instrument_connections, function(connections, instr) {
        return _.find(connections, function(conn) {
            return conn.id === connection.id;
        });
    });

    config = _.defaults(config, default_config);
    remove_subscription(instrument, connection, config);
}

function fetch_and_subscribe(connection, params, options, callback) {
    if (!_.isFunction(callback)) callback = function() {};
    async.series([

        // fetch historical candles
        function(cb) {
            fetch(connection, params, _.assign(options, {omit_end_marker: true}), cb);
        },

        // real-time rates streaming
        function(cb) {
            subscribe(connection, params, options, cb);
        }

    ], callback);
}

function receive_data(connection, msg) {

}

// --------------------------------------------------------------------------------------

function add_subscription(instrument, connection, config) {
    var user = config.user;
    var reconnect_rates_stream = false;

    // Subscribe user to instrument and reconnect stream if not already subscribed
    if (_.isArray(user_instruments[user]) && !_.isEmpty(user_instruments[user])) {
        if (_.indexOf(user_instruments[user], instrument) === -1) { // if not subscribed
            user_instruments[user].push(instrument);
            reconnect_rates_stream = true;
        }
    } else {
        user_instruments[user] = [instrument];
        reconnect_rates_stream = true;
    }

    // Subscribe connection to instrument
    if (_.isArray(instrument_connections[instrument]) && !_.isEmpty(instrument_connections[instrument])) {
        instrument_connections[instrument].push(connection);
    } else {
        instrument_connections[instrument] = [connection];
    }

    if (reconnect_rates_stream) {
        create_user_stream(connection, config);
    }

    console.log("### ADD SUBSCRIPTION:", instrument, connection.id);
    debug_states();
}

function remove_subscription(instrument, connection, config) {
    var user = config.user;
    var reconnect_rates_stream = false;

    // Look for connection to remove from instrument
    if (!_.isEmpty(instrument_connections[instrument])) {
        var connmatch = _.find(instrument_connections[instrument], function(conn) {
            return conn.id === connection.id;
        });
        if (connmatch) { // if connection is subscribed
            connection.end();
            var connections = _.reject(instrument_connections[instrument], function(conn) {
                return conn === connection;
            });
            if (_.isEmpty(connections)) {
                delete instrument_connections[instrument];
                // Unsubscribe user from instrument and reconnect stream if subscribed
                if (_.isArray(user_instruments[user]) && !_.isEmpty(user_instruments[user])) {
                    if (user_instruments[user].indexOf(instrument) > -1) { // if subscribed
                        user_instruments[user] = _.reject(user_instruments[user], function(instr) {
                            return instr === instrument;
                        });
                        reconnect_rates_stream = true;
                    }
                }
            }
        }
    }

    if (reconnect_rates_stream) {
        create_user_stream(connection, config);
    }

    console.log("### REMOVE SUBSCRIPTION:", instrument, connection.id);
    debug_states();
}

function debug_states() {
    console.log("user_streams ----------------------");
    _.each(user_streams, function(val, key) {
        process.stdout.write(key + ' -> ' + val.uri.href + '\n');
    });
    console.log("user_instruments ------------------");
    _.each(user_instruments, function(val, key) {
        process.stdout.write(key + ' -> ' + val.toString() + '\n');
    });
    console.log("instrument_connections ------------");
    console.log(instrument_connections);
}


function create_user_stream(connection, config) {
    var user = config.user;

    // Disconnect and delete old stream if exists
    var stream_request = user_streams[user];
    if (user_streams[user]) {
        user_streams[user].abort();
        delete user_streams[user];
    }

    if (_.isEmpty(user_instruments[user])) return; // skip stream request creation if not subscribed to any instruments

    // Create new stream using current subscriptions
    var account_id = accounts.get_value(config.user + '.brokers.oanda.account_id');
    var auth_token = accounts.get_value(config.user + '.brokers.oanda.access_token');
    var instruments_url_str = _.map(user_instruments[user], function(instr) {
        return instrument_mapping[instr];
    }).join('%2C');
    var http_options = {
        method: 'GET',
        url: stream_server + '/v1/prices?sessionId=' + user + '&accountId=' + account_id + '&instruments=' + instruments_url_str,
        headers: {'Authorization': 'Bearer ' + auth_token},
        gzip: true
    };
    stream_request = request(http_options);
    stream_request.on('data', function(chunk) {
        var match, packet;
        var rest = chunk.toString();
        // Break apart multiple JSON objects bunched together in same response chunk
        while (match = rest.match(/^\s*({(?:[^{}]|{[^{}]*})*})\s*(.*)\s*$/)) {
            packet = JSON.parse(match[1]);
            if (_.has(packet, 'tick')) {
                var instrument = instrument_mapping_reversed[packet.tick.instrument];
                if (!instrument) throw Error('Tick packet has undefined instrument: ' + JSON.stringify(packet.tick));
                var tick = {date: date2string(new Date(packet.tick.time)), ask: packet.tick.ask, bid: packet.tick.bid};
                _.each(instrument_connections[instrument], function(conn) {
                    conn.transmit_data('tick', tick);
                });
            }
            rest = match[2];
        }
    });
    stream_request.on('error', function(err) {
        // get unique list clients of all connections
        var clients = _.uniq(_.pluck(_.flatten(_.values(instrument_connections)), 'client'), false, function(cl) {
            return cl.id
        });
        // transmit error to each client
        _.each(clients, function(cl) {
            cl.emit('error', err);
        });
        console.error(err);
    });
    stream_request.on('end', function() {
        _.each(user_instruments[user], function(instrument) {
            _.each(instrument_connections[instrument], function(conn) {
                conn.end();
            });
        });
    });
    stream_request.on('response', function(response) {
        //callback();
    });
    stream_request.end();

    user_streams[user] = stream_request;
}

// ======================================================================================

module.exports = {
    fetch: fetch,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    fetch_and_subscribe: fetch_and_subscribe,
    receive_data: receive_data
};

/////////////////////////////////////////////////////////////////////////////////////////

function date2string(date) {
    return date.getFullYear() + '-' +
    ('00' + (date.getMonth() + 1)).slice(-2) + '-' +
    ('00' + date.getDate()).slice(-2) + ' ' +
    ('00' + date.getHours()).slice(-2) + ':' +
    ('00' + date.getMinutes()).slice(-2) + ':' +
    ('00' + date.getSeconds()).slice(-2);
}
