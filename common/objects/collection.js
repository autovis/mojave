'use strict';

define(['underscore'], function(_) {

    function Indicator(config) {
        if (!(this instanceof Indicator)) return Indicator.apply(Object.create(Indicator.prototype), arguments);
        if (!_.isArray(config)) throw Error('Array expected for Indicator object');
        _.each(config, function(item) {
            if (item instanceof Config) {
                this.config = item;
            } else if (item instanceof Indicator) {
                this.indicator = item
            } else if (_.isString(item)) {
                this.inputs = item.split(',');
            } else if (_.isArray(item)) {
                this.inputs = item;
            } else if (_.isObject(item)) {
                this.config = Config(item);
            } else if (_.isNumber(item)) {
                this.inputs = [item];
            }
        });
        return this;
    }

    Indicator.prototype.eval = function() {
        return this.inputs[this.selection];
    };

    // ----------------------------------------------------------------------------------

    function Config(config) {
        if (!(this instanceof Config)) return Config.apply(Object.create(Config.prototype), arguments);
        if (!_.isObject(config)) throw Error('Object expected for Config object');
        _.each(config, function(val, key) {
            this[key] = val;
        })
        return this;
    }

    Indicator.prototype.eval = function() {
        return this.inputs[this.selection];
    };

    // ----------------------------------------------------------------------------------

    return {
        Indicator: Indicator
    };

});
