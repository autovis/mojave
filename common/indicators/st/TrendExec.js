
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
        sync:  ['a',               'a',    'a',         'a',         'a'],

        output: 'trade',

        initialize: function(params, input_streams, output_stream) {
            this.ask = input_streams[0].substream("ask");
            this.bid = input_streams[0].substream("bid");
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            var out = {};

            switch (src_idx) {
                case 0: // price
                    break;
                case 1: // climate
                    break;
                case 2: // trend
                    break;
                case 3: // exec
                    break;
                case 4: // trade
                    break;
                default:
                    throw Error("Unexpected src_idx: " + src_idx);
            }

            output_stream.set(out);
        }
    };
})
