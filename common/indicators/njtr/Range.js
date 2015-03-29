define({

    param_names: [],

    input: 'candle_bar',
    output: 'float',

    initialize: function(params, input_streams) {
        this.input = input_streams[0].simple();
    },

    on_bar_update: function(params, input_streams, output_stream) {
        //Value.Set(High[0] - Low[0]);
        output_stream.set(this.input.high(0) - this.input.low(0));
    }

})
