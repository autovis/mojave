'use strict';

define(['lodash', 'expression'], function(_, Expression) {

    return {

        param_names: ['expr_string', 'vars', 'output_type'],

        input: ['_*'],
        output: 'num',

        initialize: function() {
            if (this.param.output_type) this.output.set_type(this.param.output_type);
            var expr_vars = _.defaults(this.param.vars, {
                type: this.output.type,
                unitsize: _.isObject(this.inputs[0].instrument) ? this.inputs[0].instrument.unit_size : null,
                ticksize: _.isObject(this.inputs[0].instrument) ? this.inputs[0].instrument.tick_size : null
            });
            this.expr = new Expression(this.param.expr_string, {
                vars: expr_vars,
                streams: this.inputs
            });
            if (this.expr === null) throw new Error('Invalid expression: ' + this.param.expression);
        },

        on_bar_update: function() {
            this.output.set(this.expr.evaluate());
        }
    };

});
