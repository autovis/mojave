'use strict';

define(['lodash'], function(_) {
    return {

        description: `Computes (input.close - input.open)`,

        param_names: [],

        input: ['candle_bar'],
        output: 'num',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var bar = input_streams[0].get();
            output_stream.set(bar.close - bar.open);
        },
    };
});
