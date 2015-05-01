define({

    // returns direction based on results of substracting stream B from A -- if difference is smaller than threshold
    // then 0 is returned.

    param_names: ['diff_thres'],

    input: ['num', 'num'],
    output: 'direction',

    initialize: function(params, input_streams, output_stream) {
        params.diff_thres = params.diff_thres && params.diff_thres > 0 ? params.diff_thres : 0;
    },

    on_bar_update: function(params, input_streams, output_stream) {

        if (this.current_index() == 0) {
            output_stream.set(null);
        } else {
            var diff = input_streams[0].get(0) - input_streams[1].get(0);
            output_stream.set(diff > params.diff_thres ? 1 : (diff < -params.diff_thres ? -1 : 0));
        }
    }
});
