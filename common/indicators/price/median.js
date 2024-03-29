'use strict';

define({

    param_names: [],

    input: 'candle_bar',
    output: 'num',

    initialize: function(params, input_streams, output_stream) {
        this.input = input_streams[0].simple();
    },

    on_bar_update: function(params, input_streams, output_stream) {
        output_stream.set((this.input.high(0) + this.input.low(0)) / 2);
    }
});
