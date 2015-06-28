'use strict';

define(['underscore', 'simple-statistics'], function(_, ss) {

    // unfinished

    return {

        param_names: ['period'],

        input: 'num',
        output: 'num',

        initialize: function(params) {
            this.range = _.range(0, params.period).reverse();
        },

        on_bar_update: function(params, input_streams, output) {

            var input = input_streams[0];

            if (this.current_index() > 0) {
                var data = _.map(_.range(Math.max(this.current_index() - params.period, 0), this.current_index()), function(idx) {
                    return [idx, input.get_index(idx)];
                });

                output.set(ss.standard_deviation(data));
            } else {
                output.set(null);
            }
        }
    };
});
