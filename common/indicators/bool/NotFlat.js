'use strict';

define([], function() {

    const LONG = 1, SHORT = -1, FLAT = 0;

    return {
        description: `if inputA = (LONG or SHORT) then true; else if inputA = FLAT then false; else null`,

        param_names: [],

        input: 'direction',
        output: 'bool',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var val = input_streams[0].get();
            if (val === LONG || val === SHORT) {
                output_stream.set(true);
            } else if (val === FLAT) {
                output_stream.set(false);
            } else {
                output_stream.set(null);
            }
        }
    };
});
