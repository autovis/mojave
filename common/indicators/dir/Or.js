'use strict';

define(['lodash'], function(_) {

    return {

        description: 'Returns the first input that is not 0 (FLAT), otherwise returns 0',

        param_names: [],

        input: ['direction+'],
        output: 'direction',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {

            var ret = _.find(input_streams, function(stream) {
                return stream.get() !== 0;
            });

            output_stream.set(ret && ret.get() || 0);
        }

    };
});
