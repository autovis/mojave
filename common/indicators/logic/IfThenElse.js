'use strict';

define(['lodash'], function(_) {
    return {

        param_names: [],

        input: ['bool', '*', '*'],
        output: '*',

        initialize: function(params, input_streams, output_stream) {
            if (input_streams[1].type !== input_streams[2].type)
                throw new Error('3rd input stream must have same type as 2nd');
            output_stream.type = input_streams[1].type;
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var cond = input_streams[0].get();
            if (cond) {
                output_stream.set(input_streams[1].get());
            } else if (input_streams.length > 2) {
                output_stream.set(input_streams[2].get());
            } else {
                output_stream.set(null);
            }
        },
    };
});
