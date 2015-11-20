'use strict';

define(['lodash'], function(_) {

var schema = {

    '$': {

        'Var': function(varname) {
            this.var = varname;
            return this;
        },

        'Opt': function(obj) {
            _.each(obj, function(val, key) {this[key] = val});
            return this;
        }

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
                return this._type + '({' + pairs.map(function(p) {return JSON.stringify(p[0]) + ': ' + stringify(p[1])}).join(', ') + '})';
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
                    return this._type + '(' + args.map(stringify).join(', ') + ')';
                }
                return this;
            },

            '$Ind': {

                'Ind': true,

                'Opt': function(obj) {
                    _.each(obj, function(val, key) {this[key] = val});
                    return this;
                }

            }

        }

    },

    'ChartSetup': function() {

    },

    '$ChartSetup': {

    }

};

/////////////////////////////////////////////////////////////////////////////////////////

return schema;

});
