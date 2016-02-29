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
        var self = this;
        self.vars = {};
        self.inputs = {};
        self.indicators = {};
        _.each(arguments[0], function(item) {
            if (jt.instance_of(item, '$Collection.Timestep')) {
                var tstep = item.tstep;
                _.each(item.inputs, function(inp, key) {
                    if (_.has(self.inputs, key)) throw new Error('Input "' + key + "' is already defined elsewhere");
                    self.inputs[key] = inp;
                });
                _.each(item.indicators, function(ind, key) {
                    if (_.has(self.indicators, key)) throw new Error('Indicator "' + key + "' is already defined elsewhere");
                    self.indicators[key] = ind;
                });
            } else if (jt.instance_of(item, '$Collection.Vars')) {
                self.vars = _.assign(self.vars, item);
            }
        });
        return self;
    }, {pre: ['SAInit', 'SAOptHolder']}],

    '$Collection': {

        'Vars': '@Vars',

        'Timestep': [function(tstep, streams) {
            var self = this;
            if (!(_.isString(tstep) || jt.instance_of(tstep, 'Var')) || !_.isObject(streams)) throw new Error('Usage: Timestep(<timestep:(str|Var)>, <streams:map>)');
            self.tstep = tstep;
            self.streams = streams;
            self.inputs = {};
            self.indicators = {};
            _.each(streams, function(val, key) {
                if (_.isString(val)) val = jt.create('$Collection.$Timestep.Stream', [val]);
                val.tstep = self.tstep;
                if (jt.instance_of(val, '$Collection.$Timestep.Input')) {
                    self.inputs[key] = val;
                } else if (jt.instance_of(val, '$Collection.$Timestep.Ind')) {
                    self.indicators[key] = val;
                } else if (jt.instance_of(val, '$Collection.$Timestep.Stream')) {
                    self.indicators[key] = val;
                }
            });
            return self;
        }],

        '$Timestep': {

            'Collection': '@Collection',

            'Src': [function() {
            }, {virtual: true}],

            'Input': [function(type, options) {
                if (!type) throw new Error('Usage: Input(<type>, <options_map>) where "type" parameter is required');
                this.type = type;
                this.options = options || {};
            }, {extends: '$Collection.$Timestep.Src', pre: ['VarResolver', 'OptHolder']}],

            'Ind': [function() { // variable parameters
                var err_msg = 'Usage: Ind(<source>, <ind_name_str>, <param1>, <param2>, ...) where "source" may be a comma-delimited list of sources, an array of sources, or a nested Ind(...) value';
                var args = _.filter(arguments, arg => !jt.instance_of(arg, 'Opt'));
                if (_.isNull(args[0])) {
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
                this.params = Array.prototype.slice.call(args, 2);
                this._stringify = function(stringify) {
                    var args = _.flatten(_.compact([this.src, this.name, this.params]));
                    if (!_.isEmpty(this.options)) args.push(jt.create('Opt', [this.options]));
                    return _.last(this._path) + '(' + args.map(stringify).join(', ') + ')';
                };
                //return this;
            }, {extends: '$Collection.$Timestep.Src', pre: ['VarResolver', 'OptHolder']}],

            '$Ind': {
                'Ind': '@$Collection.$Timestep.Ind',
                'Switch': '@Switch',
                'opt': '@optimizer'
            },

            'Stream': [function(src) {
                this.src = src;
            }, {extends: '$Collection.$Timestep.Src', pre: ['VarResolver', 'OptHolder']}]

        }

    },

    // *************************************
    // ChartSetup
    // *************************************

    'ChartSetup': [function() {
        this.components = _.filter(this.array, item => jt.instance_of(item, 'Component'));
    }, {pre: ['SAInit', 'SAGeometryHolder', 'SABehaviorHolder', 'SAMarkerHolder', 'SAOptHolder']}],

    '$ChartSetup': {

        'Vars': '@Vars',

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

    'UseVar': '@Var', // alias

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

    // Declare and assign multiple vars using key/value map
    'Vars': '@KeyValueMap',

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

    'VarResolver': function() {
        this._resolve = function resolve(vars) {
            var self = this;
            var copy;
            if (jt.instance_of(self, 'Var')) {
                return vars[self.var];
            } else if (jt.instance_of(self, '_')) {
                copy = jt.create(this._path.join('.'), this._args);
                _.each(self, (val, key) => copy[key] = resolve.apply(val, [vars]));
                return copy;
            } else if (_.isArray(self)) {
                return _.map(self, val => resolve.apply(val, [vars]));
            } else if (_.isObject(self)) {
                copy = {};
                _.each(self, (val, key) => copy[key] = resolve.apply(val, [vars]));
                return copy;
            } else {
                return self;
            }
        };

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

    }

};

jt.set_schema(schema);

return schema;

});
