'use strict';

define(['lodash', 'jsonoc_tools'], function(_, jt) {

var schema = {

    '$': {
        'Switch': true
    },

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

            'Collection': true,

            'Ind': function() { // variable parameters
                this.src = arguments[0];
                this.name = arguments[1];
                this.params = Array.prototype.slice.call(arguments, 2);
                this._stringify = function(stringify) {
                    var args = _.compact(_.flatten([this.src, this.name, this.params]));
                    return _.last(this._path) + '(' + args.map(stringify).join(', ') + ')';
                }
                return this;
            },

            '$Ind': {
                'Ind': true,
                'Options': true
            }

        }

    },

    'ChartSetup': [function() {
        this.components = _.filter(arguments[0], function(item) {
            return jt.instance_of(item, 'Component');
        });
        this.args = arguments;
    }, {pre: ['SACheck', 'SAGeometryHolder', 'SABehaviorHolder']}],

    '$ChartSetup': {

        'Geometry': '@Options',
        'Behavior': '@Options',

        // chart-level plots
        'Plot': function() {

            for (var i = 0; i <= arguments.length - 1; i++) {
                var arg = arguments[i];
                this.options = {};
                if (jt.instance_of(arg, '$ChartSetup.$Plot.Ind')) {
                    this.indicator = arg;
                } else if (_.isString(arg)) {
                    this.id = arg;
                } else if (_.isObject(arg)) {
                    this.options = _.assign(this.options, arg);
                }
            }
        },

        '$Plot': {
            'Ind': '@$Collection.$Timestep.Ind'
        },

        'PlotComponent': [function() {
            this.t = 1;
            for (var i = 0; i <= arguments.length - 1; i++) {
                var arg = arguments[i];
            }
        }, {extends: 'Component'}],

        '$PlotComponent': {
            'Geometry': true,
            'Behavior': true,
            'Plot': true,
            'HLine': function() {

            },
            'Options': '@Options'
        },

        'PanelComponent': [function() {
            this.controls = _.filter(arguments[0], function(item) {
                return jt.instance_of(item, 'Control');
            });
        }, {extends: 'Component'}],

        '$PanelComponent': {
            'Geometry': true,
            'Behavior': true,
            'LabelControl': [function() {
            }, {extends: 'Control'}],
            'RadioControl': [function() {
            }, {extends: 'Control'}],
            'CheckboxControl': [function() {
            }, {extends: 'Control'}],
            'Options': true
        },

        'MatrixComponent': [function() {
            this.rows = _.filter(arguments[0], function(item) {
                return jt.instance_of(item, '$ChartSetup.$MatrixComponent.MatrixRow');
            });
        }, {extends: 'Component'}],

        '$MatrixComponent': {
            'Geometry': true,
            'Behavior': true,
            'MatrixRow': function() {

            },
            'Options': '@Options'
        },

    },

    /////////////////////////////////////////////////////////////////////////////////////

    'Var': function(varname) {
        this.var = varname;
        return this;
    },

    'UseVar': '@Var',

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
        this.options = {};
        for (var i = 0; i <= arguments[0].length - 1; i++) {
            var elem = arguments[0][i];
            if (jt.instance_of(elem, 'Options') || _.isObject(elem)) {
                var newobj = _.object(_.filter(_.pairs(elem), function(p) {return _.first(p[0]) !== '_'}));
                this.options = _.assign(this.options, newobj);
            }
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
        }, null);
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
    }, {pre: ['SACheck', 'SAOptionsHolder']}],

    'Control': function() {
        this.id = _.first(arguments);
    }

};

jt.set_schema(schema);

return schema;

});
