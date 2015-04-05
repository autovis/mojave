
// untested

define({

    // returns true if inputs are all rising, all falling, or all flat; else returns false

    param_names: ['grace'], // grace not yet implemented

    input: ['num*'],
    output: 'bool',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {
        if (this.current_index() > 0) {
            var value = input_streams.map(function(stream) {
                var diff = stream.get(0) - stream.get(1);
                return diff > 0 ? 1 : (diff < 0 ? -1 : 0);
            }).reduce(function(prev,curr) {
                 return prev === undefined ? curr : (curr === prev ? curr : false);
            }, undefined) !== false;
            output_stream.set(value);
        }
    }
})
