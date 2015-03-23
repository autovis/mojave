define(['indicators/EMA'], function(EMA) {
    return  {

        param_names: ["period"],

        input: 'num',
        output: 'num',

        initialize: function(params, input_streams, output) {
            this.diff = this.stream("diff");
            this.ema1 = this.indicator([EMA, Math.floor(params.period/2)], input_streams);
            this.ema2 = this.indicator([EMA, params.period], input_streams);
            this.ema_diff = this.indicator([EMA, Math.floor(Math.sqrt(params.period))], this.diff);
        },

        on_bar_update: function(params, input_streams, output) {
            /*
		    double value1 = 2 * EMA(Inputs[0], (int)(Period / 2))[0];
		    double value2 = EMA(Inputs[0], Period)[0];
		    diffSeries.Set(value1 - value2);

		    Value.Set(EMA(diffSeries, (int) Math.Sqrt(Period))[0]);
            */
            this.ema1.update();
            this.ema2.update();
            this.diff.next();
            this.diff.set((2 * this.ema1.get(0)) - this.ema2.get(0));
            this.ema_diff.update();

            output.set(this.ema_diff.get(0));
        },

    }
})