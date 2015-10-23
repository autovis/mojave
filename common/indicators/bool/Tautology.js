define({

    description: "Always return true",

    param_names: [],

    input: ['num'],
    output: 'bool',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {
        output_stream.set(true);
    }
});
