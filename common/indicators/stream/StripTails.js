'use strict';

define(['indicators/vis/Price'], Price => {
    return {
        param_names: [],

        input: ['candle_bar'],
        output: 'candle_bar',

        // Initialize indicator
        initialize: function(params, input_streams, output_stream) {
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output_stream) {
            output_stream.set({
                date: input_streams[0].get(0).date,
                volume: input_streams[0].get(0).volume,
                open: input_streams[0].get(0).open,
                high: Math.max(input_streams[0].get(0).open, input_streams[0].get(0).close),
                low: Math.min(input_streams[0].get(0).open, input_streams[0].get(0).close),
                close: input_streams[0].get(0).close
            });
        },

        vis_render_fields: Price.vis_render_fields,
        vis_init: Price.vis_init,
        vis_render: Price.vis_render,
        vis_update: Price.vis_update
    };
});
