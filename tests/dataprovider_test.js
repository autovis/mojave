'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var requirejs = require('requirejs');
require('../local/rjs-config');

var dataprovider = require('../local/dataprovider')();

var client = dataprovider.register('test_client');

var fetch1 = client.connect('get_range', {
    source: 'oanda',
    instrument: 'eurusd',
    timeframe: 'm5',
    range: ['2015-12-01']
});

var filedata = '';
fetch1.on('data', function(data) {
    filedata += JSON.stringify(data) + '\n';
});

fetch1.on('end', function() {
    fs.writeFile(path.join(__dirname, 'data/dp_test_output.txt'), filedata, function(err) {
        if (err) console.error(err);
        console.log('Done.');
        //process.exit();
    });
});

var conn1 = client.connect('subscribe', {
    source: 'oanda',
    instrument: 'eurusd',
    id: 'conn_1'
});
conn1.on('data', function(data) {
    console.log('conn1: ', data);
});

/*
var conn2 = client.connect('subscribe', 'oanda:gbpusd:m5', {id: 'conn_2'});
conn2.on('data', function(data) {
    console.log('conn2: ', data);
});

setTimeout(function() {
    conn1.close();
}, 3000);

setTimeout(function() {
    var conn3 = client.connect('subscribe', 'oanda:eurusd:m5', {id: 'conn_3'});
    conn3.on('data', function(data) {
        console.log('conn3: ', data);
    });
}, 30000)
*/

///////////////////////////////////////////////////////////////////

/*
setTimeout(function() {
    conn1.close();
}, 9000);

setTimeout(function() {
    var conn4 = client.connect('subscribe', 'oanda:eurusd:m5', {id: 'conn_4'});
    conn4.on('data', function(data) {
        console.log('conn1: ', data);
    });
}, 20000);

var timer_val = 1;
function timer() {
    setTimeout(function() {
        console.log("TIMER: " + timer_val);
        timer_val++;
        timer();
    }, 1000);
}
timer();
*/