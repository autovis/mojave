define({

    param_names: [],

    input: 'num',
    output: 'float',

    // Initialize indicator
    initialize: function(params, input_streams, output_stream) {
    },

    // Called when input streams are updated
    on_bar_update: function(params, input_streams, output_stream) {

        if (this.current_index() == 0) {
            output_stream.set(null);
        } else {
            output_stream.set(input_streams[0].get(0) - input_streams[0].get(1));
        }
    }
})
