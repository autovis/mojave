'use strict';

define(['lodash', 'simple-statistics', 'indicators/SMA'], function(_, ss, SMA) {

    // unfinished

    return {

        param_names: ['period', 'stdev'],

        input: 'num',
        output: [
            ['mean', 'num'],
            ['upper', 'num'],
            ['lower', 'num']
        ],

        initialize() {
            this.range = _.range(0, this.param.period).reverse();
            this.mean = this.indicator([SMA, this.param.period], this.inputs[0]);
        },

        on_bar_update() {

            this.mean.update();
            if (this.current_index() > 0) {
                var data = _.map(_.range(Math.max(this.index - this.param.period, 0), this.index), idx => {
                    return this.inputs[0].get_index(idx);
                });
                var stdev = ss.standardDeviation(data);
                this.output.set({
                    mean: this.mean.get(),
                    upper: this.mean.get() + (stdev * this.param.stdev),
                    lower: this.mean.get() - (stdev * this.param.stdev)
                });
            }
        }
    };
});
