define([], function() {
    return {

        param_names: [],

        input: 'object',
        output: 'tickvol',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            output_stream.set({
                date: parseDate(input_streams[0].get(0).date),
                ask: parseFloat(input_streams[0].get(0).ask),
                bid: parseFloat(input_streams[0].get(0).bid),
                volume: parseInt(input_streams[0].get(0).volume)
            });
        },
    };

    function parseDate(str) {
        var t = str.split(/[- :]/);
        return new Date(t[0], t[1]-1, t[2], t[3], t[4], t[5]);
    }
})