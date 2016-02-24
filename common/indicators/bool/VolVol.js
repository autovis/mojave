'use strict';

define(['lodash'], function(_) {

    return  {
        param_names: ['vol_thres', 'atr_thres'],

        input: ['num', 'num'],
        output: 'bool',

        initialize: function(params, input_streams, output) {
            if (!_.isObject(input_streams[1].instrument)) throw new Error("VolVol indicator's second input stream (ATR) must define an instrument");
            this.unit_size = input_streams[1].instrument.unit_size;
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0) >= params.vol_thres && (input_streams[1].get(0) / this.unit_size) >= params.atr_thres);
        },

    };
});
