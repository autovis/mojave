'use strict';

// unconfirmed

define(['indicators/SMA'], function(SMA) {
    return {

        param_names: ['period'],

        input: 'num',
        output: 'float',

        initialize: function(params, input_streams, output_stream) {
            this.input = input_streams[0];
            this.sma = this.indicator([SMA, params.period], input_streams);
        },

        on_bar_update: function(params, input_streams, output) {
            var input = this.input;

            /*
		    if (CurrentBar == 0)
			    Value.Set(0);
		    else
		    {
			    double mean = 0;
			    for (int idx = Math.Min(CurrentBar, Period - 1); idx >= 0; idx--)
				    mean += Math.Abs(Typical[idx] - SMA(Typical, Period)[0]);
			    Value.Set((Typical[0] - SMA(Typical, Period)[0]) / (mean == 0 ? 1 : (0.015 * (mean / Math.Min(Period, CurrentBar + 1)))));
		    }
            */

            this.sma.update();
            if (this.current_index() === 0) {
                output.set(0);
            } else {
                var mean = 0;
                for (var idx = Math.min(this.current_index(), params.period - 1); idx >= 0; idx--)
                    mean += Math.abs(this.input.get(idx) - this.sma.get(0));
                output.set((this.input.get(0) - this.sma.get(0)) / (mean === 0 ? 1 : (0.015 * (mean / Math.min(params.period, this.current_index() + 1)))));
            }
        }
    }
})