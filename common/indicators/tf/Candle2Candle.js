define(['config/timeframes'], function(tfconfig) {

    return {

        param_names: [],

        input: 'candle_bar',
        output: 'candle_bar',

        initialize: function(params, input_streams, output) {
            this.input = input_streams[0];
            this.input_last_index = -1;
            this.output_last_index = -1;
            this.current_bar = null;
            this.current_volume = 0;
            if (!output.tf) throw new Error("Output stream must define a timeframe");
        },

        on_bar_update: function(params, input_streams, output) {
            if (input_streams[0].current_index() > this.input_last_index) {
                this.current_volume += this.current_index() > 0 ? input_streams[0].get(1).volume : 0;
                this.input_last_index = input_streams[0].current_index();
            }
            if (this.output_last_index !== this.current_index()) { // if new bar
                this.current_bar = {
                    date: tfconfig.defs[output.tf].hash(this.input.get(0)),
                    open: this.input.get(0).open,
                    high: this.input.get(0).high,
                    low: this.input.get(0).low,
                    close: this.input.get(0).close,
                    volume: this.input.get(0).volume
                };
                this.current_volume = 0;
                this.output_last_index = this.current_index();
            } else { // if same bar
                this.current_bar = {
                    date: this.current_bar.date,
                    open: this.current_bar.open,
                    high: Math.max(this.current_bar.high, this.input.get(0).high),
                    low: Math.min(this.current_bar.low, this.input.get(0).low),
                    close: this.input.get(0).close,
                    volume: this.current_volume + this.input.get(0).volume                    
                }    
            }
            output.set(this.current_bar);
        }

    }

})