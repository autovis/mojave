var url = require('url');
var zmq = require('zeromq');
var pg = require('pg');
var moment = require('moment');
var async = require('async');
var _ = require('lodash');

var socket = zmq.socket('sub');

/////////////////////////////////////////////////////////////////////////////////////////

//pg.defaults.ssl = true;

var zmq_sub_port = 2027;
var postgres_url = process.env.POSTGRES_URL_SECONDARY || 'postgres://postgres:postgres@localhost:5432/mojave_secondary';

var pg_params = url.parse(postgres_url);
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

var subscribed = {};

/////////////////////////////////////////////////////////////////////////////////////////

socket.connect('tcp://127.0.0.1:' + zmq_sub_port);
socket.subscribe('');

socket.on('message', function(msg_text) {
    var msg = {};
    try {
        msg = parse_message(msg_text);
    } catch (e) {
        console.error(e.message);
        return;
    }

    if (msg.type === 'tick') {

        var srckey = msg.srckey;
        var segment_id = null;
        var instr = srckey;
        var tstep = normalize_instrument('*');
        var datetime = moment.unix(msg.body.currenttime).toDate();
        var json_data = {
            date: datetime,
            bid: msg.body.bid,
            ask: msg.body.ask
        };

        console.log('tick:', JSON.stringify(json_data));

        async.waterfall([

            // Create new segment if not exists
            cb => {
                if (srckey && _.has(subscribed, srckey)) {
                    subscribed[srckey].lastseen = moment();
                    segment_id = subscribed[srckey].segment;
                    cb();
                } else {
                    var segment_name = 'mt4_record:' + moment().format('YYYY-MM-DD h:ma');
                    segment_id = create_segment(segment_name, instr, tstep, function(err, segment_id) {
                        if (err) return cb(err);
                        subscribed[srckey] = {
                            segment: segment_id,
                            lastseen: moment()
                        };
                        cb();
                    });
                }
            },

            // Append to segment data
            cb => {
                add_segment_data(segment_id, datetime, json_data, cb);
            }

        ], function(err) {
            if (err) {
                console.error(err);
            }
        });

    } else {
        console.log(msg.type + ':');
    }
});

function parse_message(msg_text) {
    var msg_parts = msg_text.toString().match(/^([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)$/);
    if (msg_parts) {
        var [nil, msg_type, srckey, unk, unixtime, format, body_str] = msg_parts;
        var msg_tstamp = moment.unix(unixtime).format("YYYY-MM-DD HH:mm:ss");
        var body;
        if (format === 'json') {
            body = JSON.parse(body_str);
        } else {
            throw new Error('Unknown msg format: ' + format);
        }
        return {
            type: msg_type,
            srckey: srckey,
            timestamp: msg_tstamp,
            body: body
        }
    } else {
        throw new Error('Cannot parse message: ' + msg_text.toString());
    }
}

function create_segment(name, timestep, instrument, callback) {
    pg_client.query({
        text: 'INSERT INTO segments (name, timestep, instrument) VALUES ($1, $2, $3) RETURNING id',
        values: [name, timestep, instrument]
    }, (err, result) => {
        if (err) return callback(err);
        segment_id = result.rows[0].id;
        callback(null, segment_id);
    });
}

function add_segment_data(segment_id, datetime, json_data, callback) {
    pg_client.query({
        text: 'INSERT INTO segment_data (seg_id, datetime, data) VALUES ($1, $2, $3)',
        values: [segment_id, datetime, JSON.stringify(json_data)]
    }, (err, result) => {
        if (err) return callback(err);
        callback();
    });
}

function normalize_instrument(instr) {
    return instr;
}
