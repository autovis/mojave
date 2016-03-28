'use strict';

define(['lodash'], function(_) {
    return {

        description: 'Repeats "truthy" values (as evaled by JS) for <period> bars, overridding any falsy values',

        param_names: ['period'],

        input: ['^a'],
        output: '^a',

        initialize: function(params, input_streams, output_stream) {
            output_stream.type = input_streams[0].type;
            this.last_val = null;
            this.last_idx = null;
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var val = input_streams[0].get();
            if (val) {
                this.last_val = val;
                this.last_idx = input_streams[0].current_index();
                output_stream.set(val);
            } else {
                output_stream.set(input_streams[0].current_index() - this.last_idx <= params.period ? this.last_val : val);
            }
        },
    };
});
