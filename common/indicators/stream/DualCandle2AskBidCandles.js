define(['indicators/vis/Price'], function(Price) {
    return {
        param_names: [],

        input: ['dual_candle_bar'],
        output: [['ask', 'candle_bar'], ['bid', 'candle_bar']],

        // Initialize indicator
        initialize: function(params, input_streams, output_stream) {
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output_stream) {
            var inp = input_streams[0].get(0);
            output_stream.set({
                ask: {
                    date: inp.date,
                    open: inp.ask.open,
                    high: inp.ask.high,
                    low: inp.ask.low,
                    close: inp.ask.close,                    
                    volume: inp.volume
                },
                bid: {
                    date: inp.date,
                    open: inp.bid.open,
                    high: inp.bid.high,
                    low: inp.bid.low,
                    close: inp.bid.close,                    
                    volume: inp.volume
                }
            });
        }
    };
})