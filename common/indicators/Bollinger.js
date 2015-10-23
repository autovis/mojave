'use strict';

define(['underscore', 'simple-statistics', 'indicators/SMA'], function(_, ss, SMA) {

    // unfinished

    return {

        param_names: ['period', 'stdev'],

        input: 'num',
        output: [
            ['mean', 'num'],
            ['upper', 'num'],
            ['lower', 'num']
        ],

        initialize: function(params, input_streams) {
            this.range = _.range(0, params.period).reverse();
            this.mean = this.indicator([SMA, params.period], input_streams[0]);
            this.upper = this.stream('upper');
            this.lower = this.stream('lower');
        },

        on_bar_update: function(params, input_streams, output) {

            var input = input_streams[0];

            this.mean.update();
            this.upper.next();
            this.lower.next();
            if (this.current_index() > 0) {
                var data = _.map(_.range(Math.max(this.current_index() - params.period, 0), this.current_index()), function(idx) {
                    return input.get_index(idx);
                });
                var stdev = ss.standardDeviation(data);
                this.upper.set(this.mean.get() + (stdev * params.stdev));
                this.lower.set(this.mean.get() - (stdev * params.stdev));
                output.set({
                    mean: this.mean.get(),
                    upper: this.upper.get(),
                    lower: this.lower.get()
                });
            }
        }
    };
});
