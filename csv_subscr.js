'use strict';

var async = require('async');
var fs = require('fs');
var path = require('path');
var minimist = require('minimist');
var _ = require('lodash');

var requirejs = require('requirejs');
require('./local/rjs-config');

var moment = requirejs('moment');
var argv = minimist(process.argv.slice(2));
var dataprovider = require('./local/dataprovider')();

var client = dataprovider.register('csv_writer');

/////////////////////////////////////////////////////////////////////////////////////////

var csv_fields = ['date', 'ask', 'bid']; // CSV fields to collect and in which order

var datasource = argv._[0];
var target_csv_file = path.join('data', datasource.replace(':', '_') + moment().format('_YYYY-MM-DD_HHmm') + '.csv');

process.stdout.write('Writing data to CSV file:' + target_csv_file + '\n');

async.waterfall([

    // Open CSV file to be written to and obtain file descriptor (fd)
    function(cb) {
        var stream = fs.createWriteStream(target_csv_file);
        stream.on('error', cb);
        stream.once('open', function(fd) {
            cb(null, stream);
        });
    },

    // Subscribe to datasource and write data to file as it arrives
    function(stream, cb) {
        var subscription = client.connect('subscribe', datasource);
        subscription.on('data', function(data) {
            var price_data = data.data;
            var output_line = _.map(csv_fields, field => price_data[field]).join(',');
            stream.write(output_line + '\n');
        });
    }

], function(err) {
    if (err) console.error(err);
});
