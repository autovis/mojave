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

var config = {
    source: 'oanda',
    instrument: 'eurusd',
    count: 100,
    vars: {
        ltf: 'm5',
        htf: 'H1'
    }
};

collection_factory.create('test', config, function(err, collection) {
    if (err) {
        console.error('Error:', err, err.stack);
    }

    //console.log('COLLECTION:', collection);

    var src_stream = collection.indicators['src'].output_stream;
    var trade_stream = collection.indicators['trade_events'].output_stream;

    _.each(collection.indicators, function(ind, key) {
        //if (key !== 'climate') return;
        ind.output_stream.on('update', function(args) {
            var value = ind.output_stream.get(0);
            if (!_.isEmpty(value)) console.log(key, '>>>', value);
        });
    });

    var trade_event_uuids = [];
    trade_stream.on('update', function(args) {
        //if (trade_stream.current_index() < config.trade_preload) return;
        var trade_events = trade_stream.get();

        if (!_.isEmpty(trade_events))
        console.log(trade_events);

        _.each(trade_events, function(evt) {
            if (evt[1] && trade_event_uuids.indexOf(evt[1].uuid) > -1) return;
            if (evt[0] === 'trade_end') {
                var trade = _.assign(evt[1], {instrument: config.instrument, index: src_stream.current_index()});
                console.log('TRADE:', trade);
            }
            trade_event_uuids.push(evt[1].uuid);
            if (trade_event_uuids.length > config.trade_event_uuids_maxsize) trade_event_uuids.shift();
        });

    });

});
