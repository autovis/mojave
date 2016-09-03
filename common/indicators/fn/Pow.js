'use strict';

define(['lodash'], function(_) {

    return {
        param_names: ['power'],

        input: 'num',
        output: 'num',

        initialize: function(params, input_streams, output_stream) {
            if (!_.isFinite(params.power)) throw new Error('<power> must be a finite number');
        },

        on_bar_update: function(params, input_streams, output_stream) {
            output_stream.set(Math.pow(input_streams[0].get(), params.power));
        }
    };
});
