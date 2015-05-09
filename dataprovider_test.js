'use strict';

var _ = require('lodash');
var path = require('path');

var dataprovider = require('./local/dataprovider');

var client = dataprovider.register("test_client", function(msg) {
    console.log(msg);
});

client.subscribe('oanda:eurusd:m5');
