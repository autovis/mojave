
// Basic Trend+Execution strategy set up

// Enters trade when:
//     - trend and exec streams go in same direction
//     - climate stream is true
//     - not already in trade

define(['underscore'], function(_) {

    const LONG = 1, SHORT = -1, FLAT = 0;

    return {
        param_names: [],
        //      price              climate trend        exec         trade
        input: ['dual_candle_bar', 'bool', 'direction', 'direction', 'trade?'],
        synch: ['s',               's',    's',         's',         'a'],

        output: 'trade',

        initialize: function(params, input_streams, output_stream) {
            this.next_trade_id = 1;
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
                        if (trend === LONG && exec === LONG) {
                            out.enter_long = {
                                id: this.next_trade_id,
                                price: {ask: price.ask.close, bid: price.bid.close}
                            };
                            this.next_trade_id++;
                            console.log(price.date, "ENTER_LONG");
                        } else if (trend === SHORT && exec === SHORT) {
                            out.enter_short = {
                                id: this.next_trade_id,
                                price: {ask: price.ask.close, bid: price.bid.close}
                            };
                            this.next_trade_id++;
                            console.log(price.date, "ENTER_SHORT");
                        }
                    }
                    output_stream.set(out);
                    break;
                case 4: // trade
                    var trade = input_streams[4].get();

                    // detect changes in stop/limit

                    this.stop_propagation();
                    break;
                default:
                    throw Error("Unexpected src_idx: " + src_idx);
            }

        }
    };
});
