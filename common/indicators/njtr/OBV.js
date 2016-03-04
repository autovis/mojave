'use strict';

define({

    param_names: [],

    input: 'candle_bar',
    output: 'float',

    initialize: function(params, input_streams, output_stream) {
        this.input = input_streams[0].simple();
    },

    on_bar_update: function(params, input_streams, output) {

        var input = this.input;

        /*
		if (CurrentBar == 0)
			Value.Set(0);
		else
		{
			if (Close[0] > Close[1])
				Value.Set(Value[1]+ Volume[0]);
			else if (Close[0]  < Close[1])
				Value.Set(Value[1] - Volume[0]);
			else
				Value.Set(Value[1]);
		}
        */
        if (this.current_index() === 0) {
            output.set(0);
        } else if (input.close(0) > input.close(1)) {
            output.set(output.get(1) + input.volume(0));
        } else if (input.close(0) < input.close(1)) {
            output.set(output.get(1) - input.volume(0));
        } else {
            output.set(output.get(1));
        }
    },

});
