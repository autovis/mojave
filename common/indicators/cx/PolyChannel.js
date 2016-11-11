'use strict';

define(['lodash', 'simple-statistics', 'lib/deque'], (_, ss, Deque) => {

    var default_options = {
        mode: 'pips', // pips | price
        //major_max_stdev: 5.0,
        //minor_max_stdev: 5.0,
        projected_bars: 4       // anticipated num of bars before target is reached
    };

    return {

        description: `Use poly markings to establish channels for setting up trades`,

        param_names: ['options'],

        input: ['candle_bar', 'markings'],
        output: [
            ['dir', 'direction'],
            ['target', 'num'],
            //['maj_mean', 'num'],
            //['maj_stdev', 'num'],
            //['min_mean', 'num'],
            //['min_stdev', 'num'],
            ['chan_perc', 'num']
        ],

        initialize() {
            this.options = _.assign({}, default_options, this.param.options || {});
            this.unit_size = this.inputs[0].instrument.unit_size;
        },

        on_bar_update() {
            let polys = _.filter(this.inputs[1].get(), mark => mark.type === 'polyreg');
            _.each(polys, poly => poly.val = _.range(0, poly.a.length).map(p => poly.a[p] * Math.pow(this.index, p)).reduce((acc, x) => acc + x, 0));
            let major_polys = _.filter(polys, poly => _.includes(poly.tags, 'major'));
            let major_lower_polys = _.filter(major_polys, poly => _.includes(poly.tags, 'lower'));
            let major_upper_polys = _.filter(major_polys, poly => _.includes(poly.tags, 'upper'));

            let major_lower_mean = _.mean(_.map(major_lower_polys, poly => poly.val));
            let major_upper_mean = _.mean(_.map(major_upper_polys, poly => poly.val));
            //let maj_stdev = ss.standardDeviation(_.map(major_polys, poly => poly.val));

            let minor_polys = _.filter(polys, poly => _.includes(poly.tags, 'minor'));
            let minor_lower_polys = _.filter(minor_polys, poly => _.includes(poly.tags, 'lower'));
            let minor_upper_polys = _.filter(minor_polys, poly => _.includes(poly.tags, 'upper'));

            let minor_lower_mean = _.mean(_.map(minor_lower_polys, poly => poly.val));
            let minor_upper_mean = _.mean(_.map(minor_upper_polys, poly => poly.val));
            //let min_stdev = ss.standardDeviation(_.map(minor_polys, poly => poly.val));

            if (major_lower_mean && minor_upper_mean) {
                let upper_target = _.min(_.compact([minor_upper_mean, major_upper_mean]));
                let price = this.inputs[0].get().close;
                let perc = (price - major_lower_mean) / (minor_upper_mean - major_lower_mean);
                this.output.set({
                    dir: 1,
                    target: upper_target,
                    //maj_mean: maj_mean,
                    //maj_stdev: maj_stdev,
                    //min_mean: min_mean,
                    //min_stdev: min_stdev,
                    chan_perc: perc
                });
            }
        }

    };

});
