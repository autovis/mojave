'use strict';

define(['lodash'], function(_) {
    return {

        description: 'Creates a scale to linearly map a <domain> of inputs to a <range> of outputs',

        param_names: ['domain', 'range', 'options'],

        input: ['num'],
        output: 'num',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
        },
    };
});
