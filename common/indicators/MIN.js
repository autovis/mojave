'use strict';

define(['lodash'], function(_) {

    return {
        param_names: ['period'],

        input: 'num',
        output: 'num',

        initialize: function(params, input_streams, output_stream) {
            this.range = _.range(0, params.period).reverse();
        },

        on_bar_update: function(params, input_streams, output) {
            var range = this.current_index() >= params.period ? this.range : _.range(0, this.current_index()).reverse()
            output.set(Math.min.apply(null, range.map(x => input_streams[0].get(x))));
        },
    };
});
