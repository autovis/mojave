'use strict';

define(['lodash'], function(_) {
    return {

        description: 'Outputs the give <const> on every bar',

        param_names: ['const'],

        input: ['_'],
        output: '_',

        initialize: function(params, input_streams, output_stream) {
            this.const = params.const;
        },

        on_bar_update: function(params, input_streams, output_stream) {
            output_stream.set(this.const);
        },
    };
});
