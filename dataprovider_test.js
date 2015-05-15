'use strict';

var _ = require('lodash');
var path = require('path');

var requirejs = require("requirejs");
require('./local/rjs-config');

var dataprovider = require('./local/dataprovider')();

var client = dataprovider.register("test_client");

var connection = client.connect('fetch', 'oanda:eurusd:m5');

connection.on('data', function(data) {
    console.log(data);
});

connection.on('end', function() {
    console.log("=== END ===");
});
