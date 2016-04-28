'use strict';

define(['lodash', 'expression'], function(_, Expression) {

    return {

        param_names: ['expr_string', 'vars'],

        input: ['^a+'],
        output: 'num',

        initialize: function(params, input_streams, output) {
            var vars = _.defaults(params.vars, {
                unitsize: _.isObject(input_streams[0].instrument) ? input_streams[0].instrument.unit_size : null,
                ticksize: _.isObject(input_streams[0].instrument) ? input_streams[0].instrument.tick_size : null
            });
            this.expr = new Expression(params.expr_string.trim(), {
                vars: vars,
                streams: input_streams
            });
            if (this.expr === null) throw new Error('Invalid expression: ' + params.expression);
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(parseFloat(this.expr.evaluate()));
        }
    };

});
