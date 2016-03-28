'use strict';

define(['lodash', 'indicators/SMA'], function(_, SMA) {
    return {

        param_names: ['period'],

        input: 'num',
        output: 'float',

        initialize: function(params, input_streams, output) {
            this.input = input_streams[0];

            this.avg_up = this.stream('avg_up');
            this.avg_down = this.stream('avg_down');
            this.up = this.stream('up');
            this.down = this.stream('down');

            this.sma_up = this.indicator([SMA, params.period], this.up);
            this.sma_down = this.indicator([SMA, params.period], this.down);
        },

        on_bar_update: function(params, input_streams, output) {

            var input = this.input;

            var avg_up = this.avg_up;
            var avg_down = this.avg_down;
            var up = this.up;
            var down = this.down;
            var sma_up = this.sma_up;
            var sma_down = this.sma_down;

            avg_up.next();
            avg_down.next();
            up.next();
            down.next();

            /*
		    if (CurrentBar == 0)
		    {
			    down.Set(0);
			    up.Set(0);

                if (Period < 3)
                    Avg.Set(50);
			    return;
		    }

		    down.Set(Math.Max(Input[1] - Input[0], 0));
		    up.Set(Math.Max(Input[0] - Input[1], 0));

		    if ((CurrentBar + 1) < Period)
		    {
			    if ((CurrentBar + 1) == (Period - 1))
				    Avg.Set(50);
			    return;
		    }

		    if ((CurrentBar + 1) == Period)
		    {
			    // First averages
			    avgDown.Set(SMA(down, Period)[0]);
			    avgUp.Set(SMA(up, Period)[0]);
		    }
		    else
		    {
			    // Rest of averages are smoothed
			    avgDown.Set((avgDown[1] * (Period - 1) + down[0]) / Period);
			    avgUp.Set((avgUp[1] * (Period - 1) + up[0]) / Period);
		    }

		    double rsi	  = avgDown[0] == 0 ? 100 : 100 - 100 / (1 + avgUp[0] / avgDown[0]);
		    double rsiAvg = (2.0 / (1 + Smooth)) * rsi + (1 - (2.0 / (1 + Smooth))) * Avg[1];

		    Avg.Set(rsiAvg);
		    Value.Set(rsi);
            */

            if (this.current_index() === 0) {
                down.set(0);
                up.set(0);

                if (params.period < 3) output.set(50);
                return;
            }

            down.set(Math.max(input.get(1) - input.get(0), 0));
            up.set(Math.max(input.get(0) - input.get(1), 0));

            sma_up.update();
            sma_down.update();

            if ((this.current_index() + 1) < params.period) return;

            if ((this.current_index() + 1) === params.period) {
                avg_down.set(sma_down.get(0));
                avg_up.set(sma_up.get(0));
            } else {
                avg_down.set((avg_down.get(1) * (params.period - 1) + down.get(0)) / params.period);
                avg_up.set((avg_up.get(1) * (params.period - 1) + up.get(0)) / params.period);
            }

            output.set(avg_down.get(0) === 0 ? 100 : 100 - 100 / (1 + avg_up.get(0) / avg_down.get(0)));
        },

    };
});
