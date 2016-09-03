'use strict';

define({

    description: 'Returns true at random with given <probability>',

    param_names: ['probability'],

    input: ['_'],
    output: 'bool',

    initialize: function(params, input_streams, output_stream) {
        if (!(params.probability >= 0 && params.probability <= 1)) throw new Error('<probability> parameter must be a number between 0 and 1');
    },

    on_bar_update: function(params, input_streams, output_stream) {
        output_stream.set(Math.random() <= params.probability);
    }
});
