'use strict';

define(['lodash'], function(_) {

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

    'ChartSetup': function() {

    },

    '$ChartSetup': {

        'Geometry': '@Options',

        'Behavior': '@Options',

        // chart-level plots
        'Plot': function() {

            for (var i = 0; i <= arguments.length - 1; i++) {
                var arg = arguments[i];
                this.options = {};
                if (instance_of(arg, '$ChartSetup.$Plot.Ind')) {
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

        'PlotComponent': [function plotcomponent() {
            for (var i = 0; i <= arguments.length - 1; i++) {
                var arg = arguments[i];
            }
        }, {pre: ['SingleArrayArg', 'OptionsHolder']}],

        '$PlotComponent': {
            'Geometry': true,
            'Behavior': true,
            'Plot': true,
            'HLine': function() {

            },
            'Options': '@Options'
        },

        'PanelComponent': function() {
        },

        '$PanelComponent': {
            'Geometry': true,
            'Behavior': true,
            'LabelControl': function() {
            },
            'RadioControl': function() {
            },
            'CheckboxControl': function() {
            },
            'Options': '@Options'
        },

        'MatrixComponent': function() {
        },

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

    'OptionsHolder': [function() {
        this.options = {};
        for (var i = 0; i <= arguments.length - 1; i++) {
            var arg = arguments[i];
            if (instance_of(arg, 'Options') || _.isObject(arg)) {
                var newobj = _.object(_.filter(_.pairs(arg), function(p) {return _.first(p[0]) !== '_'}));
                this.options = _.assign(this.options, newobj);
            }
        }
    }, {pre: 'SingleArrayArg'}],

    'Switch': function() {
        //throw new Error('Switch is unsupported');
    },

    'SingleArrayArg': function() {
        if (arguments.length === 0 || arguments.length > 1 || !_.isArray(arguments[0])) throw new Error('Constructor only accepts a single array as parameter');
    }
};

return schema;

/////////////////////////////////////////////////////////////////////////////////////////

function instance_of(obj, pathstr) {
    var path = pathstr.split('.');
    var constr = path.reduce(function(memo, tok) {
        if (!_.has(memo, tok)) throw new Error('Token "' + tok + '" not found in path string: ' + pathstr);
        return memo[tok];
    }, schema);
    return obj instanceof constr;
}

function call_constructor(pathstr) {

}

});
