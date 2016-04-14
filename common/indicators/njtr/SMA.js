'use strict';

define({

    param_names: ['period'],

    input: 'num',
    output: 'num',

    initialize: function(params, input_streams, output_stream) {
        this.input = input_streams[0];
    },

    on_bar_update: function(params, input_streams, output) {
        var input = this.input;

        /*
		if (CurrentBar == 0)
			Value.Set(Input[0]);
		else
		{
			double last = Value[1] * Math.Min(CurrentBar, Period);

			if (CurrentBar >= Period)
				Value.Set((last + Input[0] - Input[Period]) / Math.Min(CurrentBar, Period));
			else
				Value.Set((last + Input[0]) / (Math.Min(CurrentBar, Period) + 1));
		}
        */

        if (this.current_index() === 0) {
            output.set(input.get(0));
        } else {
            var last = output.get(1) * Math.min(this.current_index(), params.period);

            if (this.current_index() >= params.period)
                output.set((last + input.get(0) - input.get(params.period)) / Math.min(this.current_index(), params.period));
            else
                output.set((last + input.get(0)) / (Math.min(this.current_index(), params.period) + 1));
        }
    }

});
