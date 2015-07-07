'use strict';

define(['underscore'], function(_) {

    return {
        param_names: ['hours', 'minatr', 'minvol'],

        //      price         atr    vol
        input: ['candle_bar', 'num', 'num'],
        sync: ['s', 's', 's'],
        output: 'bool',

        initialize: function(params, input_streams, output_stream) {
            if (!_.isArray(params.hours) || params.hours.length !== 2 || !_.isNumber(params.hours[0]) || !_.isNumber(params.hours[1]))
                throw new Error("'hours' parameter must be a 2-element array of integers defining trading hours range");
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            var in_trading_hours;
            var above_atr_thres;
            var above_vol_thres;

            var current_bar = input_streams[0].get();
            var current_atr = input_streams[1].get();
            var current_vol = input_streams[2].get();

            if (params.hours[0] <= params.hours[1]) {
                in_trading_hours = current_bar.date.getHours() >= params.hours[0] && current_bar.date.getHours() <= params.hours[1];
            } else {
                in_trading_hours = current_bar.date.getHours() >= params.hours[0] || current_bar.date.getHours() <= params.hours[1];
            }

            above_atr_thres = (current_atr / input_streams[0].instrument.unit_size) >= params.minatr;

            above_vol_thres = current_vol >= params.minvol;

            output_stream.set(in_trading_hours && above_atr_thres && above_vol_thres);
        }
    };
})
