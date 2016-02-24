'use strict';

define([], function() {

    return {

        param_names: [],

        input: ['num'],
        output: 'num',

        // Initialize indicator
        initialize: function(params, input_streams, output) {
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0) - input_streams[1].get(0));
        }
    };
});
