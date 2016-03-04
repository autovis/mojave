'use strict';

define(['lodash'], function(_) {

    const LONG = 1, SHORT = -1, FLAT = 0;

    return {

        description: 'Returns the first input that is LONG or SHORT, otherwise returns FLAT',

        param_names: [],

        input: ['direction+'],
        output: 'direction',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var vals = _.map(input_streams, str => str.get());
            var out = _.find(vals, val => val === LONG || val === SHORT);
            output_stream.set(out || FLAT);
        }
    };
});
