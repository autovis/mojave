'use strict';

define({

    description: 'AND boolean operator',

    param_names: [],

    input: ['bool+'],
    output: 'bool',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {

        var value = input_streams.map(str => str.get()).reduce(function(prev, curr) {
            return prev === undefined ? curr : (prev || curr || false);
        }, undefined);

        output_stream.set(value);
    }
});
