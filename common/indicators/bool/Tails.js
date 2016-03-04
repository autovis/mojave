'use strict';

// Places limits on combined length of upper/lower candle tails (wicks) relative to candle body
// Returns true if average of ABS(open - close) / (high - low) > threshold

define(['lodash', 'indicators/SMA'], function(_, SMA) {

    return {
        param_names: ['period', 'thres'],

        input: ['candle_bar'],
        output: 'bool',

        initialize: function(params, input_streams, output_stream) {
            this.body = this.stream('body');
            this.mva = this.indicator([SMA, params.period], this.body);
            this.unit_size = input_streams[0].instrument.unit_size;
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            var bar = input_streams[0].get();

            var value = Math.abs(bar.open - bar.close) / (bar.high - bar.low);
            if (!_.isNaN(value)) {
                this.body.next();
                this.body.set(value);
                this.mva.update();
            }
            output_stream.set(this.mva.get() >= params.thres);
        }
    };
});
