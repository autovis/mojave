define({

    param_names: [],

    input: ['num', 'num'],
    output: 'direction',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {

        if (this.current_index() == 0) {
            output_stream.set(null);
        } else {
            var currdiff = input_streams[0].get(0) - input_streams[1].get(0);
            var prevdiff = input_streams[0].get(1) - input_streams[1].get(1);

            if (currdiff >= 0 && prevdiff < 0) output_stream.set(1);
            else if (currdiff <= 0 && prevdiff > 0) output_stream.set(-1);
            else output_stream.set(null);
        }
    }
})
