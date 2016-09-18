'use strict';

define(['lodash'], function(_) {

    var default_options = {
        bounce_atr_dist: 1.0,       // max distance from bar.open to line being bounced
        min_slope: 0.2             // min slope of trend line
        //min_r2: 0.90                // min r^2 for trend line
    };

    return {

        description: '',

        param_names: ['options'],

        input: [
            'candle_bar',   // price
            'trendlines',   // trend lines
            'num'           // atr
        ],
        output: 'direction',

        initialize() {
            this.options = _.assign({}, default_options, this.param.options || {});
            this.unit_size = this.inputs[0].instrument.unit_size;
        },

        on_bar_update() {

            var majup = [];
            var majlow = [];
            var minup = [];
            var minlow = [];

            _.each(this.inputs[1].get(), line => {
                _.assign(line, {val: line.slope * this.index + line.yint});
                if (_.includes(line.tags, 'major')) {
                    if (_.includes(line.tags, 'lower')) {
                        majlow.push(line);
                    } else if (_.includes(line.tags, 'upper')) {
                        majup.push(line);
                    }
                } else if (_.includes(line.tags, 'minor')) {
                    if (_.includes(line.tags, 'lower')) {
                        minlow.push(line);
                    } else if (_.includes(line.tags, 'upper')) {
                        minup.push(line);
                    }
                }
            });

            var bar = this.inputs[0].get();
            var min_slope = this.options.min_slope;
            var bounce_dist = this.inputs[2].get() * this.options.bounce_atr_dist;

            if (bar.open < bar.close) { // up bar
                _.each(majlow, baseline => {
                    if (baseline.val <= bar.open && baseline.val >= Math.min(bar.low, bar.open - bounce_dist)) {
                        if (!min_slope || baseline.slope / this.unit_size > min_slope) {
                            this.output.set(1);
                        }
                    }
                });
            } else if (bar.open > bar.close) { // down bar
                _.each(majup, baseline => {
                    if (baseline.val >= bar.close && baseline.val <= Math.max(bar.high, bar.close + bounce_dist)) {
                        if (!min_slope || baseline.slope / this.unit_size < -min_slope) {
                            this.output.set(-1);
                        }
                    }
                });
            }

        }
    };
});
