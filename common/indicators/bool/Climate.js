'use strict';

define(['lodash', 'indicators/ATR', 'indicators/EMA'], function(_, ATR, EMA) {

    return {
        param_names: ['period', 'options'],

        input: ['candle_bar'],
        output: 'bool',

        initialize: function(params, input_streams, output_stream) {
            if (!_.isObject(params.options)) throw new Error("'options' parameter must be an object");
            if (!_.isNumber(params.period)) throw new Error("'period' parameter must be a number");
            if (params.options.hours) {
                if (!_.isArray(params.options.hours) || params.options.hours.length < 2) throw new Error("'hours' suboption must be a 2 element array");
            }
            if (params.options.atr) {
                this.atr = this.indicator([ATR, params.period], input_streams[0]);
            }
            if (params.options.volume) {
                this.vol_ema = this.indicator([EMA, params.period], input_streams[0].substream('volume'));
            }
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            var current_bar = input_streams[0].get();
            this.checks = {};

            if (params.options.hours) {
                if (params.options.hours[0] <= params.options.hours[1]) {
                    this.checks.hours = current_bar.date.getHours() >= params.options.hours[0] && current_bar.date.getHours() <= params.options.hours[1];
                } else {
                    this.checks.hours = current_bar.date.getHours() >= params.options.hours[0] || current_bar.date.getHours() <= params.options.hours[1];
                }
            }

            if (params.options.atr) {
                this.atr.update();
                var current_atr = this.atr.get() / input_streams[0].instrument.unit_size;
                if (_.isArray(params.options.atr) && params.options.atr.length > 1) {
                    this.checks.atr = current_atr >= params.options.atr[0] && current_atr <= params.options.atr[1];
                } else {
                    this.checks.atr = current_atr >= params.options.atr;
                }
            }

            if (params.options.volume) {
                this.vol_ema.update();
                var current_vol = this.vol_ema.get();
                if (_.isArray(params.options.volume) && params.options.volume.length > 1) {
                    this.checks.vol = current_vol >= params.options.volume[0] && current_vol <= params.options.volume[1];
                } else {
                    this.checks.vol = current_vol >= params.options.volume;
                }
            }

            output_stream.set(_.all(_.values(this.checks)));
            //console.log(this.checks);
        }
    };
})
