define(['indicators/ATR'], function(ATR) {

    // for searchmode
    const BOTH = 0;
    const PEAK = 1;
    const LAWN = -1;

    return {

        param_names: ["depth", "deviation"],

        input: 'candle_bar',
        output: 'peak',

        initialize: function(params, input_streams, output) {

            if (!input_streams[0].instrument) throw new Error("ZigZag indicator input stream must define an instrument");

            this.unit_size = input_streams[0].instrument.unit_size;

            this.out_high = output.substream("high");
            this.out_low = output.substream("low");
            this.atr = this.indicator([ATR, 9], input_streams[0]);

            this.search_mode = BOTH;
            this.last_low_val = null;
            this.last_low_idx = null;
            this.last_high_val = null;
            this.last_high_idx = null;

            this.is_in_ellipse = function(from_idx, from_price, to_idx, to_price) {
                return (Math.pow(to_idx - from_idx, 2) / Math.pow(params.depth, 2)) + (Math.pow((to_price - from_price) / this.unit_size, 2) / Math.pow(params.deviation * (this.atr.output_stream.get_index(from_idx) / this.unit_size), 2)) <= 1.0;
            }
        },

        on_bar_update: function(params, input_streams, output) {

            var source = input_streams[0].simple();
            var source_high = input_streams[0].substream("high");
            var source_low = input_streams[0].substream("low");

            this.atr.update();

            if (this.current_index() === 0) {
                this.last_low_idx = 0;
                this.last_low_val = source_low.get();
                this.last_high_idx = 0;
                this.last_high_val = source_high.get();
            }

            if (this.search_mode === BOTH) {
                this.search_mode = PEAK;
            } else if (this.search_mode === LAWN) {
                if (source.high() > this.last_high_val) {
                    if (this.last_high_idx) this.out_high.set_index(null, this.last_high_idx);
                    this.last_high_val = source.high();
                    this.last_high_idx = this.current_index();                
                    this.out_high.set(this.last_high_val);
                }
                if (!this.is_in_ellipse(this.last_high_idx,this.last_high_val,this.current_index(),source.low()) && this.current_index() > this.last_high_idx) {
                    this.last_low_val = source.low();
                    this.out_low.set(this.last_low_val);
                    this.last_low_idx = this.current_index();
                    this.search_mode = PEAK;
                }
            } else if (this.search_mode === PEAK) {
                if (source.low() < this.last_low_val) {
                    if (this.last_low_idx) this.out_low.set_index(null, this.last_low_idx);
                    this.last_low_val = source.low();
                    this.last_low_idx = this.current_index();    
                    this.out_low.set(this.last_low_val);
                }
                if (!this.is_in_ellipse(this.last_low_idx,this.last_low_val,this.current_index(),source.high()) && this.current_index() > this.last_low_idx) {
                    this.last_high_val = source.high();
                    this.out_high.set(this.last_high_val);
                    this.last_high_idx = this.current_index();
                    this.search_mode = LAWN;
                }
            }
        }
    }

})
