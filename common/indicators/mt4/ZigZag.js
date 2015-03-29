define([], function() {

    return {

        param_names: ["depth", "deviation", "backstep"],

        input: 'candle_bar',
        output: 'peak',

        initialize: function(params, input_streams, output) {

            if (!params.depth) params.depth = 12;
            if (!params.deviation) params.deviation = 5;
            if (!params.backstep) params.backstep = 3;

            //if (!input_streams[0].instrument) throw new Error("ZigZag indicator input stream must have an instrument defined");

            this.unit_size = input_streams[0].instrument ? input_streams[0].instrument.unit_size : 1;

            this.highmap = this.stream("highmap");
            this.lowmap = this.stream("lowmap");

            this.curlow = null;
            this.curhigh = null;
            this.lastlow = null;
            this.lasthigh = null;
            this.lastlowpos = null;
            this.lasthighpos = null;

            this.searchmode = 0;

            this.out_date = output.substream("date");
            this.out_high = output.substream("high");
            this.out_low = output.substream("low");
        },

        on_bar_update: function(params, input_streams, output) {

            console.log(this.current_index(), " >>> LOW: "+this.out_low.get()+", HIGH: "+this.out_high.get()+" ====================================");

            var source = input_streams[0].simple();
            var source_high = input_streams[0].substream("high");
            var source_low = input_streams[0].substream("low");

            this.out_date.set(source.date());

            this.highmap.next();
            this.lowmap.next();

            if (this.current_index() < params.depth-1) return;

            // low
            var lowest = Math.min.apply(null, source_low.slice(params.depth));

            if (lowest == this.lastlow) {
                lowest = null;
            } else {
                this.lastlow = lowest;
                //console.log("LASTLOW: "+this.lastlow+" (lowest)");

                // if current bar is lower than lowest by deviation
                if ((source.low() - lowest) > (params.deviation * this.unit_size)) {
                    lowest = null;
                } else {
                    for (var back = 1; back <= params.backstep; back++) {
                        var res = this.lowmap.get(back);
                        if (res !== null && res > lowest) {
                            this.lowmap.set(null, back);
                        }
                    }
                }
            }

            if (source.low() == lowest) {
                this.lowmap.set(lowest);
                console.log("LOWMAP: ", lowest);
            } else {
                this.lowmap.set(null);
                console.log("LOWMAP: null");
            }

            // high
            var highest = Math.max.apply(null, source_high.slice(params.depth));

            if (highest == this.lasthigh) {
                highest = null;
            } else {
                this.lasthigh = highest;
                //console.log("LASTHIGH: "+this.lasthigh+" (highest)");
                if ((highest - source.high()) > (params.deviation * this.unit_size)) {
                    highest = null;
                } else {
                    for (var back = 1; back <= params.backstep; back++) {
                        var res = this.highmap.get(back);
                        if (res !== null && res < highest) this.highmap.set(null, back);
                    }
                }
            }

            if (source.high() == highest) {
                this.highmap.set(highest);
                console.log("HIGHMAP: ", highest);
            } else {
                this.highmap.set(null);
                console.log("HIGHMAP: null");
            }

            // final cutting
            if (this.searchmode == 0) {
                this.lastlow = null;
                this.lasthigh = null;
            } else {
                //this.lastlow = this.curlow;
                //this.lasthigh = this.curhigh;
            }

            switch (this.searchmode) {
                case 0: // look for peak or lawn
                    if (this.lastlow === null && this.lasthigh === null) {
                        if (this.highmap.get() !== null) {
                            this.lasthigh = source.high();
                            this.lasthighpos = this.current_index();
                            this.searchmode = -1;
                            this.out_high.set(this.lasthigh);
                            console.log("*** OUT_HIGH[0]: ",  this.lasthigh);
                        }
                        if (this.lowmap.get() !== null) {
                            this.lastlow = source.low();
                            this.lastlowpos = this.current_index();
                            this.searchmode = 1;
                            this.out_low.set(this.lastlow);
                            console.log("*** OUT_LOW[0]: ",  this.lastlow);
                        }
                    }
                    break;
                case 1: // look for peak
                    if (this.lowmap.get() !== null && this.lowmap.get() < this.lastlow && this.highmap.get() === null) {
                        this.out_low.set_index(null, this.lastlowpos);
                        this.lastlowpos = this.current_index();
                        this.lastlow = this.lowmap.get();
                        this.out_low.set(this.lastlow);
                        console.log("*** OUT_LOW[0]: ",  this.lastlow);
                    }
                    if (this.highmap.get() !== null && this.lowmap.get() === null) {
                        this.lasthigh = this.highmap.get();
                        this.lasthighpos = this.current_index();
                        this.out_high.set(this.lasthigh);
                        console.log("*** OUT_HIGH[0]: ",  this.lasthigh);
                        this.searchmode = -1;
                    }
                    break;
                case -1: // look for lawn
                    if (this.highmap.get() !== null && this.highmap.get() > this.lasthigh && this.lowmap.get() === null) {
                        this.out_high.set_index(null, this.lasthighpos);
                        this.lasthighpos = this.current_index();
                        this.lasthigh = this.highmap.get();
                        this.out_high.set(this.lasthigh);
                        console.log("*** OUT_HIGH[0]: ",  this.lasthigh);
                    }
                    if (this.lowmap.get() !== null & this.highmap.get() === null) {
                        this.lastlow = this.lowmap.get();
                        this.lastlowpos = this.current_index();
                        this.out_low.set(this.lastlow);
                        console.log("*** OUT_LOW[0]: ",  this.lastlow);
                        this.searchmode = 1;
                    }
                    break;
                default:
                    return;

            } // switch: this.searchmode
        } // on_bar_update()

    }
})
