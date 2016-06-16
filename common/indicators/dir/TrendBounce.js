'use strict';

define(['lodash'], function(_) {

    var default_options = {
        bounce_dist: 3.0,       // max distance from bar.open to line being bounced
        strong: 0.95,
        limit_target_atr_dist: 2.5,
        limit_min_atr_dist: 1.0,
        limit_max_atr_dist: 5.0,
        min_slope: 0.4
    };

    return {

        description: '',

        param_names: ['options'],

        input: ['candle_bar', 'trendlines', 'num'],
        output: [
            ['dir', 'direction'],
            ['target_price', 'num']
        ],

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
            var target_dist = this.inputs[2].get() * this.options.limit_target_atr_dist;
            var min_dist = this.inputs[2].get() * this.options.limit_min_atr_dist;
            var max_dist = this.inputs[2].get() * this.options.limit_max_atr_dist;
            var min_slope = this.options.min_slope;

            if (bar.open < bar.close) { // up bar
                _.each(majlow, baseline => {
                    //var strong = Math.abs(line.pearson) > this.options.strong;
                    if (Math.abs(_.mean([bar.close, bar.low]) - baseline.val) / this.unit_size <= this.options.bounce_dist) {
                        let target_price = baseline.val + target_dist;
                        let target_line = _.reduce(minup, (memo, line) => memo ? (Math.abs(line.val - target_price) < Math.abs(memo.val - target_price) ? line : memo) : line, null);
                        if (!min_slope || baseline.slope / this.unit_size > min_slope) {
                            if (target_line) {
                                let opposing_lines = _.filter(majup, oppline => oppline.val > baseline.val && oppline.val < target_line);
                                if (_.isEmpty(opposing_lines) && target_line.val >= baseline.val + min_dist && target_line.val <= baseline.val + max_dist) {
                                    this.output.set({dir: 1, target_price: target_line.val});
                                }
                            }
                        }
                    }
                });
            } else if (bar.open > bar.close) { // down bar
                _.each(majup, baseline => {
                    if (Math.abs(_.mean([bar.open, bar.high]) - baseline.val) / this.unit_size <= this.options.bounce_dist) {
                        let target_price = baseline.val - target_dist;
                        let target_line = _.reduce(minlow, (memo, line) => memo ? (Math.abs(line.val - target_price) < Math.abs(memo.val - target_price) ? line : memo) : line, null);
                        if (!min_slope || baseline.slope / this.unit_size < -min_slope) {
                            if (target_line) {
                                let opposing_lines = _.filter(majlow, oppline => oppline.val < baseline.val && oppline.val > target_line);
                                if (_.isEmpty(opposing_lines) && target_line.val <= baseline.val - min_dist && target_line.val >= baseline.val - max_dist) {
                                    this.output.set({dir: -1, target_price: target_line.val});
                                }
                            }
                        }
                    }
                });
            }

        }
    };
});
