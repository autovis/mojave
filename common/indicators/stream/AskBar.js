'use strict';

define(['indicators/plot/Candle'], function(Candle) {
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

        plot_render_fields: Candle.plot_subfields,
        plot_init: Candle.plot_init,
        plot_render: Candle.plot_render,
        plot_update: Candle.plot_update
    };

    function parseDate(str) {
        var t = str.split(/[- :]/);
        return new Date(t[0], t[1] - 1, t[2], t[3], t[4], t[5]);
    }
});
