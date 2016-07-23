'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var requirejs = require("requirejs");
require('../local/rjs-config');

var dataprovider = require('../local/dataprovider')();

console.log("CSV test start...");

var client = dataprovider.register("test_client");
//var fetch1 = client.connect('fetch', ['csv', 'oanda_eurusd_2015-10-25_1743', 'tick']);
var fetch1 = client.connect('get', {
	source: 'csv/eurusd_ask.csv',
	type: 'candle_bar',
	header: ['date', 'open', 'high', 'low', 'close', 'volume'],
	timeframe: 'm1',
	count: 20
});

var filedata = '';
fetch1.on('data', function(data) {
	console.log('data:', data);
});

fetch1.on('end', function() {
	console.log('END.');
});
