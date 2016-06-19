'use strict';

define(['lodash', 'lib/deque'], (_, Deque) => {

    var default_options = {
        peak_weights: {
            4: 100,
            3: 20,
            2: 5,
            1: 0.1
        },
        gen_back: 1,
        min_span: 6,
        min_age: 2,
        min_sep: 3,

        deque_size: 16
    };

    return {

        description: `Find good-fitting trend lines and quadratic curves obtained from least-squares regressions over multiple peak streams`,

        param_names: ['options'],

        input: ['peak+'],
        output: 'trendlines',

        initialize() {
            this.options = _.assign({}, default_options, this.param.options || {});
            this.unit_size = this.inputs[0].instrument.unit_size;
            this.inp_cnt = this.inputs.length;

            this.highs = this.inputs.map(() => new Deque(this.options.deque_size));
            this.lows = this.inputs.map(() => new Deque(this.options.deque_size));

            this.last_index = -1;
        },

        on_bar_update() {
            var self = this;

            if (this.index === this.last_index) return;

            // update highs/lows to reflect modified source bars
            _.each(this.inputs, (inp, inp_idx) => {
                _.each(this.inputs[inp_idx].modified, mod_idx => {
                    let peak = this.inputs[inp_idx].get_index(mod_idx);
                    if (peak.high) {
                        this.highs[inp_idx].push([peak.high, mod_idx, this.inp_cnt - inp_idx]);
                    } else {
                        let last_high = this.highs[inp_idx].peekBack();
                        if (last_high && last_high[1] === mod_idx) this.highs[inp_idx].pop();
                    }
                    if (peak.low) {
                        this.lows[inp_idx].push([peak.low, mod_idx, this.inp_cnt - inp_idx]);
                    } else {
                        let last_low = this.lows[inp_idx].peekBack();
                        if (last_low && last_low[1] === mod_idx) this.lows[inp_idx].pop();
                    }
                });
            });

            // calculate and collect polynomial regressions

            let polys = [];

            _.each(_.range(-this.options.gen_back, 0), anchor_idx => {
                let high_anchor = this.highs[0].get(anchor_idx);
                let low_anchor = this.lows[0].get(anchor_idx);

                if (low_anchor) {
                    let lows = [low_anchor].concat(this.lows.slice(1).reduce((accum, lows) => accum.concat(lows.toArray().filter(p => p[1] > low_anchor[1])), []));
                    lows = _.sortBy(lows, l => l[1]);
                    lows = normalize_points.call(this, lows);
                    if (lows.length > 1 && _.last(lows)[1] - _.first(lows)[1] >= this.options.min_span) {
                        let line = create_trend_poly.call(this, lows);
                        _.assign(line, {type: 'regression', tags: ['major', 'lower'], start: low_anchor[1], end: null});
                        polys.push(line);
                    }
                    let highs = this.highs.slice(1).reduce((accum, highs) => accum.concat(highs.toArray().filter(p => p[1] > low_anchor[1])), []);
                    highs = _.sortBy(highs, h => h[1]);
                    highs = normalize_points.call(this, highs);
                    if (highs.length > 1 && _.last(highs)[1] - _.first(highs)[1] >= this.options.min_span) {
                        let line = create_trend_poly.call(this, highs);
                        _.assign(line, {type: 'regression', tags: ['minor, upper'], start: low_anchor[1], end: null});
                        polys.push(line);
                    }
                }
                if (high_anchor) {
                    let highs = [high_anchor].concat(this.highs.slice(1).reduce((accum, highs) => accum.concat(highs.toArray().filter(p => p[1] > high_anchor[1])), []));
                    highs = _.sortBy(highs, h => h[1]);
                    highs = normalize_points.call(this, highs);
                    if (highs.length > 1 && _.last(highs)[1] - _.first(highs)[1] >= this.options.min_span) {
                        let line = create_trend_poly.call(this, highs);
                        _.assign(line, {type: 'regression', tags: ['major', 'upper'], start: high_anchor[1]});
                        polys.push(line);
                    }
                    let lows = this.lows.slice(1).reduce((accum, lows) => accum.concat(lows.toArray().filter(p => p[1] > high_anchor[1])), []);
                    lows = _.sortBy(lows, l => l[1]);
                    lows = normalize_points.call(this, lows);
                    if (lows.length > 1 && _.last(lows)[1] - _.first(lows)[1] >= this.options.min_span) {
                        let line = create_trend_poly.call(this, lows);
                        _.assign(line, {type: 'regression', tags: ['minor', 'lower'], start: high_anchor[1]});
                        polys.push(line);
                    }
                }

            });

            this.output.set(polys);

            this.last_index = this.index;

            /////////////////////////////////////////////////////////////////////////////

            // reduce points within <min_sep> bars to just the highest ranking
            function normalize_points(points) {
                points = _.filter(points, ([val, idx]) => self.index - idx >= this.options.min_age);
                points = _.reduce(points, (accum, p) => {
                    var last = accum[accum.length - 1];
                    if (_.isEmpty(accum) || p[1] - last[1] >= this.options.min_sep) {
                        return accum.concat([p]);
                    } else if (p[2] > last[2]) {
                        return _.initial(accum).concat([p]);
                    } else {
                        return accum;
                    }
                }, []);
                return points;
            }
        }

    };

    function create_trend_poly(points) {

        var line = {};

        var n = _.sum(_.map(points, p => this.options.peak_weights[p[2]]));

        var sumXY = _.sum(_.map(points, p => p[1] * p[0] * this.options.peak_weights[p[2]]));
        var sumX2 = _.sum(_.map(points, p => p[1] * p[1] * this.options.peak_weights[p[2]]));
        var sumY2 = _.sum(_.map(points, p => p[0] * p[0] * this.options.peak_weights[p[2]]));
        var sumX  = _.sum(_.map(points, p => p[1] * this.options.peak_weights[p[2]]));
        var sumY  = _.sum(_.map(points, p => p[0] * this.options.peak_weights[p[2]]));

        line.slope = ((n * sumXY) - (sumX * sumY)) / ((n * sumX2) - (sumX * sumX));
        line.yint = (sumY - (line.slope * sumX)) / n;

        // http://en.wikipedia.org/wiki/Pearson_product-moment_correlation_coefficient
        line.pearson = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        line.points = points;
        return line;
    }

});
