define({

    // returns true if inputs are all positive, all negative, or all zero; else returns false

    param_names: ['grace'],

    input: ['num*'],
    output: 'bool',

    initialize: function(params, input_streams, output_stream) {
        this.output = output_stream;
    },

    on_bar_update: function(params, input_streams, output_stream) {

        var value = input_streams.map(function(stream) {
            var num = stream.get(0);
            return num > 0 ? 1 : (num < 0 ? -1 : 0);
        }).reduce(function(prev,curr) {
             return prev == null ? curr : (curr === prev ? curr : false);
        },null) !== false;

        this.output.set(value);
    }
})
