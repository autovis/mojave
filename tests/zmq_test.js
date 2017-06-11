var zmq = require('zeromq')
var moment = require('moment');

var socket = zmq.socket('sub');
socket.connect('tcp://127.0.0.1:2027');
socket.subscribe('');

socket.on('message', function(msg_text) {
  var msg = parse_message(msg_text);
  console.log(msg);
});

function parse_message(msg_text) {
  var msg_parts = msg_text.toString().match(/^([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)\|([^\|]+)$/);
  if (msg_parts) {
    var [nil, msg_type, instr, unk, unixtime, format, body_str] = msg_parts;
    var msg_tstamp = moment.unix(unixtime).format("YYYY-MM-DD HH:mm:ss");
    var body;
    if (format === 'json') {
      body = JSON.parse(body_str);
    } else {
      throw new Error('Unknown msg format: ' + format);
    }
    return {
      type: msg_type,
      instrument: instr,
      timestamp: msg_tstamp,
      body: body
    }
  } else {
    throw new Error('Cannot parse message: ' + msg_text.toString());
  }
}