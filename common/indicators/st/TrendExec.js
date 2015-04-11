
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
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            switch (src_idx) {
                case 0: // price
                case 1: // climate
                case 2: // trend
                case 3: // exec
                    var price = input_streams[0].get();
                    var climate = input_streams[1].get();
                    var trend = input_streams[2].get()
                    var exec = input_streams[3].get();

                    var out = _.isObject(trade) ? trade : {};

                    if (true) { // climate check
                        if (trend === LONG && exec === LONG) {
                            out.enter_long = price.ask.close;
                            console.log(price.date, "ENTER_LONG");
                        } else if (trend === SHORT && exec === SHORT) {
                            out.enter_short = price.bid.close;
                            console.log(price.date, "ENTER_SHORT");
                        }
                    }

                    output_stream.set(out);
                    break;
                case 4: // trade
                    var trade = input_streams[4].get();
                    break;
                default:
                    throw Error("Unexpected src_idx: " + src_idx);
            }



        }
    };
});
