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

/////////////////////////////////////////////////////////////////////////////////////////

var streams = {}; // {user => [instrument]}
var subscriptions = {}; // {instrument => [<Connection>]}

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

function subscribe(connection, params, options, callback) {
    if (!_.isFunction(callback)) callback = function() {};
    if (!_.has(instrument_mapping, params[0])) throw Error("Instrument '" + params[0] + "' not mapped to OANDA equivalent identifier");
    var instrument = instrument_mapping[params[0]];
    var options = _.defaults(options, default_config);
    add_subscription(instrument, connection, options);
}

function unsubscribe(connection, params) {
    var instrument = instrument_mapping[params[0]];
    remove_subscription(instrument, connection);
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

function add_subscription(instrument, connection, options) {
    var user = options.user;
    var current_subscriptions = streams
    if (_.isArray(streams[user]) && !_.isEmpty(streams[user])) {

    } else {

    }



    if (_.isArray(subscriptions[instrument]) && !_.isEmpty(subscriptions[instrument])) {
        // TODO: handle cases where connections coming from different OANDA accounts
        subscriptions[instrument].push(connection);
    } else {
        var account_id = accounts.get_value(options.user + '.brokers.oanda.account_id');
        var auth_token = accounts.get_value(options.user + '.brokers.oanda.access_token');
        var http_options = {
            method: 'GET',
            url: stream_server + '/v1/prices?sessionId=mojave01&accountId=' + account_id + '&instruments=' + instrument,
            headers: {'Authorization': 'Bearer ' + auth_token},
            gzip: true
        };
        var stream_request = request(http_options);
        stream_request.on('data', function(chunk) {
            var match, packet;
            var rest = chunk.toString();
            // Break apart multiple JSON objects bunched together in same response chunk
            while (match = rest.match(/^\s*({(?:[^{}]|{[^{}]*})*})\s*(.*)\s*$/)) {
                packet = JSON.parse(match[1]);
                if (_.has(packet, 'tick')) {
                    var tick = {date: date2string(new Date(packet.tick.time)), ask: packet.tick.ask, bid: packet.tick.bid};
                    connection.transmit_data('tick', tick);
                }
                rest = match[2];
            }
        });
        stream_request.on('error', function(err) {
            connection.error(err);
        });
        stream_request.on('end', function() {
            if (!options.omit_end_marker) connection.end();
        });
        stream_request.on('response', function(response) {
            callback();
        });
        stream_request.end();
    }
}

function remove_subscription(instrument, connection) {

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
