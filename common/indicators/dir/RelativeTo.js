'use strict';

define({

    description: 'If (InputA > InputB + thres) then LONG, else if (InputA < InputB - thes) then SHORT, else FLAT',

    param_names: ['diff_thres'],

    input: ['num', 'num'],
    output: 'direction',

    initialize: function(params, input_streams, output_stream) {
        params.diff_thres = params.diff_thres && params.diff_thres > 0 ? params.diff_thres : 0;
    },

    on_bar_update: function(params, input_streams, output_stream) {

        if (this.current_index() === 0) {
            output_stream.set(null);
        } else {
            var diff = input_streams[0].get(0) - input_streams[1].get(0);
            output_stream.set(diff > params.diff_thres ? 1 : diff < -params.diff_thres ? -1 : 0);
        }
    }
});
