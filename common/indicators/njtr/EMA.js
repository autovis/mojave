define({

    param_names: ["period"],

    input: 'num',
    output: 'float',

    initialize: function(params, input_streams, output_stream) {
        this.input = input_streams[0];
    },

    on_bar_update: function(params, input_streams, output_stream) {
	    // Value.Set(CurrentBar == 0 ? Input[0] : Input[0] * (2.0 / (1 + Period))        + (1 - (2.0 / (1 + Period)))        * Value[1]);  // or input(0) if undefined
        var value = this.current_index() == 0 ? this.input.get(0) : this.input.get(0) * (2.0 / (1 + params.period)) + (1 - (2.0 / (1 + params.period))) * output_stream.get(1) || this.input.get(0);
        output_stream.set(value);
    }

});
