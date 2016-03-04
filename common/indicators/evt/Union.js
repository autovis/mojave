'use strict';

//

define(['lodash'], function(_) {

    return {
        param_names: [],
        //      trade events
        input: ['trade_evts+'],
        synch: ['a'],

        output: 'trade_evts',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {
            var out = _.reduce(input_streams, function(memo, str) {
                return _.compact(memo.concat(str.get()));
            }, []);
            output_stream.set(out);
        }
    };
});
