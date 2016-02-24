'use strict';

define(['lodash'], function(_) {
    return {

        param_names: ['options'],

        input: ['ask_candle_bar', 'bid_candle_bar', 'num'],
        output: ['range', ['dur', 'int'], ['start_date', 'datetime']],

        initialize: function(params, input_streams, output) {
            this.ask = input_streams[0];
            this.bid = input_streams[1];
            this.input = input_streams[2];
            this.options = _.isObject(params.options) ? params.options : {};

            this.inpdir = this.indicator(['dir:Direction', this.options.flat_thres || null], this.input);
            this.currdir = null;
            this.idxstart = null;
            this.start_price = null;
            this.reach_price = null;
        },

        on_bar_update: function(params, input_streams, output) {

            this.inpdir.update();
            var inpdir0 = this.inpdir.get(0);

            if (this.currdir === null) {
                this.currdir = inpdir0;
                this.idxstart = this.current_index();
                this.start_price = inpdir0 > 0 ? this.ask.get(0).close : this.bid.get(0).close;
                this.reach_price = inpdir0 > 0 ? this.bid.get(0).close : this.ask.get(0).close;
                this.start_date = this.ask.get(0).date;
            }
            if (this.current_index() > 0) {
                if (this.currdir !== inpdir0 && inpdir0 !== 0) {
                    var out = {};
                    out.range = this.currdir > 0 ? (this.reach_price - this.start_price) : (this.start_price - this.reach_price);
                    out.range = Math.round(out.range * 100000) / 10;
                    out.dur = this.current_index() - this.idxstart;
                    out.start_date = this.start_date;
                    output.set(out);
                    this.idxstart = this.current_index();
                    this.start_price = inpdir0 > 0 ? this.ask.get(0).close : this.bid.get(0).close;
                    this.reach_price = inpdir0 > 0 ? this.bid.get(0).close : this.ask.get(0).close;
                    this.start_date = this.ask.get(0).date;
                    this.currdir = inpdir0;
                } else {
                    this.reach_price = this.currdir > 0 ? (this.bid.get(0).close > this.reach_price ? this.bid.get(0).close : this.reach_price) : (this.ask.get(0).close < this.reach_price ? this.ask.get(0).close : this.reach_price);
                }
            }

            //function inTradingHours() {
            //    var curr_hour = this.ask.get(0).date.getHours();
            //    return (curr_hour >= this.options.start_hour && curr_hour <= this.options.end_hour)
            //}
        }
    };
});
