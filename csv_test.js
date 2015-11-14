'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var requirejs = require("requirejs");
require('./local/rjs-config');

var dataprovider = require('./local/dataprovider')();

var client = dataprovider.register("test_client");

var fetch1 = client.connect('fetch', ['oanda_eurusd_2015-10-25_1743']);

var filedata = '';
fetch1.on('data', function(data) {
	console.log('data:', data);
    //filedata += JSON.stringify(data) + '\n';
});

fetch1.on('end', function() {
	console.log('END.');
});
