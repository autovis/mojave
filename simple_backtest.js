'use strict';

var fs = require('fs');

var requirejs = require('requirejs');
require('./local/rjs-config');

//var dataprovider = requirejs('dataprovider')();
var jsonoc = requirejs('jsonoc');
var jt = requirejs('jsonoc_tools');
var dataprovider = require('./local/dataprovider.js')();
var collection_factory = requirejs('collection_factory');

collection_factory.set_dataprovider(dataprovider);

var parse_jsonoc = jsonoc.get_parser();
var schema = jsonoc.get_schema();

console.log('***********************************************************************');

collection_factory.create('test', {
    source: 'oanda',
    instrument: 'eurusd',
    count: 100,
    vars: {
        ltf: 'm5',
        htf: 'H1'
    }
}, function(err, collection) {
    if (err) {
        console.error('Error:', err, err.stack);
    }
    console.log('COLLECTION:', collection);
    process.exit();
});
