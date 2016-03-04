'use strict';

define({

    description: 'Always returns false',

    param_names: [],

    input: ['_'],
    output: 'bool',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {
        output_stream.set(false);
    }
});
