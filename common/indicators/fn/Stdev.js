'use strict';

define(['lodash', 'simple-statistics'], function(_, ss) {

    return {

        description: `Calculates the standard deviation over the last <period> number of bars`,

        param_names: ['period'],

        input: 'num',
        output: 'num',

        initialize: function(params) {
        },

        on_bar_update: function(params, input_streams, output_stream) {
            if (this.current_index() > 0) {
                var bar_idxs = _.range(Math.max(this.current_index() - params.period, 0), this.current_index() + 1);
                var data = _.map(bar_idxs, idx => input_streams[0].get_index(idx));
                output_stream.set(ss.standardDeviation(data));
            } else {
                output_stream.set(null);
            }
        }
    };
});
