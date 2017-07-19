'use strict';

define({

    description: 'Always returns FLAT (0)',

    param_names: [],

    input: ['_'],
    output: 'direction',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {
        output_stream.set(0);
    }
});
