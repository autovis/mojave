var async = require('async');
var _ = require('lodash');
var request = require('request');

if (!process.env.OANDA_ACCOUNT_ID) throw new Error("Environment variable 'OANDA_ACCOUNT_ID' must be defined");
if (!process.env.OANDA_ACCESS_TOKEN) throw new Error("Environment variable 'OANDA_ACCESS_TOKEN' must be defined");

var default_config = {
    timeframe: "m5",
    history: 100, // number of historical bars to fetch when subscribing

    account_id: process.env.OANDA_ACCOUNT_ID,
    auth_token: process.env.OANDA_ACCESS_TOKEN
};

//var api_server = 'https://api-fxpractice.oanda.com';
//var stream_server = 'https://stream-fxpractice.oanda.com';
var api_server = 'http://api-sandbox.oanda.com';
var stream_server = 'http://stream-sandbox.oanda.com';

var instrument_mapping = {
    "audcad": "AUD_CAD",
    "audjpy": "AUD_JPY",
    "audusd": "AUD_USD",
    "eurusd": "EUR_USD",
    "gbpusd": "GBP_USD",
    "usdcad": "USD_CAD",
    "usdchf": "USD_CHF",
    "usdjpy": "USD_JPY",
    "nzdusd": "NZD_USD"
};

function fetch(client, params, options, callback) {
    if (!_.has(instrument_mapping, params[0])) throw new Error("Instrument '" + params[0] + "' not mapped to OANDA equivalent identifier");
    var instrument = instrument_mapping[params[0]];
    var datasource = ["oanda"].concat(params).join(":");
    var config = _.defaults(options, default_config);

    var http_options = {
        method: 'GET',
        url: api_server + '/v1/candles?candleFormat=bidask&granularity=' + (params[1] || config.timeframe).toUpperCase() + '&count=' + (params[2] || config.history) + '&instrument=' + instrument,
        headers: {"Authorization": "Bearer " + config.auth_token},
        gzip: true
    };
    var payload = '';
    var hist_req = request(http_options);
    hist_req.on('data', function(chunk) {
        payload += chunk.toString();
    });
    hist_req.on('end', function() {
        try {
            var resp = JSON.parse(payload);
        } catch (e) {
            return callback(e);
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
            client.queue.push({ds: datasource, event: 'data', type: 'dual_candle_bar', data: bar});
        });
        if (!options.omit_end_marker) client.queue.push({ds: datasource, event: 'end'});
        callback();
    });
    hist_req.on('error', callback);
    hist_req.end();
    return {};
}

function subscribe(client, params, options, callback) {
    if (!_.has(instrument_mapping, params[0])) throw new Error("Instrument '" + params[0] + "' not mapped to OANDA equivalent identifier");
    var instrument = instrument_mapping[params[0]];
    var datasource = ["oanda"].concat(params).join(":");
    var config = _.defaults(options, default_config);

    var http_options = {
        method: 'GET',
        url: stream_server + '/v1/prices?sessionId=mojave01&accountId=' + config.account_id.toString() + '&instruments=' + instrument,
        headers: {'Authorization': 'Bearer ' + config.auth_token},
        gzip: true
    };
    var rates_req = request(http_options);
    rates_req.on("data", function(chunk) {
        var match, packet;
        var rest = chunk.toString();
        // Break apart multiple JSON objects bunched together in same response chunk
        while (match = rest.match(/^\s*({(?:[^{}]|{[^{}]*})*})\s*(.*)\s*$/)) {
            packet = JSON.parse(match[1]);
            if (_.has(packet, "tick")) {
                var tick = {date: date2string(new Date(packet.tick.time)), ask: packet.tick.ask, bid: packet.tick.bid};
                client.queue.push({ds: datasource, event: 'data', type: 'tick', data: tick});
            }
            rest = match[2];
        }
    });
    rates_req.on("error", callback);
    rates_req.on("end", function() {
        if (!options.omit_end_marker) client.queue.push({ds: datasource, event: 'end'});
    });
    rates_req.on("response", function(response) {
        callback();
    });
    rates_req.end();
    return {};
}

function fetch_and_subscribe(client, params, options, callback) {
    async.series([

        // fetch historical candles
        function(cb) {
            fetch(client, params, _.assign(options, {omit_end_marker: true}), cb);
        },

        // real-time rates streaming
        function(cb) {
            subscribe(client, params, options, cb);
        }

    ], callback);
    return {};
}

module.exports = {
    fetch: fetch,
    subscribe: subscribe,
    fetch_and_subscribe: fetch_and_subscribe
};

///////////////////////////////////////////////////

function date2string(date) {
    return date.getFullYear() + '-' +
    ('00' + (date.getMonth()+1)).slice(-2) + '-' +
    ('00' + date.getDate()).slice(-2) + ' ' +
    ('00' + date.getHours()).slice(-2) + ':' +
    ('00' + date.getMinutes()).slice(-2) + ':' +
    ('00' + date.getSeconds()).slice(-2);
}
