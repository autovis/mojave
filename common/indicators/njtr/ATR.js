'use strict';

define({

    param_names: ['period'],

    input: 'candle_bar',
    output: 'float',

    initialize: function(params, input_streams, output_stream) {
        this.input = input_streams[0].simple();
    },

    on_bar_update: function(params, input_streams, output) {

        var input = this.input;

        /*
		if (CurrentBar == 0)
			Value.Set(High[0] - Low[0]);
		else
		{
			double trueRange = High[0] - Low[0];
			trueRange = Math.Max(Math.Abs(Low[0] - Close[1]), Math.Max(trueRange, Math.Abs(High[0] - Close[1])));
			Value.Set(((Math.Min(CurrentBar + 1, Period) - 1 ) * Value[1] + trueRange) / Math.Min(CurrentBar + 1, Period));
		}
        */
        var value;
        if (this.current_index() === 0) {
            value = input.high(0) - input.low(0);
        } else {
            var trueRange = input.high(0) - input.low(0);
            trueRange = Math.max(Math.abs(input.low(0) - input.close(1)), Math.max(trueRange, Math.abs(input.high(0) - input.close(1))));
            value = ((Math.min(this.current_index() + 1, params.period) - 1) * output.get(1) + trueRange) / Math.min(this.current_index() + 1, params.period);
        }
        output.set(Math.round(value * 100000) / 100000);
    }
});
