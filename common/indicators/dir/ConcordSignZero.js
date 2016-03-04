'use strict';

define({

    // returns LONG if one input is > 0 and the rest are >= 0
    // returns SHORT if one input is < 0 and the rest are <= 0
    // returns FLAT if all inputs are 0

    param_names: [],

    input: ['num*'],
    output: 'direction',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {

        var value = input_streams.map(function(stream) {
            var num = stream.get(0);
            return num > 0 ? 1 : (num < 0 ? -1 : 0);
        }).reduce(function(prev, curr) {
            return prev === undefined ? curr : (curr === prev || curr === 0 ? prev : null);
        }, undefined);

        output_stream.set(value);
    }
});
