'use strict';

var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var requirejs = require('requirejs');
require('../local/rjs-config');

var dataprovider = require('../local/dataprovider')();

requirejs(['moment-timezone', 'collection_factory', 'indicator_collection'], function(moment, CollectionFactory, IndicatorCollection) {

    CollectionFactory.set_dataprovider(dataprovider);
    var current_date = moment();

    var collection_id = 'test_deps';
    var config = {
        source: 'oanda',
        instrument: 'eurusd',
        vars: {}, // this should be optional
        range: {
            'H1.input': [
                get_previous_trading_day(current_date).format('YYYY-MM-DD') + ' 00:00',
                current_date.format('YYYY-MM-DD') + ' 01:00'
            ],
            'm1.input': [
                current_date.format('YYYY-MM-DD') + ' 01:00',
                current_date.format('YYYY-MM-DD HH:mm')
            ]
        },

        subscribe: true,
        debug: true
    };

    CollectionFactory.create(collection_id, config, (err, collection) => {
        if (err) {
            console.error(err);
            return;
        }
        console.log('Collection:', collection);
    });

    function get_previous_trading_day(date) {
        var currday = date.clone();
        do { // find previous weekday
            currday.subtract(1, 'days');
        } while ([0, 6].includes(currday.day()));
        return currday;
    }

}); // requirejs
