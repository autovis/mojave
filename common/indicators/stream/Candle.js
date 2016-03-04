'use strict';

define([], function() {
    return {

        param_names: [],

        input: 'object',
        output: 'candle_bar',

        initialize: function(params) {
        },

        on_bar_update: function(params, input_streams, output) {
            var inp = input_streams[0].get(0);
            var out = output.get(0);
            out.date = parseDate(inp.date);
            out.open = parseFloat(inp.open);
            out.high = parseFloat(inp.high);
            out.low = parseFloat(inp.low);
            out.close = parseFloat(inp.close);
            out.volume = parseInt(inp.volume);
        }
    };

    function parseDate(str) {
        if (str instanceof Date) return str;
        var t = str.split(/[- :]/);
        return new Date(t[0], t[1] - 1, t[2], t[3], t[4], t[5]);
    }
});
