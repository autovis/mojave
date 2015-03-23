define(['underscore'], function(_) {

    const LONG = 1, SHORT = -1, FLAT = 0;
    
    return {

        param_names: [],

        input: ['dual_candle_bar', 'trade'],
        sync: ['a', 'a'],
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

            var out = {};

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
            
            } else if (src_idx === 1) { // trade

                var tr = input_streams[1].get();
            
                if (tr.stop) {this.stop = tr.stop}
                if (tr.limit) {this.limit = tr.limit}
                if (tr.lotsize) {this.lotsize = tr.lotsize}
                if (tr.enter_long) {
                    tr.position = LONG
                } else if (tr.enter_short) {
                    tr.position = SHORT;
                    if (tr.id === undefined) {
                        tr.id = this.next_id;
                        this.next_id++;
                    }
                } else if (tr.exit) {
                    if (tr.id === undefined) {
                        tr.id = this.id;
                    }
                    tr.position = FLAT;
                }

                out = _.clone(tr);
            
            } else {
                throw new Error("Unknown source index: "+src_idx);    
            }

            output_stream.set(out);
        }
    };
})
