'use strict';

// Places limits on combined length of upper/lower candle tails (wicks) relative to candle body
// Returns true if average of ABS(open - close) / (high - low) > threshold

//

define(['lodash'], function(_) {

    return {
        description: ``,

        param_names: ['mode', 'thres'],

        input: ['candle_bar'],
        output: 'direction',

        initialize: function(params, input_streams, output_stream) {
            if (!_.includes(['pips'], params.mode)) throw new Error('Unrecognized mode: ' + params.mode);
            if (_.isArray(params.thres)) {
                params.long_thres = params.thres[0];
                params.short_thres = params.thres[1] || params.thres[0];
                if (params.long_thres <= params.short_thres) throw new Error("First element of 'thres' param array must be greater than second element");
            } else if (!_.isNaN(parseInt(params.thres))) {
                params.long_thres = params.short_thres = parseInt(params.thres);
            } else {
                throw new Error("Unexpected type given for param 'thres'");
            }
            this.input = input_streams[0];
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
