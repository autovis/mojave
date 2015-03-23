define(['underscore'], function(_) {

    return {

        param_names: [],

        input: 'candle_bar',
        output: 'peak',

        initialize: function(params, input_streams, output) {
            this.input = input_streams[0].simple();
            this.date = output.substream("date");
            this.high = output.substream("high");
            this.low = output.substream("low");
        },

        on_bar_update: function(params, input_streams, output) {

            this.date.set(this.input.date(0));
            if (this.input.high(1) > this.input.high(2) && this.input.high(1) > this.input.high(0)) {
                this.high.set(null, 2);
                this.high.set(this.input.high(1), 1);
                this.high.set(null, 0); 
            } else if (this.input.low(1) < this.input.low(2) && this.input.low(1) < this.input.low(0)) {
                this.low.set(null, 2);
                this.low.set(this.input.low(1), 1);
                this.low.set(null, 0);
            }
        }
    }
})
