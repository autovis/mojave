'use strict';

define([], function() {
    return {
        description: `Creates a "candle_bar" stream by averaging ask/bid prices from a "dual_candle_bar" stream`,

        param_names: [],

        input: 'dual_candle_bar',
        output: 'candle_bar',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var dual_bar = input_streams[0].get(0);
            output_stream.set({
                date: dual_bar.date,
                volume: dual_bar.volume,
                open: (dual_bar.ask.open + dual_bar.bid.open) / 2,
                high: (dual_bar.ask.high + dual_bar.bid.high) / 2,
                low: (dual_bar.ask.low + dual_bar.bid.low) / 2,
                close: (dual_bar.ask.close + dual_bar.bid.close) / 2
            });
        }

    };
});
