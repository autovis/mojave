'use strict';

define({

    description: 'Returns direction if all input streams have the same sign; else returns false',

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
            return prev === undefined ? curr : (curr === prev ? curr : null);
        }, undefined);

        output_stream.set(value);
    }
});
