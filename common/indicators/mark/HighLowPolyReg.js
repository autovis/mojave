'use strict';

define(['lodash', 'lib/deque', 'sylvester', 'expression'], (_, Deque, syl, Expression) => {

    var default_options = {
        weights: {
            4: 100,
            3: 20,
            2: 5,
            1: 0.1
        },
        gen_back: 1, // how many anchor points to go back
        min_span: 6, // min span in bars from star to end point
        min_age: 2, // min age of point in bars before being counted
        min_sep: 3, // min bar separation between points
        min_r2: 0.4, // min r^2 value

        degrees: [1, 2], // degrees of polynomial curves to look for
        deque_size: 16,

        major_derivative_rules: {
            1: [1.0, 2.0],
            2: [1.0, 2.0]
        },

        minor_derivative_rules: {
            1: [1.0, 2.0],
            2: [1.0, 2.0]
        },

        break_period: 3,    // period of bars that price must close outside of
                            // polyline to be considered a confirmed break
        cleanup_period: 300 // period before removing tracked cancelled polys
    };

    return {

        description: `Find good-fitting polynomial regression curves based on high/low streams`,

        param_names: ['options'],

        input: ['dual_candle_bar', 'peak+'],
        output: 'markings',

        initialize() {
            this.options = _.assign({}, default_options, this.param.options || {});
            this.options.r2_weights = this.options.r2_weights || this.options.weights;
            this.unit_size = this.inputs[0].instrument.unit_size;

            this.peak_inputs = this.inputs.slice(1);
            this.highs = this.peak_inputs.map(() => new Deque(this.options.deque_size));
            this.lows = this.peak_inputs.map(() => new Deque(this.options.deque_size));

            this.cancelled = new Set(); // track markings that have been cancelled

            this.last_index = -1;
        },

        on_bar_update() {

            if (this.index === this.last_index) return;

            // update highs/lows to reflect modified source bars
            _.each(this.peak_inputs, (inp, inp_idx) => {
                this.peak_inputs[inp_idx].modified.forEach(mod_idx => {
                    let peak = this.peak_inputs[inp_idx].get_index(mod_idx);
                    if (peak.high) {
                        this.highs[inp_idx].push([peak.high, mod_idx, this.peak_inputs.length - inp_idx]);
                    } else {
                        let last_high = this.highs[inp_idx].peekBack();
                        if (last_high && last_high[1] === mod_idx) this.highs[inp_idx].pop();
                    }
                    if (peak.low) {
                        this.lows[inp_idx].push([peak.low, mod_idx, this.peak_inputs.length - inp_idx]);
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
                        _.each(this.options.degrees, deg => {
                            if (lows.length <= deg) return;
                            let poly = create_trend_poly.call(this, lows, deg);
                            if (poly.r2 < this.options.min_r2) return;
                            _.assign(poly, {type: 'polyreg', deg: deg, tags: ['major', 'lower'], start: low_anchor[1], end: null});
                            polys.push(poly);
                        });
                    }
                    let highs = this.highs.slice(1).reduce((accum, highs) => accum.concat(highs.toArray().filter(p => p[1] > low_anchor[1])), []);
                    highs = _.sortBy(highs, h => h[1]);
                    highs = normalize_points.call(this, highs);
                    if (highs.length > 1 && _.last(highs)[1] - _.first(highs)[1] >= this.options.min_span) {
                        _.each(this.options.degrees, deg => {
                            if (highs.length <= deg) return;
                            let poly = create_trend_poly.call(this, highs, deg);
                            if (poly.r2 < this.options.min_r2) return;
                            _.assign(poly, {type: 'polyreg', deg: deg, tags: ['minor, upper'], start: low_anchor[1], end: null});
                            polys.push(poly);
                        });
                    }
                }
                if (high_anchor) {
                    let highs = [high_anchor].concat(this.highs.slice(1).reduce((accum, highs) => accum.concat(highs.toArray().filter(p => p[1] > high_anchor[1])), []));
                    highs = _.sortBy(highs, h => h[1]);
                    highs = normalize_points.call(this, highs);
                    if (highs.length > 1 && _.last(highs)[1] - _.first(highs)[1] >= this.options.min_span) {
                        _.each(this.options.degrees, deg => {
                            if (highs.length <= deg) return;
                            let poly = create_trend_poly.call(this, highs, deg);
                            if (poly.r2 < this.options.min_r2) return;
                            _.assign(poly, {type: 'polyreg', deg: deg, tags: ['major', 'upper'], start: high_anchor[1], end: null});
                            polys.push(poly);
                        });
                    }
                    let lows = this.lows.slice(1).reduce((accum, lows) => accum.concat(lows.toArray().filter(p => p[1] > high_anchor[1])), []);
                    lows = _.sortBy(lows, l => l[1]);
                    lows = normalize_points.call(this, lows);
                    if (lows.length > 1 && _.last(lows)[1] - _.first(lows)[1] >= this.options.min_span) {
                        _.each(this.options.degrees, deg => {
                            if (lows.length <= deg) return;
                            let poly = create_trend_poly.call(this, lows, deg);
                            if (poly.r2 < this.options.min_r2) return;
                            _.assign(poly, {type: 'polyreg', deg: deg, tags: ['minor', 'lower'], start: high_anchor[1], end: null});
                            polys.push(poly);
                        });
                    }
                }

            });

            this.output.set(polys);

            this.cancelled.delete(Math.max(0, this.index - this.options.cleanup_period));

            this.last_index = this.index;

            /////////////////////////////////////////////////////////////////////////////

            // reduce points within <min_sep> bars to just the highest ranking
            function normalize_points(points) {
                points = _.filter(points, ([val, idx]) => this.index - idx >= this.options.min_age);
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

    function create_trend_poly(points, degree) {

        var poly = {points: points};

        // ---------------------------------------------------------------
        // setup necessary matrices and vectors

        let X_pnts = _.map(points, d => {
            return _.range(0, degree + 1).map(p => Math.pow(d[1], p));
        });
        let y_pnts = _.map(points, d => d[0]);
        let n = points.length;

        let X_mat = syl.Matrix.create(X_pnts);
        let y_vec = syl.Vector.create(y_pnts);
        let w_sum = _.sum(_.map(points, d => d[2]));
        let W_mat = syl.Matrix.Diagonal(_.map(points, d => d[2] / (w_sum / n)));

        // weighted least squares regression
        // (X_T * W * X)^-1 * X_T * W * y
        // https://onlinecourses.science.psu.edu/stat501/node/352

        var X_mat_T = X_mat.transpose();
        var a_vec = X_mat_T.multiply(W_mat).multiply(X_mat).inverse().multiply(X_mat_T.multiply(W_mat).multiply(y_vec));

        poly.a = a_vec.elements;

        // ------------------------------------------------------------------------------
        // calculate r^2 (weighted)

        let func = x => _.range(0, degree + 1).map(p => poly.a[p] * Math.pow(x, p)).reduce((acc, x) => acc + x, 0);

        // SSE = Sum((y_i - yhat_i)^2, i=1, n)  @[1.21]
        let sse = points.reduce((m, d) => m + Math.pow(d[0] - func(d[1]), 2) * (d[2] / w_sum), 0);
        // SSTO = Sum((y_i - y_avg)^2, i=1, n)  @[2.43]
        let y_avg = points.reduce((m, d) => m + d[0], 0) / points.length;
        let ssto = points.reduce((m, d) => m + Math.pow(d[0] - y_avg, 2) * (d[2] / w_sum), 0);
        // R^2 = 1 - (SSE / SSTO)  @[2.72]
        poly.r2 = 1 - (sse / ssto);

        return poly;
    }

    function check_derivatives(poly, rules, idx) {
        let terms = poly.a;
        let high_der = _.max(_.keys(rules));
        for (let der = 1; der <= high_der; der += 1) {
            terms = _.tail(_.map(poly, (x, deg) => x * deg));
            let val = _.range(0, terms.length + 1).map(p => terms[p] * Math.pow(idx, p)).reduce((acc, x) => acc + x, 0);


        }
        return true;
    }

});
