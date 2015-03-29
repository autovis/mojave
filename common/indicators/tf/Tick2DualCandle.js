define(['underscore', 'config/timeframes'], function(_, tfconfig) {

    /*

    Converts a tick stream (#1) into dual_candle_bar streams -- optionally accepts a dual_candle_bar stream (#2) that is passed
    directly to output (and whose TF must match indicator's target TF).

    */

    return {

        param_names: [],

        input: ['tick', 'dual_candle_bar?'],
        synch: ['a', 'a'],
        output: 'dual_candle_bar',

        initialize: function(params, input_streams, output) {
            this.last_index = -1;
            this.current_ask = null;
            this.current_bid = null;
            if (!output.tf) throw new Error("Output stream must define a timeframe");
            //if (input_streams[1] && input_streams[1].tf !== output.tf) throw new Error("Second input's timeframe must match target timeframe");
        },

        on_bar_update: function(params, input_streams, output, src_idx) {

            var ind = this;
            var input = input_streams[src_idx];

            // accept data from tick stream and convert into dual_candle_bar
            if (src_idx === 0) {
                if (this.last_index !== this.current_index()) { // new bar
                    //output.set({date: this.date, ask: this.ask, bid: this.bid, volume: this.volume})
                    this.date = tfconfig.defs[output.tf].hash(input.get(0));
                    this.ask = {
                        open: this.ask.close || input.get(0).ask,
                        high: _.max([this.ask.close, input.get(0).ask]),
                        low: _.min([this.ask.close, input.get(0).ask]),
                        close: input.get(0).ask
                    };
                    this.bid = {
                        open: this.bid.close || input.get(0).bid,
                        high: _.max([this.bid.close, input.get(0).bid]),
                        low: _.min([this.bid.close, input.get(0).bid]),
                        close: input.get(0).bid
                    };
                    this.volume = input.get(0).volume ? input.get(0).volume : 1;
                    this.last_index = this.current_index();
                } else { // same bar
                    this.ask = {
                        open: this.ask.open,
                        high: _.max([this.ask.high, input.get(0).ask]),
                        low: _.min([this.ask.low, input.get(0).ask]),
                        close: input.get(0).ask
                    };
                    this.bid = {
                        open: this.bid.open,
                        high: _.max([this.bid.high, input.get(0).bid]),
                        low: _.min([this.bid.low, input.get(0).bid]),
                        close: input.get(0).bid
                    };
                    this.volume += input.get(0).volume ? input.get(0).volume : 1;
                }
                output.set({date: this.date, ask: this.ask, bid: this.bid, volume: this.volume});

            // accept data from dual_candle_bar stream (input stream's tf must match indicator's target tf)
            } else if (src_idx === 1) {
                var bar = input.get(0);
                this.date = bar.date;
                this.ask = _.clone(bar.ask);
                this.bid = _.clone(bar.bid);
                this.volume = bar.volume;
                output.set({date: this.date, ask: this.ask, bid: this.bid, volume: this.volume});
                this.last_index = this.current_index();
            }
        }

    }

})
