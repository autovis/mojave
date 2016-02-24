'use strict';

define(['indicators/vis/Price'], function(Price) {
    return {
        param_names: [],

        input: ['dual_candle_bar'],
        output: 'candle_bar',

        // Initialize indicator
        initialize: function(params, input_streams, output_stream) {
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output_stream) {
            var inp = input_streams[0].get(0);
            output_stream.set({
                date: inp.date,
                volume: inp.volume,
                open: (inp.ask.open + inp.bid.open) / 2,
                high: (inp.ask.high + inp.bid.high) / 2,
                low: (inp.ask.low + inp.bid.low) / 2,
                close: (inp.ask.close + inp.bid.close) / 2
            });
        },

        vis_render_fields: Price.vis_render_fields,
        vis_init: Price.vis_init,
        vis_render: Price.vis_render,
        vis_update: Price.vis_update
    };
});
