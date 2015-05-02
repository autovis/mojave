var http = require('http');
var https = require('https');
var requirejs = require('requirejs');

var async = requirejs('async');
var _ = requirejs('underscore');

if (!process.env.OANDA_ACCOUNT_ID) throw new Error("Environment variable 'OANDA_ACCOUNT_ID' must be defined");
if (!process.env.OANDA_ACCESS_TOKEN) throw new Error("Environment variable 'OANDA_ACCESS_TOKEN' must be defined");

var default_config = {
    timeframe: "m5",
    history: 100, // number of historical bars to fetch when subscribing

    account_id: process.env.OANDA_ACCOUNT_ID,
    auth_token: process.env.OANDA_ACCESS_TOKEN
}

//var oanda_server = 'fxpractice.oanda.com';
var oanda_server = 'sandbox.oanda.com';

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
}

function subscribe(socket, params, options) {
    if (!_.has(instrument_mapping, params[0])) throw new Error("Instrument '"+params[0]+"' not mapped to OANDA equivalent identifier");
    var instrument = instrument_mapping[params[0]];
    var datasource = ["oanda"].concat(params).join(":");
    var config = _.defaults(options, default_config);
    var payload = "";
    async.series([

        function(cb) { // historical candles
            var https_options = {
                method: 'GET',
                host: 'api-' + oanda_server,
                path: '/v1/candles?candleFormat=bidask&granularity='+(params[1] || config.timeframe).toUpperCase()+'&count='+config.history+'&instrument='+instrument,
                headers: {"Authorization" : "Bearer "+config.auth_token},
            };
            var request = https.request(https_options, function(response) {
                response.on("data", function(chunk) {
                    payload += chunk;
                });
                response.on("end", function() {
                    var response = JSON.parse(payload);
                    if (response.code) {
                        socket.emit("server_error", response);
                        cb(response);
                    };
                    _.each(response.candles, function(candle) {
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
                        socket.emit("data", {datasource: datasource, data: bar, type: "candle"});
                    })
                    cb();
                });
            });
            request.on('error', function(err) {
                socket.emit("server_error", err);
                cb(err);
            });
            request.end();
        },

        function(cb) { // real-time tick streaming
            var https_options = {
                method: 'GET',
                host: 'stream-' + oanda_server,
                path: '/v1/prices?accountId='+config.account_id.toString()+'&instruments='+instrument,
                headers: {"Authorization" : "Bearer "+config.auth_token},
            };
            var request = http.request(https_options, function(response) {
                var packet;
                response.on("data", function(chunk) {
                    var match, packet;
                    var rest = chunk.toString();
                    // Break apart multiple JSON objects bunched together in same response chunk
                    while (match = rest.match(/^\s*({(?:[^{}]|{[^{}]*})*})\s*(.*)\s*$/)) {
                        packet = JSON.parse(match[1]);
                        if (_.has(packet, "tick")) {
                            var tick = {date: date2string(new Date(packet.tick.time)), ask: packet.tick.ask, bid: packet.tick.bid};
                            socket.emit("data", {datasource: datasource, data: tick, type: "tick"});
                        }
                        rest = match[2];
                    }
                    cb();
                });
                response.on("error", function(err) {
                    socket.emit("server_error", err);
                    cb(err);
                });
                response.on("end", function() {
                    socket.emit("end", datasource);
                });
            });
            request.end();
        }
    ], function(err) {
        if (err) {
            console.error(err);
        }
    });

    return true;
}

module.exports = {
    subscribe: subscribe
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
