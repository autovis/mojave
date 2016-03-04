'use strict';

define(['lodash'], function(_) {

    return {

        description: 'Returns direction of inputs if they are all the same, otherwise returns null',

        param_names: [],

        input: ['direction+'],
        output: 'direction',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var vals = _.map(input_streams, str => str.get());
            var out = _.reduce(vals, (prev, curr) => prev === undefined ? curr : (curr === prev ? curr : null), undefined);
            output_stream.set(out);
        }
    };
});
