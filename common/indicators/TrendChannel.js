'use strict';

define(['lodash', 'lib/deque'], (_, Deque) => {

    var weights = {
        2: 50,
        1: 5,
        0: 1
    };

    return {

        description: `Trend channel approximation using two or three high/low inputs`,

        param_names: ['options'],

        input: ['peak', 'peak', 'peak?'],
        output: 'trendlines',

        initialize() {

            this.p2_highs = [];
            this.p2_lows = [];
            this.p1_highs = [];
            this.p1_lows = [];
            this.p0_highs = [];
            this.p0_lows = [];

            this.last_index = -1;
        },

        on_bar_update() {
            var self = this;

            if (this.index === this.last_index) return;

            // update highs/lows to reflect modified source bars
            _.each(this.inputs[0].modified, idx => {
                let p2 = this.inputs[0].get_index(idx);
                if (p2.high) {
                    this.p2_highs.push([p2.high, idx, 2]);
                } else {
                    this.p2_highs = _.filter(this.p2_highs, ([val, idx_]) => idx_ !== idx);
                }
                if (p2.low) {
                    this.p2_lows.push([p2.low, idx, 2]);
                } else {
                    this.p2_lows = _.filter(this.p2_lows, ([val, idx_]) => idx_ !== idx);
                }
            });
            _.each(this.inputs[1].modified, idx => {
                let p1 = this.inputs[1].get_index(idx);
                if (p1.high) {
                    this.p1_highs.push([p1.high, idx, 1]);
                } else {
                    this.p1_highs = _.filter(this.p1_highs, ([val, idx_]) => idx_ !== idx);
                }
                if (p1.low) {
                    this.p1_lows.push([p1.low, idx, 1]);
                } else {
                    this.p1_lows = _.filter(this.p1_lows, ([val, idx_]) => idx_ !== idx);
                }
            });
            _.each(this.inputs[2].modified, idx => {
                let p0 = this.inputs[2].get_index(idx);
                if (p0.high) {
                    this.p0_highs.push([p0.high, idx, 0]);
                } else {
                    this.p0_highs = _.filter(this.p0_highs, ([val, idx_]) => idx_ !== idx);
                }
                if (p0.low) {
                    this.p0_lows.push([p0.low, idx, 0]);
                } else {
                    this.p0_lows = _.filter(this.p0_lows, ([val, idx_]) => idx_ !== idx);
                }
            });

            // calculate regression lines

            let min_span = 6;
            let min_age = 3;
            let min_sep = 3;

            let lines = [];
            let last_p2_high = this.p2_highs[this.p2_highs.length - 1];
            let last_p2_low = this.p2_lows[this.p2_lows.length - 1];
            if (last_p2_high || last_p2_low) {
                if (last_p2_low) {
                    let lows = [last_p2_low].concat(_.filter(_.union(this.p1_lows, this.p0_lows), p => p[1] > last_p2_low[1]));
                    lows = normalize_points(lows);
                    if (lows.length > 1 && _.last(lows)[1] - _.first(lows)[1] >= min_span) {
                        let line = create_trend_line(lows);
                        _.assign(line, {type: 'major-lower', start: last_p2_low[1], end: null});
                        lines.push(line);
                    }
                    let highs = _.filter(this.p0_highs, p => p[1] > last_p2_low[1]);
                    highs = normalize_points(highs);
                    if (highs.length > 1 && _.last(highs)[1] - _.first(highs)[1] >= min_span) {
                        let line = create_trend_line(highs);
                        _.assign(line, {type: 'minor-upper', start: last_p2_low[1], end: null});
                        lines.push(line);
                    }
                }
                if (last_p2_high) {
                    let highs = [last_p2_high].concat(_.filter(_.union(this.p1_highs, this.p0_highs), p => p[1] > last_p2_high[1]));
                    highs = normalize_points(highs);
                    if (highs.length > 1 && _.last(highs)[1] - _.first(highs)[1] >= min_span) {
                        let line = create_trend_line(highs);
                        _.assign(line, {type: 'major-upper', start: last_p2_high[1], end: null});
                        lines.push(line);
                    }
                    let lows = _.filter(this.p0_lows, p => p[1] > last_p2_high[1]);
                    lows = normalize_points(lows);
                    if (lows.length > 1 && _.last(lows)[1] - _.first(lows)[1] >= min_span) {
                        let line = create_trend_line(lows);
                        _.assign(line, {type: 'minor-lower', start: last_p2_high[1], end: null});
                        lines.push(line);
                    }
                }

                this.output.set(lines);
            }

            this.last_index = this.index;

            /////////////////////////////////////////////////////////////////////////////

            // reduce points within <min_sep> bars to just the highest ranking
            function normalize_points(points) {
                points = _.filter(points, ([val, idx]) => self.index - idx >= min_age);
                points = _.reduce(points, (accum, p) => {
                    var last = accum[accum.length - 1];
                    if (_.isEmpty(accum) || p[1] - last[1] >= min_sep) {
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

    function create_trend_line(points) {

        var line = {};

        var n = _.sum(_.map(points, p => weights[p[2]]));

        var sumXY = _.sum(_.map(points, p => p[1] * p[0] * weights[p[2]]));
        var sumX2 = _.sum(_.map(points, p => p[1] * p[1] * weights[p[2]]));
        var sumY2 = _.sum(_.map(points, p => p[0] * p[0] * weights[p[2]]));
        var sumX  = _.sum(_.map(points, p => p[1] * weights[p[2]]));
        var sumY  = _.sum(_.map(points, p => p[0] * weights[p[2]]));

        line.slope = ((n * sumXY) - (sumX * sumY)) / ((n * sumX2) - (sumX * sumX));
        line.yint = (sumY - (line.slope * sumX)) / n;

        // http://en.wikipedia.org/wiki/Pearson_product-moment_correlation_coefficient
        line.pearson = (n * sumXY - sumX * sumY) / Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
        line.points = points.length;
        return line;
    }

});

