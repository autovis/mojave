'use strict';

//

define(['lodash'], function(_) {

    var LONG = 1, SHORT = -1, FLAT = 0;

    return {
        param_names: [],
        //      trade commands
        input: ['trade_cmds+'],
        synch: ['a'],

        output: 'trade_cmds',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {
            /*
            var inp = input_streams[src_idx].get();
            var out = output_stream.get();
            out = _.isArray(out) ? out.push.apply(out, inp) : inp;
            */
            var out = _.reduce(input_streams, function(memo, str) {
                return memo.concat(str.get());
            }, []);
            output_stream.set(out);
        }
    };
});
