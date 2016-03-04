'use strict';

var fs = require('fs');

var requirejs = require('requirejs');
require('./local/rjs-config');

var _ = requirejs('lodash');
var moment = requirejs('moment');
//var dataprovider = requirejs('dataprovider')();
var jsonoc = requirejs('jsonoc');
var jt = requirejs('jsonoc_tools');
var dataprovider = require('./local/dataprovider.js')();
var collection_factory = requirejs('collection_factory');

collection_factory.set_dataprovider(dataprovider);

var parse_jsonoc = jsonoc.get_parser();
var schema = jsonoc.get_schema();

var csv_fields = ['id', 'date', 'reason', 'direction', 'units', 'enty_price', 'exit_price', 'pips', 'instrument', 'index'];

var config = {
    source: 'oanda',
    instrument: 'eurusd',
    count: {
        'ltf_dcdl': 500
    },
    vars: {
        ltf: 'm5',
        htf: 'H1'
    }
};

collection_factory.create('test', config, function(err, collection) {
    if (err) return console.error('Error:', err, err.stack);

    var src_stream = collection.indicators['src'].output_stream;
    var trade_stream = collection.indicators['trade_events'].output_stream;

    var trade_event_uuids = [];
    trade_stream.on('update', function(args) {
        //if (trade_stream.current_index() < config.trade_preload) return;
        var trade_events = trade_stream.get();

        _.each(trade_events, function(evt) {
            if (evt[1] && trade_event_uuids.indexOf(evt[1].uuid) > -1) return;
            if (evt[0] === 'trade_end') {
                var trade = _.assign(evt[1], {instrument: config.instrument, index: src_stream.current_index()});

                // output CSV line
                var values = _.map(csv_fields, function(field) {
                    var val = trade[field];
                    if (_.isDate(val)) {
                        return moment(val).format('YYYY-MM-DD HH:mm:ss');
                    } else if (_.isNumber(val)) {
                        return val % 1 === 0 ? val : val.toFixed(4);
                    } else {
                        if (!val) return '';
                        return val.toString().indexOf(',') > -1 ? '"' + val + '"' : val;
                    }
                });
                //values = _.map(values, val => val.indexOf(',') > -1 ? '"' + val + '"' : val);
                process.stdout.write(values.join(',') + '\n');
            }
            trade_event_uuids.push(evt[1].uuid);
            if (trade_event_uuids.length > config.trade_event_uuids_maxsize) trade_event_uuids.shift();
        });

    });

    // CSV header line
    process.stdout.write(csv_fields.join(',') + '\n');

    collection.start(function() {
        console.log('== Done ==');
    });

});
