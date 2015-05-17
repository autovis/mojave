'use strict';

var _ = require('lodash');
var path = require('path');

var requirejs = require("requirejs");
require('./local/rjs-config');

var dataprovider = require('./local/dataprovider')();

var client = dataprovider.register("test_client");

var conn1 = client.connect('subscribe', 'oanda:eurusd:m5', {id: 'conn_1'});
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
    conn2.close();
}, 9000);
*/