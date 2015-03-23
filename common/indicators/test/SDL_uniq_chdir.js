define(['indicators/EMA',], function(EMA) {
    return {

        // SDL that also tracks count of each direction change

        param_names: ["period"],

        input: ['num'],
        output: [
            "sdl",
            ["id", "uint"]    
        ],

        initialize: function(params, input_streams, output_stream) {
            this.diff = this.simple_stream("diff");
            this.ema1 = this.indicator([EMA, Math.floor(params.period/2)], input_streams).simple_stream();
            this.ema2 = this.indicator([EMA, params.period], input_streams).simple_stream();
            this.ema_diff = this.indicator([EMA, Math.floor(Math.sqrt(params.period))], this.diff).simple_stream();

            this.id = 0;
        },

        on_bar_update: function(params, input_streams, output_stream) {

            var input = input_streams[0].simple_stream();
            var out_sdl = output_stream.property_stream("sdl").simple_stream();
            var out_id = output_stream.property_stream("id").simple_stream();
            /*
		    double value1 = 2 * EMA(Inputs[0], (int)(Period / 2))[0];
		    double value2 = EMA(Inputs[0], Period)[0];
		    diffSeries.Set(value1 - value2);

		    Value.Set(EMA(diffSeries, (int) Math.Sqrt(Period))[0]);
            */
            this.diff.next();
            this.ema1.update();
            this.ema2.update();
            this.diff.set((2 * this.ema1(0)) - this.ema2(0));
            this.ema_diff.update();

            var value = this.ema_diff(0);
            out_sdl.set(value);

            if (this.current_index() > 1) {
                var curr_slope = out_sdl(0) - out_sdl(1);
                var prev_slope = out_sdl(1) - out_sdl(2);
                if (curr_slope >= 0 && prev_slope <= 0 || curr_slope <= 0 && prev_slope >= 0) this.id++;
            }

            out_id.set(this.id);
        }
    }
})
