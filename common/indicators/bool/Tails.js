'use strict';

// Places limits on upper/lower candle tails (wicks)

define(['underscore'], function(_) {

    return {
        param_names: ['period', 'thres'],

        input: ['candle_bar'],
        output: 'bool',

        initialize: function(params, input_streams, output_stream) {
            this.ul = _.isArray(params.thres) ? params.thres[0] : params.thres;
            this.ll = _.isArray(params.thres) ? params.thres[1] : params.thres;
            this.unit_size = input_streams[0].instrument.unit_size;
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            var bar = input_streams[0].get();



        }
    };
})
