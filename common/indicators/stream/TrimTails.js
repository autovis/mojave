'use strict';

define(['indicators/plot/Candle'], Candle => {
    return {
        param_names: ['trim_frac'],

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

        plot_render_fields: Candle.plot_render_fields,
        plot_init: Candle.plot_init,
        plot_render: Candle.plot_render,
        plot_update: Candle.plot_update
    };
});
