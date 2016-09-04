'use strict';

define(['lodash', 'config/timesteps'], function(_, tsconfig) {

    return {

        param_names: [],

        input: ['dual_candle_bar', 'dual_candle_bar?'],
        synch: ['a', 'a'],
        dgrps: [1, 1],
        output: 'dual_candle_bar',

        initialize: function(params, input_streams, output) {
            this.input = input_streams[0];
            this.last_index = -1;
            this.input_last_index = -1;
            this.current_bar = null;
            if (!output.tstep) throw new Error('Output stream must define a timeframe');
            this.base_volume = 0;
            this.supp_volume = 0;
        },

        on_bar_update: function(params, input_streams, output, src_idx) {

            var input = this.inputs[src_idx];

            if (src_idx === 0) {
                let bar = input.get();
                if (this.last_index !== this.current_index()) {
                    this.current_bar = {
                        date: tsconfig.defs[output.tstep].hash(bar),
                        ask: {
                            open: bar.ask.open,
                            high: bar.ask.high,
                            low: bar.ask.low,
                            close: bar.ask.close
                        },
                        bid: {
                            open: bar.bid.open,
                            high: bar.bid.high,
                            low: bar.bid.low,
                            close: bar.bid.close
                        },
                        volume: bar.volume
                    };
                    this.base_volume = 0;
                    this.supp_volume = 0;
                    this.last_index = this.current_index();
                } else {
                    if (input.current_index() !== this.input_last_index) {
                        this.base_volume += this.supp_volume;
                        this.input_last_index = input.current_index();
                    }
                    this.current_bar.ask.open = this.current_bar.ask.open;
                    this.current_bar.ask.high = Math.max(this.current_bar.ask.high, bar.ask.high);
                    this.current_bar.ask.low = Math.min(this.current_bar.ask.low, bar.ask.low);
                    this.current_bar.ask.close = bar.ask.close;

                    this.current_bar.bid.open = this.current_bar.bid.open;
                    this.current_bar.bid.high = Math.max(this.current_bar.bid.high, bar.bid.high);
                    this.current_bar.bid.low = Math.min(this.current_bar.bid.low, bar.bid.low);
                    this.current_bar.bid.close = bar.bid.close;

                    this.supp_volume = bar.volume;
                    this.current_bar.volume = this.base_volume + this.supp_volume;
                }
            } else if (src_idx === 1) {
                let bar = input.get();
                this.current_bar = {
                    date: bar.date,
                    ask: _.clone(bar.ask),
                    bid: _.clone(bar.bid),
                    volume: bar.volume
                };
                this.base_volume = 0;
                this.supp_volume = 0;
                this.last_index = this.current_index();
            }
            output.set(this.current_bar);
        }


    };

});
