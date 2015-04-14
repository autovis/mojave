
// Basic Trade Simulation

// - One open position at a time
// - Can only work with a single instrument

define(['underscore'], function(_) {

    const LONG = 1, SHORT = -1, FLAT = 0;

    return {

        param_names: [],

        input: ['dual_candle_bar', 'trade'],
        synch: ['a',               'a'],
        output: 'trade',

        initialize: function(params, input_streams, output_stream) {
            this.ask = input_streams[0].substream("ask");
            this.bid = input_streams[0].substream("bid");

            this.position = FLAT;
            this.entry = null;

            this.stop = null;
            this.limit = null;
            this.lotsize = null;

            this.next_id = 0;
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            if (src_idx === 0) { // price

                var ask = this.ask.get();
                var bid = this.bid.get();

                if (this.position === LONG) {
                    if (this.stop && bid <= this.stop) {
                        this.position = FLAT;
                        this.stop = null;
                        this.limit = null;
                        out.trade_closed = "stop";
                        out.direction = LONG;
                        out.entry_price = this.entry;
                        out.exit_price = bid;
                        out.lotsize = this.lotsize;
                    } else if (this.limit && bid >= this.limit) {
                        this.position = FLAT;
                        this.stop = null;
                        this.limit = null;
                        out.trade_closed = "limit";
                        out.direction = LONG;
                        out.entry_price = this.entry;
                        out.exit_price = bid;
                        out.lotsize = this.lotsize;
                    }
                } else if (this.position === SHORT) {
                    if (this.stop && ask >= this.stop) {
                        this.position = FLAT;
                        this.stop = null;
                        this.limit = null;
                        out.trade_closed = "stop";
                        out.direction = SHORT;
                        out.entry_price = this.entry;
                        out.exit_price = ask;
                        out.lotsize = this.lotsize;
                    } else if (this.limit && ask <= this.limit) {
                        this.position = FLAT;
                        this.stop = null;
                        this.limit = null;
                        out.trade_closed = "limit";
                        out.direction = SHORT;
                        out.entry_price = this.entry;
                        out.exit_price = ask;
                        out.lotsize = this.lotsize;
                    }
                } else { // flat

                }

                output_stream.set(out);

                this.stop_propagation();

            } else if (src_idx === 1) { // trade

                var inp = input_streams[1].get();

                var out = {};

                if (inp.set_stop) {
                    this.stop = inp.set_stop.price;
                    if (this.position !== FLAT) out.stop_updated = inp.set_stop.price;
                }
                if (inp.set_limit) {
                    this.limit = inp.set_limit.price;
                    if (this.position !== FLAT) out.limit_updated = out.set_limit.price;
                }
                //if (tr.lotsize) {this.lotsize = tr.lotsize}
                if (inp.enter_long) {
                    out.trade_start = {
                        id: inp.enter_long.id,
                        direction: LONG,
                        units: inp.enter_long.units,
                        price: inp.enter_long.price,
                        instrument: inp.enter_long.instrument
                    };
                } else if (inp.enter_short) {
                    out.trade_start = {
                        id: inp.enter_short.id,
                        direction: SHORT,
                        units: inp.enter_short.units,
                        price: inp.enter_short.price,
                        instrument: inp.enter_short.instrument
                    };
                } else if (inp.exit) {
                    out.trade_end = {
                        id: inp.exit.id
                    }
                    inp.position = FLAT;
                }

                output_stream.set(out);

            } else {
                throw new Error("Unknown source index: "+src_idx);
            }

        }
    };
})
