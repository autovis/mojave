'use strict';

define(['lodash'], function(_) {

    return {

        param_names: ['period'],

        input: 'candle_bar',
        output: 'num',

        initialize: function(params, input_streams, output) {
            this.tr = this.stream('tr');
            this.range = _.range(0, params.period).reverse();
            this.input = input_streams[0].simple();
        },

        on_bar_update: function(params, input_streams, output) {

            var input = this.input;
            var tr = this.tr;

            var hl = Math.abs(input.high(0) - input.low(0));
            var hc = Math.abs(input.high(0) - input.close(1));
            var lc = Math.abs(input.low(0) - input.close(1));

            var tr_ = hl;
            if (tr_ < hc) tr_ = hc;
            if (tr_ < lc) tr_ = lc;
            tr.next();
            tr.set(tr_);
            var value = this.current_index() >= params.period - 1 ? _.reduce(this.range, (memo, num) => memo + tr.get(num), 0) / this.range.length : null;
            output.set(Math.round(value * 100000) / 100000);
        }

    };
});
