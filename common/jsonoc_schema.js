'use strict';

define(['lodash', 'jsonoc_tools'], function(_, jt) {

var config; // Config object accessible to constructors from outside

// --------------------------------------------------------------------------------------

// helper functions

function resolve(obj) {
    var copy;
    if (jt.instance_of(obj, 'Var')) {
        if (!_.has(config.vars, obj.var)) throw new Error('Undefined var: ' + obj.var);
        return config.vars[obj.var];
    } else if (jt.instance_of(obj, '_')) {
        _.each(obj, (val, key) => obj[key] = resolve(val));
        return obj;
    } else if (_.isArray(obj)) {
        return _.map(obj, val => resolve(val));
    } else if (_.isObject(obj)) {
        copy = {};
        _.each(obj, (val, key) => copy[key] = resolve(val));
        return copy;
    } else {
        return obj;
    }
};

// --------------------------------------------------------------------------------------

var schema = {

    // Global constructors
    '$_': {
        'Var': '@Var',

        'MapTo': '@MapTo',

        'Item': '@Item'
    },

    // *************************************
    // Collection
    // *************************************

    'Collection': [function() {
        var self = this;
        self.vars = {};
        self.inputs = {};
        self.indicators = {};
        _.each(arguments[0], function(item) {
            if (jt.instance_of(item, '$Collection.Timestep')) {
                _.each(item.inputs, function(inp, key) {
                    if (_.has(self.inputs, key)) throw new Error('Input "' + key + "' is already defined elsewhere");
                    self.inputs[key] = inp;
                });
                _.each(item.indicators, function(ind, key) {
                    if (_.has(self.indicators, key)) throw new Error('Indicator "' + key + "' is already defined elsewhere");
                    self.indicators[key] = ind;
                });
            }
        });
        return self;
    }, {pre: ['SAInit', 'SAOptHolder']}],

    '$Collection': {

        'SetVars': '@SetVars',
        'SetDefaultVars': '@SetDefaultVars',

        'Timestep': [function(tstep, sources) {
            var self = this;
            if (!(_.isString(tstep) || jt.instance_of(tstep, 'Var')) || !_.isObject(sources)) throw new Error('Usage: Timestep(<timestep:(str|Var)>, <streams:map>)');
            self.inputs = {};
            self.indicators = {};
            self.tstep = resolve(tstep);
            (function collect_sources(srcs, path) {
                _.each(srcs, (val, key) => {
                    if (_.isString(val)) val = jt.create('$Collection.$Timestep.Source', [val]);
                    if (jt.instance_of(val, '$Collection.$Timestep.SrcType')) {
                        val.tstep = self.tstep;
                    }
                    if (jt.instance_of(val, '$Collection.$Timestep.Input')) {
                        val.id = path.concat(key).join('.');
                        _.set(self.inputs, val.id, val);
                    } else if (jt.instance_of(val, '$Collection.$Timestep.Ind')) {
                        val.id = path.concat(key).join('.');
                        _.set(self.indicators, val.id, val);
                    } else if (jt.instance_of(val, '$Collection.$Timestep.Source')) {
                        val.id = path.concat(key).join('.');
                        _.set(self.indicators, val.id, val);
                    } else if (_.isObject(val)) {
                        collect_sources(val, path.concat(key));
                    }
                });
            })(sources, []);
            return self;
        }],

        '$Timestep': {

            'Collection': '@Collection',

            'SrcType': [function() {
            }, {virtual: true}],

            'Input': [function(type, options) {
                if (!type) throw new Error('Usage: Input(<type>, <options_map>) where "type" parameter is required');
                this.type = resolve(type);
                this.options = resolve(options || {});
            }, {extends: '$Collection.$Timestep.SrcType', pre: 'OptHolder'}],

            'Ind': [function() { // variable parameters
                var err_msg = 'Usage: Ind(<source>, <ind_name_str>, <param1>, <param2>, ...) where "source" may be a comma-delimited list of sources, an array of sources, or a nested Ind(...) value';
                var args = _.filter(arguments, arg => !jt.instance_of(arg, 'Opt'));
                if (_.isNull(args[0]) || args.length === 0) {
                    this.src = null; // defer setting source and use ident indicator
                } else if (jt.instance_of(args[0], '$Collection.$Timestep.Ind')) {
                    this.src = [args[0]];
                } else if (_.isString(args[0])) {
                    this.src = args[0].split(',').map(x => x.trim());
                } else if (_.isObject(args[0])) {
                    this.src = args[0];
                } else {
                    throw new Error(err_msg);
                }
                this.name = args[1];
                this.params = Array.prototype.slice.call(args, 2).map(resolve);
                this._stringify = function(stringify) {
                    var args = _.flatten(_.compact([this.src, this.name, this.params]));
                    if (!_.isEmpty(this.options)) args.push(jt.create('Opt', [this.options]));
                    return _.last(this._path) + '(' + args.map(stringify).join(', ') + ')';
                };
                //return this;
            }, {extends: '$Collection.$Timestep.SrcType', pre: 'OptHolder'}],

            '$Ind': {
                'Ind': '@$Collection.$Timestep.Ind',
                'Source': '@$Collection.$Timestep.Source',
                'Switch': '@Switch',
                'opt': '@optimizer'
            },

            'Source': [function() {
                this.src = _.filter(arguments, arg => !jt.instance_of(arg, 'Opt'));
            }, {extends: '$Collection.$Timestep.SrcType', pre: 'OptHolder'}],

            '$Source': {
                'Source': '@$Collection.$Timestep.Source'
            }

        }

    },

    // *************************************
    // ChartSetup
    // *************************************

    'ChartSetup': [function() {
        this.components = _.filter(this.array, item => jt.instance_of(item, 'Component'));
    }, {pre: ['SAInit', 'SAGeometryHolder', 'SABehaviorHolder', 'SAMarkerHolder', 'SAOptHolder']}],

    '$ChartSetup': {

        'SetVars': '@SetVars',
        'SetDefaultVars': '@SetDefaultVars',

        'Geometry': '@KeyValueMap',
        'Behavior': '@KeyValueMap',

        // chart-level plots
        'Plot': function() {
            this.options = {};
            for (var i = 0; i <= arguments.length - 1; i++) {
                var arg = arguments[i];
                if (_.isString(arg)) {
                    this.id = arg;
                } else if (jt.instance_of(arg, '$Collection.$Timestep.Ind')) {
                    this.indicator = arg;
                } else if (jt.instance_of(arg, 'Opt')) {
                    this.options = _.assign(this.options, arg);
                } else if (_.isObject(arg)) {
                    this.options = _.assign(this.options, arg);
                }
            }
            if (!this.id) throw new Error('Usage: Plot(<id_str>, <>)');
        },

        '$Plot': {
            'Ind': '@$Collection.$Timestep.Ind',
            'Switch': '@Switch'
        },

        'Component': '@Component',

        'PlotComponent': [function(arr) {
            this.plots = _.filter(arr, item => jt.instance_of(item, '$ChartSetup.Plot'));
        }, {extends: '$ChartSetup.Component'}],

        '$PlotComponent': {
            'Plot': '@$ChartSetup.Plot',
        },

        'PanelComponent': [function(arr) {
            this.controls = _.filter(arr, item => jt.instance_of(item, 'Control'));
        }, {extends: '$ChartSetup.Component'}],

        '$PanelComponent': {
            'Control': '@Control'
        },

        'MatrixComponent': [function(arr) {
            this.rows = _.filter(arr, item => jt.instance_of(item, '$ChartSetup.$MatrixComponent.MatrixRow'));
        }, {extends: '$ChartSetup.Component'}],

        '$MatrixComponent': {
            'MatrixRow': function(id, name) {
                this.id = id;
                this.name = name;
            }
        },

        'NullComponent': '@$ChartSetup.Component'

    },

    // *************************************
    // Data
    // *************************************

    'Data': [function() {
    }, {pre: ['SAInit']}],

    '$Data': {

        // Selection of bars
        'Selection': [function() {
            this.selection = _.filter(this.array, item => jt.instance_of(item, '$Data.$Selection.Sel'));
        }, {pre: ['SAInit']}],

        '$Selection': {

            'Sel': [function() {
                if (_.isString(arguments[0])) {
                    this.name = arguments[0];
                    this.args = Array.slice.apply(arguments, [1]);
                } else {
                    this.args = arguments;
                }
            }, {virtual: true}],

            // Selection of single bar
            'Bar': [function() {
            }, {extends: '$Data.$Selection.Sel'}],

            // Selection based on a time range
            'Range': [function() {
            }, {extends: '$Data.$Selection.Sel'}]

        }

    },

    /////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////

    'Var': function(varname) {
        this.var = varname;
        return this;
    },

    'SetVars': [function(vars) {
        _.each(vars, (val, key) => config.vars[key] = val);
    }, {extends: 'KeyValueMap'}],

    'SetDefaultVars': [function(vars) {
        _.each(vars, (val, key) => {
            if (!_.has(config.vars, key)) config.vars[key] = val;
        });
    }, {extends: 'KeyValueMap'}],

    'MapTo': function(list, target) {
        var obj = {};
        list = resolve(list);
        if (!_.isArray(list)) throw new Error('"MapTo" macro must have array of string as first parameter');
        if (!_.every(list, item => _.isString(item))) throw new Error('"MapTo" macro must have array of string as first parameter');
        _.each(list, item => {
            var target_copy = _.cloneDeep(target);
            target_copy.prototype = _.create(target.prototype);
            obj[item] = (function replace_item(o) {
                if (jt.instance_of(o, 'Item')) {
                    return item;
                } else if (_.isObject(o)) {
                    _.each(o, (val, key) => {
                        o[key] = replace_item(val);
                    });
                    return o;
                } else {
                    return o;
                }
            })(target_copy);
        });
        return obj;
    },

    'Item': function() {},

    // Base of all constructors that accept a single parameter of Object type
    'KeyValueMap': function(obj) {
        var self = this;
        _.each(obj, function(val, key) {self[key] = val;});
        self._stringify = function(stringify) {
            var pairs = _.filter(_.toPairs(self), pair => _.head(pair[0]) !== '_');
            return _.last(self._path) + '({' + pairs.map(p => JSON.stringify(p[0]) + ': ' + stringify(p[1])).join(', ') + '})';
        };
        return self;
    },

    // Represent an element's parameters/settings/properties using key/value map
    'Opt': '@KeyValueMap',

    // Collects all arguments that are objects and merges their properties into this.options
    'OptHolder': function() {
        var self = this;
        self.options = jt.create('Opt', [{}]);
        for (var i = 0; i <= arguments.length - 1; i++) {
            var arg = arguments[i];
            if (jt.instance_of(arg, 'Opt') || _.isObject(arg) && !jt.instance_of(arg, '_')) {
                _.each(arg, (val, key) => self.options[key] = val);
            }
        }
    },

    // Base of all constructors that accept a single parameter of Array type
    'Array': function() {
        var self = this;
        if (arguments.length === 0 || arguments.length > 1 || !_.isArray(arguments[0])) throw new Error('Constructor only accepts a single array as parameter');
        self._stringify = function(stringify) {
            return _.last(self._path) + '([' + _.flatten(_.map(_.values(self), function(item) {
                if (jt.instance_of(item, '_')) {
                    return stringify(item);
                } else if (_.isArray(item)) {
                    return _.map(item, stringify);
                } else if (_.isObject(item)) {
                    return _.map(_.values(item), stringify);
                } else {
                    return stringify(item);
                }

            })).join(', ') + '])';
        };
    },

    // To validate that the constructor is only taking a single array parameter
    'SAInit': function() {
        var self = this;
        if (arguments.length === 0 || arguments.length > 1 || !_.isArray(arguments[0])) throw new Error('Constructor only accepts a single array as parameter');
        self.array = arguments[0];
        self._stringify = function(stringify) {
            return _.last(self._path) + '([' + _.flatten(_.map(_.values(self), function(item) {
                if (jt.instance_of(item, '_')) {
                    return stringify(item);
                } else if (_.isArray(item)) {
                    return _.map(item, stringify);
                } else if (_.isObject(item)) {
                    return _.map(_.values(item), stringify);
                } else {
                    return stringify(item);
                }

            })).join(', ') + '])';
        };
    },

    // Traverses single array to collect all objects and merge their properties into this.options
    'SAOptHolder': function() {
        var self = this;
        self.options = {};
        for (var i = 0; i <= arguments[0].length - 1; i++) {
            var elem = arguments[0][i];
            if (jt.instance_of(elem, '_')) {
                var type = _.last(elem._path);
                if (type === 'Opt' || type === 'Opt') {
                    assign_properties(elem);
                }
            }
        }
        function assign_properties(elem) {
            var newobj = _.fromPairs(_.filter(_.toPairs(elem), function(p) {return _.head(p[0]) !== '_';}));
            self.options = _.assign(self.options, newobj);
        }
    },

    'SAGeometryHolder': function() {
        var geoms = _.filter(arguments[0], item => jt.instance_of(item, '$ChartSetup.Geometry'));
        this.geom = geoms.reduce(function(memo, geom) {
            if (_.isNull(memo)) {
                return geom;
            } else {
                _.each(geom, function(v, k) {
                    memo[k] = v;
                });
                return memo;
            }
        }, null);
    },

    'SABehaviorHolder': function() {
        var behaviors = _.filter(arguments[0], item => jt.instance_of(item, '$ChartSetup.Behavior'));
        this.behavior = behaviors.reduce(function(memo, beh) {
            if (_.isNull(memo)) {
                return beh;
            } else {
                _.each(beh, function(v, k) {
                    memo[k] = v;
                });
                return memo;
            }
        }, {});
    },

    'SAMarkerHolder': function() {
        this.markers = _.filter(arguments[0], item => jt.instance_of(item, 'Marker'));
    },

    'Switch': function() {
        if (arguments.length < 2 || !_.isString(arguments[0]) || !_.isObject(arguments[1])) throw new Error('Usage: Switch(<varname_str>, <condition_map>)');
        this.var = arguments[0];
        this.mapping = arguments[1];
        if (arguments[2] !== undefined) this.default = arguments[2];
        return this;
    },

    // $ChartSetup ----------------------------------------------------------------------

    'Component': [function() {
    }, {virtual: true, pre: ['SAInit', 'SAGeometryHolder', 'SABehaviorHolder', 'SAMarkerHolder', 'SAOptHolder']}],

    '$Component': {

        'Geometry': '@$ChartSetup.Geometry',
        'Behavior': '@$ChartSetup.Behavior',
        'Marker': '@Marker',

        'Opt': '@Opt'
    },

    // Markers

    'Marker': [function() {
    }, {virtual: true}],

    '$Marker': {
        'Opt': '@Opt',
    },

    'HLine': [function() {
        this.ypos = arguments[0];
        this.color = arguments[1];
        this.line_width = arguments[2];
        this.options = arguments[3] || {};
    }, {extends: 'Marker'}],

    // Controls

    'Control': [function() {
        if (!_.isString(arguments[0])) throw new Error('Usage: ' + _.last(this._path) + '(<control_id_str>, ...)');
        this.id = arguments[0];
    }, {virtual: true}],

    'LabelControl': [function() {
        this.text = arguments[1];
    }, {extends: 'Control'}],

    'RadioControl': [function() {
        this.choices = arguments[1];
        this.selected = arguments[2];
    }, {extends: 'Control'}],

    'DropdownControl': [function() {
        this.choices = arguments[1];
        this.selected = arguments[2];
    }, {extends: 'Control'}],

    'CheckboxControl': [function() {
        this.text = arguments[1];
        this.selected = arguments[2];
    }, {extends: 'Control'}],

    // Optimizer ------------------------------------------------------------------------

    optimizer: {

        'Optimization': function() {

        },

        'Numrange': [function() {

        }, {extends: 'optimizer.Optimization'}]

    },

    /////////////////////////////////////////////////////////////////////////////////////
    // Meta-level methods for configuring schema
    /////////////////////////////////////////////////////////////////////////////////////

    // Set 'config' object to be available to constructors during parsing
    '@setConfig': function(conf) {
        config = conf;
    }

};

jt.set_schema(schema);

return schema;

});
