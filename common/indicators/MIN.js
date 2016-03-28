'use strict';

define(['lodash'], function(_) {

    return {
        description: `Get minimum value over last <period> bars`,

        param_names: ['period'],

        input: 'num',
        output: 'num',

        initialize: function(params, input_streams, output_stream) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var bar_idxs = _.range(Math.max(this.current_index() - params.period, 0), this.current_index() + 1);
            output_stream.set(_.min(_.map(bar_idxs, idx => input_streams[0].get_index(idx))));
        }
    };
});
