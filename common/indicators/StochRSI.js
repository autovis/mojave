'use strict';

define(['lodash', 'indicators/RSI', 'indicators/SMA'], function(_, RSI, SMA) {

    return {

        description: `Stochastic RSI indicator ported from FXCM Trading Station`,

        param_names: ['RSI_period', 'K_period', 'KS_period'],

        input: 'num',
        output: 'num',

        initialize: function(params, input_streams) {
            this.rsi = this.indicator([RSI, params.RSI_period], input_streams[0]);

            this.ski = this.stream('ski');
            this.mva = this.indicator([SMA, params.KS_period], this.ski);
            this.range = _.range(0, params.K_period).reverse();
        },

        on_bar_update: function(params, input_streams, output_stream) {

            this.rsi.update();
            if (this.current_index() >= params.K_period) {
                var min = Math.min.apply(null, _.map(this.range, n => this.rsi.get(n)));
                var max = Math.max.apply(null, _.map(this.range, n => this.rsi.get(n)));
                this.ski.next();
                if (min === max) {
                    this.ski.set(100);
                } else {
                    this.ski.set((this.rsi.get(0) - min) / (max - min) * 100);
                }
                this.mva.update();
                output_stream.set(this.mva.get(0));
            }
        },

    };
});
