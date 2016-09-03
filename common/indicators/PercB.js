'use strict';

define(['lodash'], function(_) {

    return {

        description: `%B indicator, typically used with Bollinger Bands, but any pair of bands can be supplied.
                      Formula: %B = (Price - Lower Band) / (Upper Band - Lower Band)`,

        param_names: [],

        input: ['num', 'num', 'num'],
        input_names: ['price', 'upper_band', 'lower_band'],
        output: 'num',

        initialize: function(params, input_streams) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var price = input_streams[0].get();
            var upper = input_streams[1].get();
            var lower = input_streams[2].get();
            var percb = (price - lower) / (upper - lower);
            if (_.isFinite(percb)) {
                output_stream.set(percb);
            } else {
                output_stream.set(0.5);
            }
        },
    };
});
