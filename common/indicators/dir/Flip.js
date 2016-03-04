'use strict';

define({

    /*
	Inverts direction:

	0 => 0
	1 => -1
    -1 => 1

	*/

    param_names: [],

    input: 'direction',
    output: 'direction',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {
        switch (input_streams[0].get()) {
            case 0:
                output_stream.set(0);
                break;
            case 1:
                output_stream.set(-1);
                break;
            case -1:
                output_stream.set(1);
                break;
            default:
        }
    }
});
