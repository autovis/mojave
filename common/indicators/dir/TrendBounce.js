'use strict';

define(['lodash'], function(_) {

    var default_options = {
        bounce_dist: 1.5,       // max distance from bar.open to line being bounced
        strong: 0.95
    };

    return {

        description: '',

        param_names: ['options'],

        input: ['candle_bar', 'trendlines'],
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
                if (line.type === 'major-lower') majlow.push(line);
                else if (line.type === 'major-upper') majup.push(line);
                else if (line.type === 'minor-lower') minlow.push(line);
                else if (line.type === 'minor-upper') minup.push(line);
            });

            var bar = this.inputs[0].get();

            _.each(majlow, line => {
                //var strong = Math.abs(line.pearson) > this.options.strong;
                if (bar.open < bar.close) { // up bar
                    if (Math.abs(_.mean([bar.close, bar.low]) - line.val) / this.unit_size <= this.options.bounce_dist) {
                        this.output.set(1);
                    }
                }
            });
            _.each(majup, line => {
                if (bar.open > bar.close) { // down bar
                    if (Math.abs(_.mean([bar.open, bar.high]) - line.val) / this.unit_size <= this.options.bounce_dist) {
                        this.output.set(-1);
                    }
                }
            });

        }
    };
});
