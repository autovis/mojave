'use strict';

define(['lodash'], function(_) {

    var default_options = {
        bounce_dist: 1.5,           // max distance from bar.open to poly mark to be considered a bounce (in pips)
        min_slope: 0.2,             // min slope of trend poly
        min_r2: 0.95                // min r^2 for trend poly
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

            var majup =  [];
            var majlow = [];
            var minup = [];
            var minlow = [];

            _.each(this.inputs[1].get(), poly => {
                let func = x => _.range(0, poly.deg + 1).map(p => poly.a[p] * Math.pow(x, p)).reduce((acc, x) => acc + x, 0);
                _.assign(poly, {val: func(this.index)});
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
                    if (Math.abs(_.mean([bar.open, bar.low]) - basepoly.val) < this.options.bounce_dist * this.unit_size) {
                        //if (basepoly.a[1] / this.unit_size > this.options.min_slope) {
                            if (basepoly.r2 >= this.options.min_r2) {
                                this.output.set(1);
                            }
                        //}
                    }
                });
            } else if (bar.open > bar.close) { // down bar
                _.each(majup, basepoly => {
                    if (Math.abs(_.mean([bar.open, bar.high]) - basepoly.val) < this.options.bounce_dist * this.unit_size) {
                        //if (basepoly.a[1] / this.unit_size < -this.options.min_slope) {
                            if (basepoly.r2 >= this.options.min_r2) {
                                this.output.set(-1);
                            }
                        //}
                    }
                });
            }

        }
    };
});
