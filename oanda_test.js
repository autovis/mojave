var fs = require('fs');
var https = require('https');
var _ = require('lodash');

var last;
var tick;

var instrument = "EUR_USD";

var config = {
    account_id: 326049,
    auth: "Bearer "+process.env.OANDA_ACCESS_TOKEN
}

var https_options = {
    method: 'GET',
    host: 'stream-fxpractice.oanda.com',
    path: '/v1/prices?accountId='+process.env.OANDA_ACCOUNT_ID.toString()+'&instruments='+instrument,
    headers: {"Authorization" : "Bearer "+process.env.OANDA_ACCESS_TOKEN},
};

var request = https.request(https_options, function(response) {
    var packet;
    response.on("data", function(chunk) {
        console.log("CHUNK >>>", chunk.toString(), "<<<");
        var match, packet;
        var rest = chunk.toString();
        // Break apart multiple JSON objects bunched together in same response chunk
        while (match = rest.match(/^\s*({(?:[^{}]|{[^{}]*})*})\s*(.*)\s*$/)) {
            packet = JSON.parse(match[1]);
            if (_.has(packet, "tick")) {
                var tick = {date: date2string(new Date(packet.tick.time)), ask: packet.tick.ask, bid: packet.tick.bid};
                console.log("TICK", tick);
                //socket.emit("data", {datasource: datasource, data: tick, type: "tick"});
            }
            rest = match[2];
        }
    });
    response.on('error', function(err, res) {
        console.log("Got error: ", err);
    });
    response.on("end", function() {
        //socket.emit("end", datasource);
        console.log("END DATA.");
    });
});
request.end();

///////////////////////////////////////////////////////////////


function date2string(date) {
    return date.getFullYear() + '-' +
    ('00' + (date.getMonth()+1)).slice(-2) + '-' +
    ('00' + date.getDate()).slice(-2) + ' ' +
    ('00' + date.getHours()).slice(-2) + ':' +
    ('00' + date.getMinutes()).slice(-2) + ':' +
    ('00' + date.getSeconds()).slice(-2);
}