define([], function() {
    return {

        param_names: [],

        input: 'object',
        output: 'candle_bar',

        // Initialize indicator
        initialize: function(params, input_streams, output_stream) {
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output_stream) {
            output_stream.set({
                date: parseDate(input_streams[0].get(0).date),
                open: parseFloat(input_streams[0].get(0).bid_open),
                high: parseFloat(input_streams[0].get(0).bid_high),
                low: parseFloat(input_streams[0].get(0).bid_low),
                close: parseFloat(input_streams[0].get(0).bid_close),
                volume: parseInt(input_streams[0].get(0).volume)
            });
        }

    };

    function parseDate(str) {
        var t = str.split(/[- :]/);
        return new Date(t[0], t[1]-1, t[2], t[3], t[4], t[5]);
    }
})
