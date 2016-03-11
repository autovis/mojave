'use strict';

const LONG = 1, SHORT = -1;

define({

    description: 'Returns LONG if InputA crosses above InputB; SHORT if InputA crosses below InputB; else null',

    param_names: [],

    input: ['num', 'num'],
    output: 'direction',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {

        if (this.current_index() === 0) {
            output_stream.set(null);
        } else {
            var currdiff = input_streams[0].get(0) - input_streams[1].get(0);
            var prevdiff = input_streams[0].get(1) - input_streams[1].get(1);
            if (currdiff >= 0 && prevdiff < 0) {
                output_stream.set(LONG);
            } else if (currdiff <= 0 && prevdiff > 0) {
                output_stream.set(SHORT);
            } else {
                output_stream.set(null);
            }
        }
    }
});
