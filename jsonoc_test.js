
var fs = require('fs');

var requirejs = require("requirejs");
require('./local/rjs-config');

var jsonoc = requirejs('jsonoc');

var parse_jsonoc = jsonoc.get_parser("$Collection");

fs.readFile(__dirname + '/common/collections/test2.js', function(err, data) {
    var parsed = parse_jsonoc(data.toString());
    var stringified = jsonoc.stringify(parsed);
    process.stdout.write(stringified + "\n");
});
