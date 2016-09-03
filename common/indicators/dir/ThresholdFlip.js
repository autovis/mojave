'use strict';

define(['lodash'], function(_) {

    return {

        description: `Same as dir:Threshold but LONG/SHORT output values are swapped`,

        param_names: ['thres'],

        input: 'num',
        output: 'direction',

        initialize: function(params, input_streams, output) {
            if (_.isArray(params.thres)) {
                params.long_thres = params.thres[0];
                params.short_thres = params.thres[1] || params.thres[0];
                if (params.long_thres < params.short_thres) throw new Error("First element of 'thres' param array must be greater than/equal to second element");
            } else if (!_.isNaN(parseInt(params.thres))) {
                params.long_thres = params.short_thres = parseInt(params.thres);
            } else {
                throw new Error("Unexpected type given for param 'thres'");
            }
            this.input = input_streams[0];
        },

        on_bar_update: function(params, input_streams, output) {
            if (this.input.get(0) >= params.long_thres) {
                output.set(-1);
            } else if (this.input.get(0) <= params.short_thres) {
                output.set(1);
            } else {
                output.set(null);
            }
        }
    };
});
