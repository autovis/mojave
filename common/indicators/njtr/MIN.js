'use strict';

define({

    param_names: ['period'],

    input: 'num',
    output: 'num',

    initialize: function(params, input_streams, output) {
        this.input = input_streams[0];
    },

    on_bar_update: function(params, input_streams, output) {

        /*
		if(CurrentBar == 0)
		{
			runningMin  = Input[0];
            lastMin     = Input[0];
			runningBar  = 0;
            lastBar     = 0;
            thisBar     = 0;
			return;
		}

        if (CurrentBar - runningBar >= Period)
		{
			runningMin = double.MaxValue;
			for (int barsBack = Math.Min(CurrentBar, Period - 1); barsBack > 0; barsBack--)
				if(Input[barsBack] <= runningMin)
				{
					runningMin  = Input[barsBack];
					runningBar  = CurrentBar - barsBack;
                }
		}

        if (thisBar != CurrentBar)
        {
            lastMin = runningMin;
            lastBar = runningBar;
            thisBar = CurrentBar;
        }

        if (Input[0] <= lastMin)
		{
			runningMin = Input[0];
			runningBar = CurrentBar;
		}
        else
        {
            runningMin = lastMin;
            runningBar = lastBar;
        }

		Value.Set(runningMin);
        */

        if (this.current_index() === 0) {
            this.running_min = this.input.get(0);
            this.last_min = this.input.get(0);
            this.running_bar = 0;
            this.last_bar = 0;
            this.this_bar = 0;
            return;
        }

        if (this.current_index() - this.running_bar >= params.period) {
            this.running_min = Number.MAX_VALUE;
            for (var bars_back = Math.min(this.current_index(), params.period - 1); bars_back > 0; bars_back--) {
                if (this.input.get(bars_back) <= this.running_min) {
                    this.running_min = this.input.get(bars_back);
                    this.running_bar = this.current_index() - bars_back;
                }
            }
        }

        if (this.this_bar !== this.current_index()) {
            this.last_min = this.running_min;
            this.last_bar = this.running_bar;
            this.this_bar = this.current_index();
        }
        if (this.input.get(0) <= this.last_min) {
            this.running_min = this.input.get(0);
            this.running_bar = this.current_index();
        } else {
            this.running_min = this.last_min;
            this.running_bar = this.last_bar;
        }

        output.set(this.running_min);
    }
});
