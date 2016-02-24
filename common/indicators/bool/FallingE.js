'use strict';

define({

    // Whether current input value is equal to or decreasing from previous value

    param_names: [],

    input: 'num',
    output: 'bool',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {

        if (this.current_index() === 0) {
            output_stream.set(null);
        } else {
            output_stream.set(input_streams.every(str => str.get(0) <= str.get(1)));
        }
    }
});
