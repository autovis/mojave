define(['indicators/vis/Price'], function(Price) {
    return {

        param_names: [],

        input: 'object',
        output: 'candle_bar',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            output_stream.set({
                date: parseDate(input_streams[0].get(0).date),
                open: parseFloat(input_streams[0].get(0).ask_open),
                high: parseFloat(input_streams[0].get(0).ask_high),
                low: parseFloat(input_streams[0].get(0).ask_low),
                close: parseFloat(input_streams[0].get(0).ask_close),
                volume: parseInt(input_streams[0].get(0).volume)
            });
        },

        vis_render_fields: Price.vis_subfields,
        vis_init: Price.vis_init,
        vis_render: Price.vis_render,
        vis_update: Price.vis_update
    };

    function parseDate(str) {
        var t = str.split(/[- :]/);
        return new Date(t[0], t[1]-1, t[2], t[3], t[4], t[5]);
    }
})
