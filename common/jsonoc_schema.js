'use strict';

define(['lodash', 'jsonoc_tools'], function(_, jt) {

var schema = {

    // Global constructors
    '$_': {
        'UseVar': '@Var',
        'Var': '@Var'
    },

    // *************************************
    // Collection
    // *************************************

    'Collection': [function() {
        this.vars = {};
        this.inputs = {};
        this.indicators = {};
        _.each(arguments[0], function(item) {
            if (jt.instance_of(item, '$Collection.Timestep')) {
                var tstep = item.tstep;
                _.each(item.inputs, function(inp, key) {
                    if (_.has(this.inputs, key)) throw new Error('Input "' + key + "' is already defined elsewhere");
                    this.inputs[key] = inp;
                }, this);
                _.each(item.indicators, function(ind, key) {
                    if (_.has(this.indicators, key)) throw new Error('Indicator "' + key + "' is already defined elsewhere");
                    this.indicators[key] = ind;
                }, this);
            } else if (jt.instance_of(item, '$Collection.Vars')) {
                this.vars = _.assign(this.vars, item);
            }
        }, this);
        return this;
    }, {pre: ['SAInit', 'SAOptionsHolder']}],

    '$Collection': {

        'Vars': '@Vars',

        'Timestep': function(tstep, streams) {
            if (!(_.isString(tstep) || jt.instance_of(tstep, 'Var')) || !_.isObject(streams)) throw new Error('Usage: Timestep(<timestep:(str|Var)>, <streams:map>)');
            this.tstep = tstep;
            this.streams = streams;
            this.inputs = {};
            this.indicators = {};
            _.each(streams, function(val, key) {
                if (_.isString(val)) val = jt.create('$Collection.$Timestep.Stream', [val]);
                val.tstep = this.tstep;
                console.log(key, val);
                if (jt.instance_of(val, '$Collection.$Timestep.Input')) {
                    this.inputs[key] = val;
                } else if (jt.instance_of(val, '$Collection.$Timestep.Ind')) {
                    this.indicators[key] = val;
                } else if (jt.instance_of(val, '$Collection.$Timestep.Stream')) {
                    this.indicators[key] = val;
                }
            }, this);
            return this;
        },

        '$Timestep': {

            'Collection': '@Collection',

            'Input': function(type, options) {
                if (!type) throw new Error('Usage: Input(<type>, <options_map>) where "type" parameter is required');
                this.type = type;
                this.options = options || {};
            },

            'Ind': [function() { // variable parameters
                var err_msg = 'Usage: Ind(<source>, <ind_name_str>, <param1>, <param2>, ...) where "source" may be a comma-delimited list of sources, an array of sources, or a nested Ind(...) value';
                if (jt.instance_of(arguments[0], '$Collection.$Timestep.Ind')) {
                    this.src = [arguments[0]];
                } else if (_.isArray(arguments[0])) {
                    this.src = arguments[0];
                } else if (_.isString(arguments[0])) {
                    this.src = arguments[0].split(',').map(function(str) {return str.trim()});
                } else {
                    throw new Error(err_msg);
                }
                if (!_.isString(arguments[1])) throw new Error(err_msg);
                this.name = arguments[1];
                this.params = Array.prototype.slice.call(arguments, 2);
                this._stringify = function(stringify) {
                    var args = _.flatten(_.compact([this.src, this.name, this.params]));
                    return _.last(this._path) + '(' + args.map(stringify).join(', ') + ')';
                };
                return this;
            }, {pre: 'SAOptionsHolder'}],

            'Stream': [function(src) {
                this.src = src;
            }],

            '$Ind': {
                'Ind': '@$Collection.$Timestep.Ind',
                'Switch': '@Switch',
                'opt': '@optimizer'
            }

        }

    },

    // *************************************
    // ChartSetup
    // *************************************

    'ChartSetup': [function() {
        this.components = _.filter(this.array, function(item) {
            return jt.instance_of(item, 'Component');
        });
    }, {pre: ['SAInit', 'SAGeometryHolder', 'SABehaviorHolder', 'SAMarkerHolder', 'SAOptionsHolder']}],

    '$ChartSetup': {

        'Vars': '@Vars',

        'Geometry': '@Options',
        'Behavior': '@Options',

        // chart-level plots
        'Plot': function() {
            this.options = {};
            for (var i = 0; i <= arguments.length - 1; i++) {
                var arg = arguments[i];
                if (_.isString(arg)) {
                    this.id = arg;
                } else if (jt.instance_of(arg, '$Collection.$Timestep.Ind')) {
                    this.indicator = arg;
                } else if (jt.instance_of(arg, 'Options')) {
                    this.options = _.assign(this.options, arg);
                } else if (_.isObject(arg)) {
                    this.options = _.assign(this.options, arg);
                }
            }
            if (!this.id) throw new Error("Usage: Plot(<id_str>, <>)");
        },

        '$Plot': {
            'Ind': '@$Collection.$Timestep.Ind',
            'Switch': '@Switch'
        },

        'Component': '@Component',

        'PlotComponent': [function(arr) {
            this.plots = _.filter(arr, function(item) {
                return jt.instance_of(item, '$ChartSetup.Plot');
            });
        }, {extends: '$ChartSetup.Component'}],

        '$PlotComponent': {
            'Plot': '@$ChartSetup.Plot',
        },

        'PanelComponent': [function(arr) {
            this.controls = _.filter(arr, function(item) {
                return jt.instance_of(item, 'Control');
            });
        }, {extends: '$ChartSetup.Component'}],

        '$PanelComponent': {
            'Control': '@Control'
        },

        'MatrixComponent': [function(arr) {
            this.rows = _.filter(arr, function(item) {
                return jt.instance_of(item, '$ChartSetup.$MatrixComponent.MatrixRow');
            });
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
            this.selection = _.filter(this.array, function(elem) {
                return jt.instance_of(elem, '$Data.$Selection.Sel');
            });
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

    'UseVar': '@Var', // alias

    // Base of all constructors that accept a single parameter of Object type
    'KeyValueMap': function(obj) {
        _.each(obj, function(val, key) {this[key] = val}, this);
        this._stringify = function(stringify) {
            var pairs = _.filter(_.pairs(this), function(pair) {
                return _.first(pair[0]) !== '_';
            });
            return _.last(this._path) + '({' + pairs.map(function(p) {return JSON.stringify(p[0]) + ': ' + stringify(p[1])}).join(', ') + '})';
        };
        return this;
    },

    // Represent an element's parameters/settings/properties using key/value map
    'Options': '@KeyValueMap',

    // Declare and assign multiple vars using key/value map
    'Vars': '@KeyValueMap',

    // Collects all arguments that are objects and merges their properties into this.options
    'OptionsHolder': function() {
        this.options = {};
        for (var i = 0; i <= arguments.length - 1; i++) {
            var arg = arguments[i];
            if (jt.instance_of(arg, 'Options') || _.isObject(arg)) {
                var newobj = _.object(_.filter(_.pairs(arg), function(p) {return _.first(p[0]) !== '_'}));
                this.options = _.assign(this.options, newobj);
            }
        }
    },

    // Base of all constructors that accept a single parameter of Array type
    'Array': function() {
        var self = this;
        if (arguments.length === 0 || arguments.length > 1 || !_.isArray(arguments[0])) throw new Error('Constructor only accepts a single array as parameter');
        this._stringify = function(stringify) {
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
        this.array = arguments[0];
        this._stringify = function(stringify) {
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
    'SAOptionsHolder': function() {
        var self = this;
        self.options = {};
        for (var i = 0; i <= arguments[0].length - 1; i++) {
            var elem = arguments[0][i];
            if (jt.instance_of(elem, '_')) {
                var type = _.last(elem._path);
                if (type === 'Options' || type === 'Opt') {
                    assign_properties(elem);
                }
            } else if (_.isObject(elem)) {
                assign_properties(elem);
            }
        }
        function assign_properties(elem) {
            var newobj = _.object(_.filter(_.pairs(elem), function(p) {return _.first(p[0]) !== '_'}));
            self.options = _.assign(self.options, newobj);
        }
    },

    'SAGeometryHolder': function() {
        var geoms = _.filter(arguments[0], function(item) {
            return jt.instance_of(item, '$ChartSetup.Geometry');
        });
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
        var behaviors = _.filter(arguments[0], function(item) {
            return jt.instance_of(item, '$ChartSetup.Behavior');
        });
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
        this.markers = _.filter(arguments[0], function(item) {
            return jt.instance_of(item, 'Marker');
        });
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
    }, {virtual: true, pre: ['SAInit', 'SAGeometryHolder', 'SABehaviorHolder', 'SAMarkerHolder', 'SAOptionsHolder']}],

    '$Component': {

        'Geometry': '@$ChartSetup.Geometry',
        'Behavior': '@$ChartSetup.Behavior',
        'Marker': '@Marker',

        'Options': '@Options',
        'Opt': '@Options' // alias

    },

    // Markers

    'Marker': [function() {
    }, {virtual: true}],

    '$Marker': {
        'Options': '@Options',
        'Opt': '@Options', // alias
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

    }

};

jt.set_schema(schema);

return schema;

});
