'use strict';

var fs = require('fs');

var requirejs = require("requirejs");
require('./local/rjs-config');

var jsonoc = requirejs('jsonoc');
var jt = requirejs('jsonoc_tools');
var dataprovider = require('./local/dataprovider')();
var collection_factory = requirejs('collection_factory');
collection_factory.set_dataprovider(dataprovider);

var parse_jsonoc = jsonoc.get_parser();
var schema = jsonoc.get_schema();

console.log('***********************************************************************');

collection_factory.create('test', {source: 'oanda', instrument: 'eurusd', count: 100}, function(err, collection) {
    if (err) throw err;
    console.log(collection);
});

/*
dataprovider.load_resource('collections/test.js', function(err, data) {
    if (err) throw err;

    var parsed = parse_jsonoc(data.toString());
    var stringified = jsonoc.stringify(parsed);
    process.stdout.write(stringified + "\n");
    console.log('----------------------------------------------------------------');
    var schema = jsonoc.get_schema();

    ////////////////////////////////////////
    // Examine schema

    var base_constr = function() {
        this.base = true;
    };
    base_constr.base = true;
    var parent_constr = function() {
        this.parent = true;
    };
    parent_constr.parent = true;
    var child_constr = function() {
        this.child = true;
    };
    child_constr.child = true;
    parent_constr.prototype = _.create(base_constr.prototype, {'_super': base_constr.prototype, 'constructor': parent_constr});
    child_constr.prototype = _.create(parent_constr.prototype, {'_super': parent_constr.prototype, 'constructor': child_constr});

    var obj1 = _.create(child_constr.prototype);
    console.log('instanceof child:', obj1 instanceof child_constr);
    console.log('instanceof parent:', obj1 instanceof parent_constr);
    console.log('instanceof base:', obj1 instanceof base_constr);
    console.log('');

    ////////////////////////////////////////

    var obj2 = new schema.$ChartSetup.PanelComponent[2]([]);
    //var obj = _.create(schema.$ChartSetup.PanelComponent[2].prototype);
    console.log('obj = new PanelComponent()');
    console.log('obj instanceof $ChartSetup.PanelComponent .:', jt.instance_of(obj2, "$ChartSetup.PanelComponent"));
    console.log('obj instanceof $ChartSetup.Component ......:', jt.instance_of(obj2, "$ChartSetup.Component"));
    console.log('obj instanceof _ ..........................:', jt.instance_of(obj2, "_"));
    console.log('');
    var obj3 = new schema.$ChartSetup.Component[2]([]);
    console.log('obj = new Component()');
    console.log('obj instanceof $ChartSetup.Component ......:', jt.instance_of(obj3, "$ChartSetup.Component"));
    console.log('obj instanceof _ ..........................:', jt.instance_of(obj3, "_"));

    ////////////////////////////////////////

    console.log('end.');

    process.exit(0);
});
*/
