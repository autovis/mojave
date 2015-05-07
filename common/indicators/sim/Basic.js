
// Basic Trade Simulation

// - One open position at a time
// - Can only work with a single instrument

define(['underscore'], function(_) {

    const LONG = 1, SHORT = -1, FLAT = 0;

    return {

        param_names: [],

        input: ['dual_candle_bar', 'trade'],
        synch: ['s',               's'],
        output: 'trade',

        initialize: function(params, input_streams, output_stream) {

            this.position = FLAT;
            this.entry = null;

            this.stop = null;
            this.limit = null;
            this.units = null;

            this.trade_id = null;
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            var out = {};

            var ask = input_streams[0].get().ask;
            var bid = input_streams[0].get().bid;

            if (this.position === LONG) {
                if (this.stop && bid.low <= this.stop) {
                    out.trade_end = {
                        id: this.trade_id,
                        reason: 'stop',
                        direction: this.position,
                        units: this.units,
                        entry_price: this.entry,
                        exit_price: this.stop,
                        pips: Math.round((this.stop - this.entry) / input_streams[0].instrument.unit_size * 10) / 10
                        //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                    };
                    this.trade_id = null;
                    this.position = FLAT;
                    this.entry = null;
                    this.units = null;
                    this.stop = null;
                    this.limit = null;
                } else if (this.limit && bid.high >= this.limit) {
                    out.trade_end = {
                        id: this.trade_id,
                        reason: 'limit',
                        direction: this.position,
                        units: this.units,
                        entry_price: this.entry,
                        exit_price: this.limit,
                        pips: Math.round((this.limit - this.entry) / input_streams[0].instrument.unit_size * 10) / 10
                        //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                    };
                    this.trade_id = null;
                    this.position = FLAT;
                    this.entry = null;
                    this.units = null;
                    this.stop = null;
                    this.limit = null;
                }
            } else if (this.position === SHORT) {
                if (this.stop && ask.high >= this.stop) {
                    out.trade_end = {
                        id: this.trade_id,
                        reason: 'stop',
                        direction: this.position,
                        units: this.units,
                        entry_price: this.entry,
                        exit_price: this.stop,
                        pips: Math.round((this.entry - this.stop) / input_streams[0].instrument.unit_size * 10) / 10
                        //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                    };
                    this.trade_id = null;
                    this.position = FLAT;
                    this.entry = null;
                    this.units = null;
                    this.stop = null;
                    this.limit = null;
                } else if (this.limit && ask.low <= this.limit) {
                    out.trade_end = {
                        id: this.trade_id,
                        reason: 'limit',
                        direction: this.position,
                        units: this.units,
                        entry_price: this.entry,
                        exit_price: this.limit,
                        pips: Math.round((this.entry - this.limit) / input_streams[0].instrument.unit_size * 10) / 10
                        //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                    };
                    this.trade_id = null;
                    this.position = FLAT;
                    this.entry = null;
                    this.units = null;
                    this.stop = null;
                    this.limit = null;
                }
            } else { // FLAT
                // No reactions to price when position is FLAT
            }

            var inp = input_streams[1].get(); // trade stream from strategy

            if (inp.set_stop) {
                this.stop = inp.set_stop.price;
                if (this.position !== FLAT) out.stop_updated = inp.set_stop.price;
            }
            if (inp.set_limit) {
                this.limit = inp.set_limit.price;
                if (this.position !== FLAT) out.limit_updated = inp.set_limit.price;
            }
            if (inp.enter_long && this.position === FLAT) {
                this.trade_id = inp.enter_long.id;
                this.position = LONG;
                this.entry = inp.enter_long.entry_price;
                this.units = inp.enter_long.units;
                out.trade_start = {
                    id: inp.enter_long.id,
                    direction: LONG,
                    units: inp.enter_long.units,
                    entry_price: ask.close
                    //instrument: inp.enter_long.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                };
            } else if (inp.enter_short && this.position === FLAT) {
                this.trade_id = inp.enter_short.id;
                this.position = SHORT;
                this.entry = inp.enter_short.entry_price;
                this.units = inp.enter_short.units;
                out.trade_start = {
                    id: inp.enter_short.id,
                    direction: SHORT,
                    units: inp.enter_short.units,
                    entry_price: bid.close
                    //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                };
            } else if (inp.exit && this.position !== FLAT) {
                var exit_price = this.position === LONG ? bid.close : ask.close;
                out.trade_end = {
                    id: (_.isObject(inp.exit) && inp.exit.id) || this.trade_id,
                    reason: 'exit',
                    direction: this.position,
                    units: this.units,
                    entry_price: this.entry,
                    exit_price: exit_price,
                    pips: Math.round((this.entry - exit_price) / input_streams[0].instrument.unit_size * 10) / 10
                    //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                }
                this.trade_id = null;
                this.position = FLAT;
                this.entry = null;
                this.units = null;
                this.stop = null;
                this.limit = null;
            }

            output_stream.set(out);
        }
    };
});
