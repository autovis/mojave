
var fs = require('fs');

var requirejs = require("requirejs");
require('./local/rjs-config');

var jsonoc = requirejs('jsonoc');
var jt = requirejs('jsonoc_tools');

var parse_jsonoc = jsonoc.get_parser();

console.log('***********************************************************************');

var base_constr = function() {
    this.base = true;
};

var parent_constr = function() {
    this.parent = true;
};

var child_constr = function() {
    this.child = true;
};

parent_constr.prototype = _.create(base_constr.prototype, {'_super': base_constr.prototype, 'constructor': parent_constr});
child_constr.prototype = _.create(parent_constr.prototype, {'_super': parent_constr.prototype, 'constructor': child_constr});

var obj = _.create(child_constr.prototype);

console.log('instanceof child:', obj instanceof child_constr);
console.log('instanceof parent:', obj instanceof parent_constr);
console.log('instanceof base:', obj instanceof base_constr);


console.log('***********************************************************************');

fs.readFile(__dirname + '/common/chart_setups/test.js', function(err, data) {
    var parsed = parse_jsonoc(data.toString());
    var stringified = jsonoc.stringify(parsed);
    process.stdout.write(stringified + "\n");
    console.log('----------------------------------------------------------------');
    var schema = jsonoc.get_schema();

    var obj = new schema.$ChartSetup.PanelComponent[0]([]);
    console.log('obj = new PanelComponent()');
    console.log('obj instanceof $ChartSetup.PanelComponent .:', jt.instance_of(obj, "$ChartSetup.PanelComponent"));
    console.log('obj instanceof Component ..................:', jt.instance_of(obj, "Component"));
    console.log('obj instanceof _ ..........................:', jt.instance_of(obj, "_"));
    var obj2 = new schema.Component[0]([]);
    console.log('obj2 = new Component()');
    console.log('obj2 instanceof _ .........................:', jt.instance_of(obj2, "_"));
});
