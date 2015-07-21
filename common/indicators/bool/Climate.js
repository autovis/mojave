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

            var within_trading_hours;
            var within_atr_thres;
            var within_vol_thres;

            var current_bar = input_streams[0].get();
            var current_atr = input_streams[1].get();
            var current_vol = input_streams[2].get();

            if (params.hours[0] <= params.hours[1]) {
                within_trading_hours = current_bar.date.getHours() >= params.hours[0] && current_bar.date.getHours() <= params.hours[1];
            } else {
                within_trading_hours = current_bar.date.getHours() >= params.hours[0] || current_bar.date.getHours() <= params.hours[1];
            }

            if (_.isArray(params.minatr) && params.minatr.length > 1) {
                within_atr_thres = (current_atr / input_streams[0].instrument.unit_size) >= params.minatr[0] && (current_atr / input_streams[0].instrument.unit_size) <= params.minatr[1]
            } else {
                within_atr_thres = (current_atr / input_streams[0].instrument.unit_size) >= params.minatr
            }

            if (_.isArray(params.minvol) && params.minvol.length > 1) {
                within_vol_thres = current_vol >= params.minvol[0] && current_vol <= params.minvol[1];
            } else {
                within_vol_thres = current_vol >= params.minvol;
            }

            output_stream.set(within_trading_hours && within_atr_thres && within_vol_thres);
        }
    };
})
