define(['indicators/vis/Price'], function(Price) {
    return {
        param_names: [],

        input: ['candle_bar*'],
        output: 'candle_bar',

        // Initialize indicator
        initialize: function(params, input_streams, output_stream) {
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output_stream) {
            output_stream.set({
                date: input_streams[0].get(0).date,
                volume: input_streams[0].get(0).volume,
                open: input_streams.reduce(function(sum, stream) {return sum + stream.get(0).open}, 0) / input_streams.length,
                high: input_streams.reduce(function(sum, stream) {return sum + stream.get(0).high}, 0) / input_streams.length,
                low: input_streams.reduce(function(sum, stream) {return sum + stream.get(0).low}, 0) / input_streams.length,
                close: input_streams.reduce(function(sum, stream) {return sum + stream.get(0).close}, 0) / input_streams.length
            });
        },

        vis_render_fields: Price.vis_render_fields,
        vis_init: Price.vis_init,
        vis_render: Price.vis_render,
        vis_update: Price.vis_update
    };
})