'use strict';

var request = require('request');
var HttpsAgentKeepAlive = require('agentkeepalive').HttpsAgent;

var requirejs = require('requirejs');
var accounts = requirejs('config/accounts');

var _ = requirejs('lodash');
var async = requirejs('async');
var moment = requirejs('moment');
var timesteps = requirejs('config/timesteps');

// TODO: Replace env var checks with user config checks
if (!process.env.OANDA_ACCOUNT_ID) throw new Error("Environment variable 'OANDA_ACCOUNT_ID' must be defined");
if (!process.env.OANDA_ACCESS_TOKEN) throw new Error("Environment variable 'OANDA_ACCESS_TOKEN' must be defined");

var default_config = {
    user: 'default',
    timeframe: 'm5',
    count: 300, // number of historical bars to fetch when subscribing
    remove_subscription_delay: 30, // seconds to wait before reconnecting rate stream after unsubscribe
    request_throttle: 700 // min number of milliseconds to wait between requests to API server
};

var api_server = 'https://api-fxpractice.oanda.com';
var stream_server = 'https://stream-fxpractice.oanda.com';
//var api_server = 'http://api-sandbox.oanda.com';
//var stream_server = 'http://stream-sandbox.oanda.com';

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

var keepaliveAgent = new HttpsAgentKeepAlive({
    maxSockets: 100,
    maxFreeSockets: 10,
    timeout: 60000,
    keepAliveTimeout: 30000 // free socket keepalive for 30 seconds
});

/////////////////////////////////////////////////////////////////////////////////////////

var user_rates_stream = {}; // {user => {stream: <Stream>, backoff: _, timer: _}}
var user_instruments = {}; // {user => [instrument]} # [instrument] must remain sorted
var instrument_connections = {}; // {instrument => [<Connection>]}

function get_range(connection, config) {
    config = _.defaults(config, default_config);
    if (!_.has(config, 'instrument')) throw new Error('"get_range" connection type must receive "instrument" parameter in config');
    if (!_.has(instrument_mapping, config.instrument)) throw new Error("Instrument '" + config.instrument + "' is not mapped to an OANDA equivalent identifier");
    if (!_.has(config, 'timeframe')) throw new Error('"get_range" connection type must receive "timeframe" parameter in config');

    if (!_.has(config, 'range')) throw new Error('"get_range" connection type must receive "range" parameter in config');
    if (!_.isArray(config.range) || config.range.length < 1) throw new Error('"range" parameter must be an array of minimum length 1');
    config.range = _.map(config.range, function(date) {
        var parsed = moment(date).startOf('second');
        if (!parsed.isValid()) throw Error("Date in 'range' option is invalid: " + date.toString());
        return parsed;
    });

    perform_get(connection, config, config.range.length > 1 ? 'start_end' : 'start');
}

function get_last_period(connection, config) {
    config = _.defaults(config, default_config);
    if (!_.has(config, 'instrument')) throw new Error('"get_last_period" connection type must receive "instrument" parameter in config');
    if (!_.has(instrument_mapping, config.instrument)) throw new Error("Instrument '" + config.instrument + "' is not mapped to an OANDA equivalent identifier");
    if (!_.has(config, 'timeframe')) throw new Error('"get_last_period" connection type must receive "timeframe" parameter in config');

    if (!_.has(config, 'count' || !_.isArray(config.range))) throw new Error('"get_last_period" connection type must receive "count" parameter in config');

    perform_get(connection, config, 'count');
}

// helper function for get_range() and get_last_period()
function perform_get(connection, config, initmode) {

    var instrument = instrument_mapping[config.instrument];
    var timeframe = config.timeframe;
    var auth_token = accounts.get_value(config.user + '.brokers.oanda.access_token');
    var last_datetime;
    // modes: count, start, start_continued, start_end, start_end_long, start_end_long_continued, finished
    var mode = initmode;

    if (timeframe === 'T') mode = 'finished'; // cannot get historical ticks from Oanda

    async.doUntil(function(cb) {

        // sanity check
        if (connection.closed || mode === 'finished') {
            mode = 'finished';
            return cb();
        }

        var iter_start_time = (new Date()).getTime(); // used to throttle API requests

        var api_request_params = {
            candleFormat: 'bidask',
            instrument: instrument,
            granularity: timeframe.toUpperCase()
        };

        // Set up API request based on config
        if (mode === 'start_end') {
            api_request_params.start = config.range[0].format('YYYY-MM-DD[T]HH:mm:ss[Z]');
            api_request_params.end = config.range[1].format('YYYY-MM-DD[T]HH:mm:ss[Z]');
        } else if (mode === 'start' || mode === 'start_end_long') {
            api_request_params.start = config.range[0].format('YYYY-MM-DD[T]HH:mm:ss[Z]');
        } else if (mode === 'start_continued' || mode === 'start_end_long_continued') {
            api_request_params.start = config.range[0].format('YYYY-MM-DD[T]HH:mm:ss[Z]');
            api_request_params.includeFirst = 'false';
        } else if (mode === 'count') {
            api_request_params.count = config.count;
        } else {
            throw Error('Invalid fetch mode: ' + mode);
        }

        var http_options = {
            method: 'GET',
            url: api_server + '/v1/candles?' + _.map(_.pairs(api_request_params), function(p) {return p[0] + '=' + encodeURIComponent(p[1]);}).join('&'),
            headers: {'Authorization': 'Bearer ' + auth_token},
            agent: keepaliveAgent,
            gzip: true
        };

        //console.log('Fetch: ' + http_options.url);

        request(http_options, function(err, res, body) {
            if (err) {
                connection.emit('error', err);
                return cb(err);
            }

            var parsed;
            try {
                parsed = JSON.parse(body);
            } catch (e) {
                connection.emit('error', e);
                return cb(e);
            }

            if (parsed.candles) {
                _.each(parsed.candles, function(candle) {
                    var bar = {
                        date: moment(new Date(candle.time)).toDate(),
                        ask: {
                            open: parseFloat(candle.openAsk),
                            high: parseFloat(candle.highAsk),
                            low: parseFloat(candle.lowAsk),
                            close: parseFloat(candle.closeAsk)
                        },
                        bid: {
                            open: parseFloat(candle.openBid),
                            high: parseFloat(candle.highBid),
                            low: parseFloat(candle.lowBid),
                            close: parseFloat(candle.closeBid)
                        },
                        volume: parseFloat(candle.volume)
                    };
                    try {
                        connection.transmit_data('dual_candle_bar', bar);
                    } catch (e) {
                        mode = 'finished';
                        cb(e);
                        return false;
                    }
                });

                if (parsed.candles.length === 0) {
                    mode = 'finished';
                } else if (mode === 'start' || mode === 'start_continued' || mode === 'start_end_long' || mode === 'start_end_long_continued') {
                    var tf_hash = timesteps.defs[timeframe] && timesteps.defs[timeframe].hash;
                    if (!_.isFunction(tf_hash)) throw Error('Invalid hash function for timeframe: ' + timeframe);
                    last_datetime = moment(_.last(parsed.candles).time);
                    var end_date = moment(tf_hash({date: config.range[1] && config.range[1].toDate() || new Date()}));
                    if (end_date.startOf('second').isAfter(last_datetime.startOf('second'))) {
                        config.range[0] = last_datetime;
                        mode = mode === 'start' ? 'start_continued' : 'start_end_long_continued';
                    } else {
                        mode = 'finished';
                    }
                } else {
                    mode = 'finished';
                }

                // Wait a minimum of `config.request_throttle` milliseconds between API requests
                setTimeout(cb, Math.floor(_.max([config.request_throttle - ((new Date()).getTime() - iter_start_time), 0])));

            } else if (parsed.code) { // API Error
                switch (parseInt(parsed.code)) {
                    case 36:
                        mode = 'start_end_long';
                        return setTimeout(cb, config.request_throttle);
                    default:
                        throw Error('API request retur ned error ' + parsed.code + ': ' + parsed.message);
                }
            } else {
                console.error('Unknown result:', parsed);
            }

        });

    }, function() {return mode === 'finished';}, function(err) {
        if (err) {
            console.error(err);
        }
        if (!config.omit_end_marker) connection.end();
    });
}

function subscribe(connection, config) {
    config = _.defaults(config, default_config);
    if (!_.has(config, 'instrument')) throw new Error('"get_last_period" connection type must receive "instrument" parameter in config');
    if (!_.has(instrument_mapping, config.instrument)) throw new Error("Instrument '" + config.instrument + "' is not mapped to an OANDA equivalent identifier");
    add_subscription(config.instrument, connection, config);
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

function receive_data(connection, packet) {

}

// --------------------------------------------------------------------------------------

function add_subscription(instrument, connection, config) {
    var user = config.user;
    var reconnect_rates_stream = false;
    if (!_.has(user_rates_stream, user)) user_rates_stream[user] = {};

    // Subscribe user to instrument and reconnect stream if not already subscribed
    if (_.isArray(user_instruments[user]) && !_.isEmpty(user_instruments[user])) {
        if (_.indexOf(user_instruments[user], instrument) === -1) { // if not subscribed
            user_instruments[user].push(instrument);
            user_instruments[user] = _.sortBy(user_instruments[user], _.identity);
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
        if (user_rates_stream[user].timer) clearTimeout(user_rates_stream[user].timer);
        user_rates_stream[user].timer = setTimeout(function() {
            user_rates_stream[user].backoff_delay = 0;
            update_user_rates_stream_connection(config);
            user_rates_stream[user].timer = null;
        }, 1000); // 1 sec delay to gather all subscriptions made simultaneously
    }
}

function remove_subscription(instrument, connection, config) {
    var user = config.user;
    var reconnect_rates_stream = false;
    if (!_.has(user_rates_stream, user)) user_rates_stream[user] = {};

    // Look for connection to remove from instrument
    if (!_.isEmpty(instrument_connections[instrument])) {
        var connmatch = _.find(instrument_connections[instrument], function(conn) {
            return conn.id === connection.id;
        });
        if (connmatch) { // if connection is subscribed
            connection.end();
            instrument_connections[instrument] = _.reject(instrument_connections[instrument], function(conn) {
                return conn === connection;
            });
            if (_.isEmpty(instrument_connections[instrument])) {
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

    if (reconnect_rates_stream && !user_rates_stream[user].timer) {
        user_rates_stream[user].timer = setTimeout(function() {
            user_rates_stream[user].backoff_delay = 0;
            update_user_rates_stream_connection(config);
            user_rates_stream[user].timer = null;
        }, config.remove_subscription_delay * 1000);
    }
}

function update_user_rates_stream_connection(config) {
    var user = config.user;
    var stream_request = user_rates_stream[user].stream;

    if (user_rates_stream[user].timer) clearTimeout(user_rates_stream[user].timer);

    // Check whether list of subscribed instruments is the same as what current stream is already receiving, if so skip
    //console.log('Checking subscriptions and updating rates stream as needed');
    if (stream_request) {
        var instr_urlstr = stream_request.uri.href.match(/instruments=(.*)$/)[1];
        if (instr_urlstr) {
            var current_instruments = _.sortBy(instr_urlstr.split('%2C').map(function(str) {
                return instrument_mapping_reversed[str];
            }), _.identity);
            // Quit if lists are the same
            if (current_instruments.join(',') === user_instruments[user].join(',')) {
                return;
            }
        }
    }

    // Disconnect and delete old stream if exists
    if (stream_request) {
        stream_request.abort();
        user_rates_stream[user].stream = null;
        return;
    }

    if (_.isEmpty(user_instruments[user])) {
        //console.log('No subscriptions currently active - remaining disconnected');
        return;
    }

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
        json: false,
        gzip: true
    };

    stream_request = request(http_options);
    stream_request.on('data', function(chunk) {
        var match, packet;
        var rest = chunk.toString();
        // Break apart multiple JSON objects bunched together in same response chunk
        while (match = rest.match(/^\s*({(?:[^{}]|{[^{}]*})*})\s*(.*)\s*$/)) {
            try {
                packet = JSON.parse(match[1]);
            } catch (e) {
                console.error("Unable to parse chunk: '" + match[1] + "' : " + e.toString());
                rest = match[2];
                continue;
            }
            if (_.has(packet, 'tick')) {
                var instrument = instrument_mapping_reversed[packet.tick.instrument];
                if (!instrument) throw Error('Tick packet has undefined instrument: ' + JSON.stringify(packet.tick));
                var tick = {
                    date: new Date(packet.tick.time),
                    ask: parseFloat(packet.tick.ask),
                    bid: parseFloat(packet.tick.bid)
                };
                _.each(instrument_connections[instrument], function(conn) {
                    conn.transmit_data('tick', tick);
                });
            } else if (_.has(packet, 'heartbeat')) {
            } else if (_.has(packet, 'code')) {
                console.error('OANDA API Error: ' + match[1]);
                return;
            } else {
                console.error('Unrecognized packet received from OANDA streaming API: ', match[1]);
            }
            rest = match[2];
        }
    });
    stream_request.on('error', function(err) {
        console.error('HTTP connection error from OANDA streaming API: ', err);
    });
    stream_request.on('end', function() {
        reconnect_user_rates_stream(config); // if stream ends, reconnect
    });
    stream_request.on('response', function(response) {
        if (response.statusCode === 200) {
            user_rates_stream[user].reconnecting = false;
            if (user_rates_stream[user].backoff_timer) clearTimeout(user_rates_stream[user].backoff_timer);
            user_rates_stream[user].backoff_delay = 0;
        } else if (response.statusCode >= 400) {
            console.error('HTTP status code ' + response.statusCode + ' error from OANDA streaming API');
        } else {
            console.error('Unexpected HTTP status code: ' + response.statusCode);
        }
    });
    stream_request.end();

    // -------------------------------------

    user_rates_stream[user].stream = stream_request;
    //debug_stream_connections();
}

function reconnect_user_rates_stream(config) {
    var user = config.user;

    if (user_rates_stream[user].stream) user_rates_stream[user].stream.abort();
    user_rates_stream[user].stream = null;
    user_rates_stream[user].reconnecting = true;
    //console.log('Reconnecting to OANDA API' + (user_rates_stream[user].backoff_delay === 0 ? '...' : 'in ' + user_rates_stream[user].backoff_delay + ' second(s)...'));
    user_rates_stream[user].backoff_timer = setTimeout(function() {
        update_user_rates_stream_connection(config);
    }, user_rates_stream[user].backoff_delay * 1000);
    // multiply backoff delay by two for next iteration, until just under an hour
    if (user_rates_stream[user].backoff_delay === 0) user_rates_stream[user].backoff_delay = 1;
    else if (user_rates_stream[user].backoff_delay < 60 * 60 * 1000) user_rates_stream[user].backoff_delay *= 2;
}

function debug_stream_connections() {
    console.log('user_rates_stream', _.object(_.map(user_rates_stream, function(obj, user) {
        return [user, _.has(obj, 'stream') ? obj.stream.uri.href : obj.toString()];
    })));
    console.log('user_instruments', user_instruments);
    console.log('instrument_connections', instrument_connections);
}

// ======================================================================================

module.exports = {
    get_range: get_range,
    get_last_period: get_last_period,
    subscribe: subscribe,
    unsubscribe: unsubscribe,
    receive_data: receive_data,
    use_interpreter: false
};
