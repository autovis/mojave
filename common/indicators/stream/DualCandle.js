'use strict';

define([], function() {
    return {

        param_names: [],

        input: 'object',
        output: 'dual_candle_bar',

        initialize: function(params) {
        },

        on_bar_update: function(params, input_streams, output) {
            var inp = input_streams[0].get(0);
            var out = output.get(0);
            out.date = parseDate(inp.date);
            out.ask = {};
            out.ask.open = parseFloat(inp.ask.open);
            out.ask.high = parseFloat(inp.ask.high);
            out.ask.low = parseFloat(inp.ask.low);
            out.ask.close = parseFloat(inp.ask.close);
            out.bid = {};
            out.bid.open = parseFloat(inp.bid.open);
            out.bid.high = parseFloat(inp.bid.high);
            out.bid.low = parseFloat(inp.bid.low);
            out.bid.close = parseFloat(inp.bid.close);
            out.volume = parseInt(inp.volume);
        }
    };

    function parseDate(str) {
        if (str instanceof Date) return str;
        var t = str.split(/[- :]/);
        return new Date(t[0], t[1] - 1, t[2], t[3], t[4], t[5]);
    }
});
