'use strict';

define(['lodash'], function(_) {
    return {

        description: `Returns the input stream's value at <bars_ago> bars before the current`,

        param_names: ['bars_ago'],

        input: ['^a'],
        output: '^a',

        initialize: function(params, input_streams, output_stream) {
            if (params.bars_ago < 1) throw new Error('<bars_ago> param must be an integer greater than 0');
        },

        on_bar_update: function(params, input_streams, output_stream) {
            if (this.current_index() >= params.bars_ago) {
                output_stream.set(input_streams[0].get(params.bars_ago));
            }
        },
    };
});
