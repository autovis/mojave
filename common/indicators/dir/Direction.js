'use strict';

define({

    /*
    Determines the direction of a stream:
    -1 - stream is falling
    0  - stream is within flat threshold  (-thres < x < thres)
    1  - stream if rising

    */

    param_names: ['flat_thres'],

    input: 'num',
    output: 'direction',

    initialize: function(params, input_streams, output_stream) {
        params.flat_thres = params.flat_thres && params.flat_thres > 0 ? params.flat_thres : 0;
    },

    on_bar_update: function(params, input_streams, output_stream) {

        if (this.current_index() === 0) {
            output_stream.set(null);
        } else {
            var diff = input_streams[0].get(0) - input_streams[0].get(1);
            output_stream.set(diff > params.flat_thres ? 1 : (diff < -params.flat_thres ? -1 : 0));
        }
    }
});
