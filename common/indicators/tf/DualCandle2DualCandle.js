'use strict';

define(['lodash', 'config/timesteps'], function(_, tsconfig) {

    return {

        param_names: [],

        input: ['dual_candle_bar', 'dual_candle_bar?'],
        synch: ['a', 'a'],
        output: 'dual_candle_bar',

        initialize: function(params, input_streams, output) {
            this.input = input_streams[0];
            this.last_index = -1;
            this.current_bar = null;
            if (!output.tstep) throw new Error('Output stream must define a timeframe');
        },

        on_bar_update: function(params, input_streams, output, src_idx) {

            var input = this.inputs[src_idx];

            if (src_idx === 0) {
                if (this.last_index !== this.current_index()) {
                    this.current_bar = {
                        date: tsconfig.defs[output.tstep].hash(this.input.get(0)),
                        ask: {
                            open: this.input.get(0).ask.open,
                            high: this.input.get(0).ask.high,
                            low: this.input.get(0).ask.low,
                            close: this.input.get(0).ask.close
                        },
                        bid: {
                            open: this.input.get(0).bid.open,
                            high: this.input.get(0).bid.high,
                            low: this.input.get(0).bid.low,
                            close: this.input.get(0).bid.close
                        },
                        volume: this.input.get(0).volume
                    };
                    this.last_index = this.current_index();
                } else {
                    this.current_bar = {
                        date: this.current_bar.date,
                        ask: {
                            open: this.current_bar.ask.open,
                            high: Math.max(this.current_bar.high, this.input.get(0).ask.high) || this.input.get(0).ask.high,
                            low: Math.min(this.current_bar.low, this.input.get(0).ask.low) || this.input.get(0).ask.low,
                            close: this.input.get(0).ask.close
                        },
                        bid: {
                            open: this.current_bar.bid.open,
                            high: Math.max(this.current_bar.high, this.input.get(0).bid.high) || this.input.get(0).bid.high,
                            low: Math.min(this.current_bar.low, this.input.get(0).bid.low) || this.input.get(0).bid.low,
                            close: this.input.get(0).bid.close
                        },
                        volume: this.current_bar.volume + this.input.get(0).volume
                    };
                }
            } else if (src_idx === 1) {
                var bar = input.get(0);
                this.current_bar = {
                    date: bar.date,
                    ask: _.clone(bar.ask),
                    bid: _.clone(bar.bid),
                    volume: bar.volume
                };
                this.last_index = this.current_index();
            }
            output.set(this.current_bar);
        }

    };

});
