'use strict';

define(['lodash', 'jsonoc_tools'], function(_, jt) {

var schema = {

    'Collection': function(directives) {
        this.directives = directives;
        return this;
    },

    '$Collection': {

        'DefVars': function(assigns) {
            _.each(assigns, function(val, key) {this[key] = val}, this);
            this._stringify = function(stringify) {
                var pairs = _.filter(_.pairs(this), function(pair) {
                    return _.first(pair[0]) !== '_';
                });
                return _.last(this._path) + '({' + pairs.map(function(p) {return JSON.stringify(p[0]) + ': ' + stringify(p[1])}).join(', ') + '})';
            };
            return this;
        },

        'Input': function(inputs) {
            this.inputs = inputs;
            return this;
        },

        'Timestep': function(tstep, indicators) {
            this.tstep = tstep;
            this.indicators = indicators;
            return this;
        },

        '$Timestep': {

            'Collection': '@Collection',

            'Ind': [function() { // variable parameters
                if (_.isArray(arguments[0])) {
                    this.src = arguments[0];
                } else if (_.isString(arguments[0])) {
                    this.src = arguments[0].split(',').map(function(str) {return str.trim()});
                } else {
                    this.src = [arguments[0]];
                }
                this.name = arguments[1];
                if (!_.isString(this.name)) throw new Error('Argument #2 (name) must be a string');
                this.params = Array.prototype.slice.call(arguments, 2);
                this._stringify = function(stringify) {
                    var args = _.flatten(_.compact([this.src, this.name, this.params]));
                    return _.last(this._path) + '(' + args.map(stringify).join(', ') + ')';
                }
                return this;
            }, {extends: 'SAOptionsHolder'}],

            '$Ind': {
                'Ind': '@$Collection.$Timestep.Ind',
            }

        }

    },

    'ChartSetup': [function() {
        this.components = _.filter(arguments[0], function(item) {
            return jt.instance_of(item, 'Component');
        });
        this._stringify = function() {

        };
    }, {pre: ['SACheck', 'SAGeometryHolder', 'SABehaviorHolder', 'SAMarkerHolder', 'SAOptionsHolder']}],

    '$ChartSetup': {

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
            if (!this.id) throw new Error("No ID specified for plot");
        },

        '$Plot': {
            'Ind': '@$Collection.$Timestep.Ind',
            'Switch': '@Switch'
        },

        'PlotComponent': [function(arr) {
            this.plots = _.filter(arr, function(item) {
                return jt.instance_of(item, '$ChartSetup.Plot');
            });
        }, {extends: 'Component'}],

        '$PlotComponent': {
            'Plot': '@$ChartSetup.Plot',
        },

        'PanelComponent': [function(arr) {
            this.controls = _.filter(arr, function(item) {
                return jt.instance_of(item, 'Control');
            });
        }, {extends: 'Component'}],

        '$PanelComponent': {
            'Control': '@Control'
        },

        'MatrixComponent': [function(arr) {
            this.rows = _.filter(arr, function(item) {
                return jt.instance_of(item, '$ChartSetup.$MatrixComponent.MatrixRow');
            });
        }, {extends: 'Component'}],

        '$MatrixComponent': {
            'MatrixRow': function(id, name) {
                this.id = id;
                this.name = name;
            }
        },

    },

    /////////////////////////////////////////////////////////////////////////////////////

    'Var': function(varname) {
        this.var = varname;
        return this;
    },

    'UseVar': '@Var', // alias

    'Options': function(obj) {
        _.each(obj, function(val, key) {this[key] = val}, this);
        this._stringify = function(stringify) {
            var pairs = _.filter(_.pairs(this), function(pair) {
                return _.first(pair[0]) !== '_';
            });
            return _.last(this._path) + '({' + pairs.map(function(p) {return JSON.stringify(p[0]) + ': ' + stringify(p[1])}).join(', ') + '})';
        };
        return this;
    },

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

    // To validate that the constructor is only taking a single array parameter
    'SACheck': function() {
        if (arguments.length === 0 || arguments.length > 1 || !_.isArray(arguments[0])) throw new Error('Constructor only accepts a single array as parameter');
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
        if (arguments.length < 2) throw new Error('"Switch" constructor accepts at least 2 parameters');
        this.var = arguments[0];
        this.mapping = arguments[1];
        if (arguments[2] !== undefined) this.default = arguments[2];
        return this;
    },

    // $ChartSetup ----------------------------------------------------------------------

    'Component': [function() {
    }, {virtual: true, pre: ['SACheck', 'SAGeometryHolder', 'SABehaviorHolder', 'SAMarkerHolder', 'SAOptionsHolder']}],

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
        this.id = arguments[0];
    }, {virtual: true}],

    'LabelControl': [function() {
        this.text = arguments[1];
    }, {extends: 'Control'}],

    'RadioControl': [function() {
        this.choices = arguments[1];
        this.selected = arguments[2];
    }, {extends: 'Control'}],

    'CheckboxControl': [function() {
        this.text = arguments[1];
        this.selected = arguments[2];
    }, {extends: 'Control'}]

};

jt.set_schema(schema);

return schema;

});
