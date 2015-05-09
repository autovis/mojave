
// Basic Trend+Execution strategy set up

// Enters trade when:
//     - trend and exec streams go in same direction
//     - climate stream is true
//     - not already in trade

// Uses fixed limit and stop

define(['underscore'], function(_) {

    const LONG = 1, SHORT = -1, FLAT = 0;

    var stop_distance = 10;
    var limit_distance = 15;

    return {
        param_names: [],
        //      price              climate trend        exec         trade
        input: ['dual_candle_bar', 'bool', 'direction', 'direction', 'trade?'],
        synch: ['s',               's',    's',         's',         'a'],

        output: 'trade',

        initialize: function(params, input_streams, output_stream) {
            this.next_trade_id = 1;
            this.position = FLAT;
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            switch (src_idx) {
                case 0: // price
                case 1: // climate
                case 2: // trend
                case 3: // exec
                    var price = input_streams[0].get();
                    //var climate = input_streams[1].get();
                    var trend = input_streams[2].get()
                    var exec = input_streams[3].get();

                    var out = {};

                    if (true) { // climate check
                        if (this.position === FLAT && trend === LONG && exec === LONG) {
                            out.enter_long = {
                                id: this.next_trade_id,
                                entry_price: price.ask.close,
                                //instrument: input_streams[0].instrument && input_streams[0].instrument.id,
                                units: 1
                            };
                            out.set_stop = {
                                price: price.ask.close - (stop_distance * input_streams[0].instrument.unit_size)
                            };
                            out.set_limit = {
                                price: price.ask.close + (limit_distance * input_streams[0].instrument.unit_size)
                            };
                            this.next_trade_id++;
                        } else if (this.position === FLAT && trend === SHORT && exec === SHORT) {
                            out.enter_short = {
                                id: this.next_trade_id,
                                entry_price: price.bid.close,
                                //instrument: input_streams[0].instrument && input_streams[0].instrument.id,
                                units: 1
                            };
                            out.set_stop = {
                                price: price.bid.close + (stop_distance * input_streams[0].instrument.unit_size)
                            };
                            out.set_limit = {
                                price: price.bid.close - (limit_distance * input_streams[0].instrument.unit_size)
                            };
                            this.next_trade_id++;
                        }
                    }
                    output_stream.set(out);
                    break;

                case 4: // trade
                    var trade = input_streams[4].get();

                    // detect changes in position from trade proxy/simulator
                    if (_.isObject(trade) && !_.isEmpty(trade)) {
                        if (trade.trade_end) {
                            console.log("TRADE ENDED:", trade.trade_end);
                            this.position = FLAT;
                        }
                        if (trade.trade_start) {
                            console.log("TRADE STARTED:", trade.trade_start);
                            this.position = trade.trade_start.direction;
                        }
                    }

                    this.stop_propagation();
                    break;
                default:
                    throw Error("Unexpected src_idx: " + src_idx);
            }

        }
    };
});
