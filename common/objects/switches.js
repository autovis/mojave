'use strict';

define(['underscore'], function(_) {

    function Switch(inputs, default_selection) {
        if (!(this instanceof Switch)) return Switch.apply(Object.create(Switch.prototype), arguments);
        this.inputs = inputs;
        this.selection = default_selection;
        return this;
    }

    Switch.prototype.eval = function() {
        return this.inputs[this.selection];
    };

    return {
        Switch: Switch
    };

});
