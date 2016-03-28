var zmq = require('zmq')
var socket = zmq.socket('sub');

socket.connect('tcp://127.0.0.1:2027');
socket.subscribe('');

socket.on('message', function(msg) {
  console.log(msg.toString());
});
