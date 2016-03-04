'use strict';

define(['lodash'], function(_) {
    return {
        description: 'If all inputs are equal, return that value otherwise return null',

        param_names: [],

        input: ['^a+'],
        output: '^a',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var vals = input_streams.map(str => str.get());
            var out = _.reduce(vals, (prev, curr) => prev === undefined ? curr : (curr === prev ? curr : null), undefined);
            output_stream.set(out);
        }
    };
});
