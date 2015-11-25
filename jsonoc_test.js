
var fs = require('fs');

var requirejs = require("requirejs");
require('./local/rjs-config');

var jsonoc = requirejs('jsonoc');
var jt = requirejs('jsonoc_tools');

var parse_jsonoc = jsonoc.get_parser();

fs.readFile(__dirname + '/common/chart_setups/test.js', function(err, data) {
    var parsed = parse_jsonoc(data.toString());
    var stringified = jsonoc.stringify(parsed);
    process.stdout.write(stringified + "\n");
    console.log('----------------------------------------------------------------');
    var schema = jsonoc.get_schema();

    var obj = new schema.$ChartSetup.PanelComponent[0]([]);
    console.log(jt.instance_of(obj, "Component"));
    console.log(jt.instance_of(obj, "$ChartSetup.PanelComponent"));
    console.log(jt.instance_of(obj, "_"));

    //console.log('>>>', parsed[3][0] instanceof schema._);
});
