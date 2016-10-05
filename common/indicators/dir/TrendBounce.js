'use strict';

define(['lodash'], function(_) {

    var default_options = {
        bounce_atr_dist: 1.0,       // max distance from bar.open to poly being bounced
        min_slope: 0.2,             // min slope of trend poly
        min_r2: 0.90                // min r^2 for trend poly
    };

    return {

        description: '',

        param_names: ['options'],

        input: [
            'candle_bar',   // price
            'markings',     // trend polys
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

            _.each(this.inputs[1].get(), poly => {
                _.assign(poly, {val: poly.slope * this.index + poly.yint});
                if (_.includes(poly.tags, 'major')) {
                    if (_.includes(poly.tags, 'lower')) {
                        majlow.push(poly);
                    } else if (_.includes(poly.tags, 'upper')) {
                        majup.push(poly);
                    }
                } else if (_.includes(poly.tags, 'minor')) {
                    if (_.includes(poly.tags, 'lower')) {
                        minlow.push(poly);
                    } else if (_.includes(poly.tags, 'upper')) {
                        minup.push(poly);
                    }
                }
            });

            var bar = this.inputs[0].get();

            if (bar.open < bar.close) { // up bar
                _.each(majlow, basepoly => {
                    if (basepoly.val <= bar.open && basepoly.val >= Math.min(bar.low, bar.open - this.options.bounce_atr_dist)) {
                        if (basepoly.a[1] / this.unit_size > this.options.min_slope) {
                            if (basepoly.r2 >= this.options.min_r2) {
                                this.output.set(1);
                            }
                        }
                    }
                });
            } else if (bar.open > bar.close) { // down bar
                _.each(majup, basepoly => {
                    if (basepoly.val >= bar.close && basepoly.val <= Math.max(bar.high, bar.close + this.options.bounce_atr_dist)) {
                        if (basepoly.a[1] / this.unit_size < -this.options.min_slope) {
                            if (basepoly.r2 >= this.options.min_r2) {
                                this.output.set(-1);
                            }
                        }
                    }
                });
            }

        }
    };
});
