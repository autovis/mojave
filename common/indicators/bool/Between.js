'use strict';

define(['lodash'], function(_) {

    return {
        description: `Returns true if value of InputA is between <upper> and <lower> inclusive`,

        param_names: ['upper', 'lower'],

        input: ['num', 'num?', 'num?'],
        output: 'bool',

        initialize: function(params, input_streams, output_stream) {
            var upper_idx, lower_idx;
            if (_.isNumber(params.upper)) {
                this.get_upper = () => params.upper;
            } else {
                var upper_match = params.upper.toString().match(/\$(\d+)/);
                if (upper_match) {
                    upper_idx = parseInt(upper_match[1]);
                    if (!input_streams[upper_idx - 1]) throw new Error('Input ' + upper_idx + ' is not defined');
                    this.get_upper = () => input_streams[upper_idx - 1].get();
                } else {
                    throw new Error('Expected number or stream reference for <upper>');
                }
            }
            if (_.isNumber(params.lower)) {
                this.get_lower = () => params.lower;
            } else {
                var lower_match = params.lower.toString().match(/\$(\d+)/);
                if (lower_match) {
                    lower_idx = parseInt(lower_match[1]);
                    if (!input_streams[lower_idx - 1]) throw new Error('Input ' + lower_idx + ' is not defined');
                    this.get_lower = () => input_streams[lower_idx - 1].get();
                } else {
                    throw new Error('Expected number or stream reference for <lower>');
                }
            }
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var val = input_streams[0].get();
            output_stream.set(val >= this.get_lower() && val <= this.get_upper());
        }
    };
});
