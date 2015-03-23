define(['underscore', 'indicators/EMA', 'indicators/dir/Crosses'], function(_, EMA, Crosses) {

    const LONG = 1, SHORT = -1, FLAT = 0;

    return {
        param_names: [],

        input: ['dual_candle_bar', 'trade?'],
        sync: ['a', 'a'],
        output: 'trade',

        initialize: function(params, input_streams, output_stream) {
            this.ask = input_streams[0].substream("ask");
            this.bid = input_streams[0].substream("bid");
            this.fastema = this.indicator([EMA, 8], this.ask.substream("close"));
            this.slowema = this.indicator([EMA, 34], this.ask.substream("close"));
            this.crosses = this.indicator([Crosses], [this.fastema, this.slowema]);
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            var out = {};

            if (src_idx === 0) { // price

                this.fastema.update();
                this.slowema.update();
                this.crosses.update();

                if (this.crosses.get() == LONG) {
                    out.enter_long = input_streams[0].get(0).ask.close;
                } else if (this.crosses.get() == SHORT) {
                    out.enter_short = input_streams[0].get(0).bid.close;
                }

            } else if (src_idx === 1) { // trade
            
                var trade = inputs_streams[1].get(0);

                out = _.clone(trade);

            }

            output_stream.set(out);
        }
    };
})
