'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var requirejs = require("requirejs");
require('./local/rjs-config');

var dataprovider = require('../local/dataprovider')();
var moment = requirejs('moment');

console.log("CSV test start...");

var client = dataprovider.register("test_client");
var fetch1 = client.connect('get', {
    source: 'csv/eurusd_ask',
    type: 'tick',
    delimiter: ';',
    header: ['date', 'open', 'high', 'low', 'close', 'volume']
});


var filedata = '';
fetch1.on('data', function(pkt) {
    if (pkt.data && pkt.data.date) pkt.data.date = moment(pkt.data.date).format('YYYY-MM-DD HH:mm:ss');
	console.log('PKT:', pkt);
});

fetch1.on('end', function() {
	console.log('END.');
});
