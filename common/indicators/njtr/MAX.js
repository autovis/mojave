define({

    param_names: ["period"],

    input: 'num',
    output: 'num',

    initialize: function(params, input_streams, output_stream) {
        this.input = input_streams[0];
    },

    on_bar_update: function(params, input_streams, output_stream) {

        /*
        if (CurrentBar == 0)
        {
            runningMax = Input[0];
            lastMax    = Input[0];
            runningBar = 0;
            lastBar    = 0;
            thisBar    = 0;
            return;
        }

        if (CurrentBar - runningBar >= Period)
        {
            runningMax = double.MinValue;
            for (int barsBack = Math.Min(CurrentBar, Period - 1); barsBack > 0; barsBack--)
                if (Input[barsBack] >= runningMax)
                {
                    runningMax  = Input[barsBack];
                    runningBar  = CurrentBar - barsBack;
                }
        }

        if (thisBar != CurrentBar)
        {
            lastMax = runningMax;
            lastBar = runningBar;
            thisBar = CurrentBar;
        }

        if (Input[0] >= lastMax)
        {
            runningMax = Input[0];
            runningBar = CurrentBar;
        }
        else
        {
            runningMax = lastMax;
            runningBar = lastBar;
        }

        Value.Set(runningMax);
        */

        if (this.current_index() == 0) {
            this.running_max = this.input.get(0);
            this.last_max = this.input.get(0);
            this.running_bar = 0;
            this.last_bar = 0;
            this.this_bar = 0;
            return;
        }

        if (this.current_index() - this.running_bar >= params.period) {
            this.running_max = Number.MIN_VALUE;
            for (var bars_back = Math.min(this.current_index(), params.period-1); bars_back > 0; bars_back--) {
                if (this.input.get(bars_back) >= this.running_max) {
                    this.running_min = this.input.get(bars_back);
                    this.running_bar = this.current_index() - bars_back;
                }
            }
        }

        if (this.this_bar != this.current_index()) {
            this.last_max = this.running_max;
            this.last_bar = this.running_bar;
            this.this_bar = this.current_index();
        }
        if (this.input.get(0) >= this.last_max) {
            this.running_max = this.input.get(0);
            this.running_bar = this.current_index();
        } else {
            this.running_max = this.last_max;
            this.running_bar = this.last_bar;
        }

        output_stream.set(this.running_max);
    }
})
