'use strict';

define([], function() {

    return {

        param_names: [],

        input: ['num', 'num+'],
        output: 'num',

        // Initialize indicator
        initialize: function(params, input_streams, output) {
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output) {
            var sum = input_streams.reduce((memo, val) => memo + val, 0);
            output.set(sum);
        }
    };
});
