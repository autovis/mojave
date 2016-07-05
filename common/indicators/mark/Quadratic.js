'use strict';

define(['lodash', 'sylvester', 'lib/deque'], (_, syl, Deque) => {

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

        description: ``,

        param_names: ['options'],

        input: ['peak+'],
        output: 'polys',

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

            _.each(_.range(-this.options.gen_back, 0), anchor_barsago => {
                let high_anchor = this.highs[0].get(anchor_barsago);
                let low_anchor = this.lows[0].get(anchor_barsago);

                if (low_anchor) {
                    /*
                    let lows = [low_anchor].concat(this.lows.slice(1).reduce((accum, lows) => accum.concat(lows.toArray().filter(p => p[1] > low_anchor[1])), []));
                    lows = _.sortBy(lows, l => l[1]);
                    lows = normalize_points.call(this, lows);
                    if (lows.length > 1 && _.last(lows)[1] - _.first(lows)[1] >= this.options.min_span) {
                        let line = create_trend_poly.call(this, lows);
                        _.assign(line, {type: 'regression', tags: ['major', 'lower'], start: low_anchor[1], end: null});
                        polys.push(line);
                    }
                    */
                    let next_low_anchor = anchor_barsago > 1 ? this.lows[0].get(anchor_barsago - 1) : null;
                    let highs = this.highs.slice(1).reduce((accum, highs) => accum.concat(highs.toArray().filter(p => p[1] > low_anchor[1] && (!next_low_anchor || p[1] < next_low_anchor[1]))), []);
                    highs = _.sortBy(highs, h => h[1]);
                    highs = normalize_points.call(this, highs);
                    if (highs.length > 2 && _.last(highs)[1] - _.first(highs)[1] >= this.options.min_span) {
                        let poly = create_trend_poly.call(this, highs);
                        _.assign(poly, {type: 'poly', tags: ['quad, upper'], start: low_anchor[1], end: next_low_anchor && next_low_anchor[1]});
                        polys.push(poly);
                    }
                }
                if (high_anchor) {
                    /*
                    let highs = [high_anchor].concat(this.highs.slice(1).reduce((accum, highs) => accum.concat(highs.toArray().filter(p => p[1] > high_anchor[1])), []));
                    highs = _.sortBy(highs, h => h[1]);
                    highs = normalize_points.call(this, highs);
                    if (highs.length > 1 && _.last(highs)[1] - _.first(highs)[1] >= this.options.min_span) {
                        let line = create_trend_poly.call(this, highs);
                        _.assign(line, {type: 'regression', tags: ['major', 'upper'], start: high_anchor[1]});
                        polys.push(line);
                    }
                    */
                    let next_high_anchor = anchor_barsago > 1 ? this.highs[0].get(anchor_barsago - 1) : null;
                    let lows = this.lows.slice(1).reduce((accum, lows) => accum.concat(lows.toArray().filter(p => p[1] > high_anchor[1] && (!next_high_anchor || p[1] < next_high_anchor[1]))), []);
                    lows = _.sortBy(lows, l => l[1]);
                    lows = normalize_points.call(this, lows);
                    if (lows.length > 2 && _.last(lows)[1] - _.first(lows)[1] >= this.options.min_span) {
                        let poly = create_trend_poly.call(this, lows);
                        _.assign(poly, {type: 'poly', tags: ['quad', 'lower'], start: high_anchor[1], end: next_high_anchor && next_high_anchor[1]});
                        polys.push(poly);
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

        var poly = {};

        // setup necessary matrices and vectors
        var X_data = _.map(points, d => [1, d[1], Math.pow(d[1], 2)]);
        var y_data = _.map(points, d => d[0]);
        var n = points.length;

        var X_mat = syl.Matrix.create(X_data);
        var y_vec = syl.Vector.create(y_data);
        //var y_mat = syl.Matrix.create(y_data.map(d => [d]));
        var w_sum = _.sum(_.map(points, d => d[2]));
        var W_mat = syl.Matrix.Diagonal(_.map(points, d => d[2] / (w_sum / n)));

        // weighted least squares regression
        // (X_T * W * X)^-1 * X_T * W * y
        // https://onlinecourses.science.psu.edu/stat501/node/352

        var X_mat_T = X_mat.transpose();
        var a_vec = X_mat_T.multiply(W_mat).multiply(X_mat).inverse().multiply(X_mat_T.multiply(W_mat).multiply(y_vec));

        // ------------------------------------------------------------------------

        poly.points = points;
        poly.p = a_vec.elements;

        return poly;
    }

});
