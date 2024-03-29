'use strict';

define({

    description: 'Returns (InputA - InputB)',

    param_names: [],

    input: ['num', 'num'],
    output: 'num',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {
        if (this.current_index() === 0) {
            output_stream.set(null);
        } else {
            output_stream.set(input_streams[0].get(0) - input_streams[1].get(0));
        }
    }
});
