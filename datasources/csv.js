'use strict';

var fs = require('fs');
var csv = require('csv');
var _ = require('lodash');
var path = require('path');
var csv_parse = require('csv-parse');

var default_config = {};

function get(connection, config) {

    if (!config.type) throw new Error('"type" config parameter expected');

    config = _.defaults(config, default_config);

    var parser = csv_parse();
    var first = true;
    var header = [];
    var record;

    parser.on('readable', function(){
        while (record = parser.read()) {
            if (first) {
                header = record;
                first = false;
            }
            connection.transmit_data(config.type, _.zipObject(header, record));
        }
    });
    parser.on('error', function(err) {
      console.log(err.message);
    });
    parser.on('finish', function() {
        if (!config.omit_end_marker) connection.end();
    });


    var filepath = path.join(__dirname, '../common/data', params[0] + '.csv');
    var inputstream = fs.createReadStream(filepath);

    inputstream.on('data', function(chunk) {
        parser.write(chunk);
    });
    inputstream.on('end', function () {  // done
        parser.end();
    });

    return true;
}

module.exports = {
    get: get,
    properties: {
        use_interpreter: true,
        single_stream: true
    }
};
