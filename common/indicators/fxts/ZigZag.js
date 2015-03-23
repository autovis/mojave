define([], function() {

    // for searchmode
    const BOTH = 0;
    const PEAK = 1;
    const LAWN = -1;

    var lastperiod = -1;

    return {

        param_names: ["depth", "deviation", "backstep"],

        input: 'candle_bar',
        output: 'peak',

        initialize: function(params, input_streams, output) {

            if (!input_streams[0].instrument) throw new Error("ZigZag indicator input stream must define an instrument");

            this.unit_size = input_streams[0].instrument.unit_size;

            this.highmap = this.stream("highmap");
            this.lowmap = this.stream("lowmap");
            this.searchmode = this.stream("searchmode");
            this.peak = this.stream("peak");

            this.out_high = output.substream("high");
            this.out_low = output.substream("low");

            this.lastperiod = -1;
            this.lastlow = null;
            this.lasthigh = null;
            this.peak_count = 0;

            this.bookmarks = {};
        },

        on_bar_update: function(params, input_streams, output) {

            var source = input_streams[0].simple();
            var source_high = input_streams[0].substream("high");
            var source_low = input_streams[0].substream("low");

            var period = this.current_index() - 1;

            this.highmap.next();
            this.lowmap.next();
            this.searchmode.next();
            this.peak.next();

            if (period >= params.depth) {

                /*
                // val = mathex.min(source.low, range, period);
                val = Math.min.apply(null, source_low.slice(range, period));

                if (val == this.lastlow) {
                    // if lowest low is not changed - ignore it
                    val = null;    
                } else {
                    // keep it
                    this.lastlow = val;
                    // if current low is higher for more than 'deviation' pips, ignore
                    if ((source_low.get_index(period) - val) > (this.unit_size * params.deviation)) {
                        val = null;
                    } else {
                        // check for the previous backstep lows
                        for (i = period - 1; i >= period - params.backstep + 1; i--) {
                            if (this.lowmap.get_index(i) != 0 && this.lowmap.get_index(i) > val) {
                                this.lowmap.set_index(0, i);    
                            }     
                        }
                    }
                }

                if (source_low.get_index(period) == val) {
                    this.lowmap.set_index(val, period);
                } else {
                    this.lowmap.set_index(0, period);
                }

                // get the lowest low for the last depth periods
                //val = mathex.max(source.high, range, period)
                val = Math.max.apply(null, source_high.slice(range, period));

                if (val == this.lasthigh) {
                    // if highest high is not changed - ignore it
                    val = null;
                } else {
                    // keep it
                    this.lasthigh = val;
                    // if current high is higher for more than 'deviation' pips
                    if ((val - source_high.get_index(period)) > (this.unit_size * params.deviation)) {
                        val = null;    
                    } else {
                        // check for the previous backstep lows highs
                        for (i = period - 1; i >= period - params.backstep + 1; i--) {
                            if ((this.highmap.get_index(i) != 0) && (this.highmap.get_index(i) < val)) {
                                this.highmap.set_index(0, i);
                            }
                        }
                    }                    
                }

                if (source_high.get_index(period) == val) {
                    this.highmap.set_index(val, period);                    
                } else {
                    this.highmap.set_index(0, period);
                }
                */

                ////////////

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
                    console.log(this.current_index()+"> LOWMAP: ", lowest);    
                } else {
                    this.lowmap.set(null);
                    console.log(this.current_index()+"> LOWMAP: null");
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
                    console.log(this.current_index()+"> HIGHMAP: ", highest);    
                } else {
                    this.highmap.set(null);
                    console.log(this.current_index()+"> HIGHMAP: null");    
                }

                var start;
                var last_peak;
                var last_peak_i;
                var prev_peak;
                var searchMode = BOTH;

                i = get_peak.call(this, -4)
                if (i == -1) {
                    prev_peak = null;    
                } else {
                    prev_peak = i;    
                }
                
                start = params.depth;
                i = get_peak.call(this, -3);
                if (i == -1) {
                    last_peak_i = null;
                    last_peak = null;    
                } else {
                    last_peak_i = i;
                    last_peak = this.peak.get_index(i)
                    searchMode = this.searchmode.get_index(i);
                    start = i;   
                }

                this.peak_count -= 3;

                for (i = start; i <= period; i++) {
                    if (searchMode == BOTH) {
                        if (this.highmap.get_index(i) !== 0) {
                            last_peak_i = i;
                            last_peak = this.highmap.get_index(i);
                            searchMode = LAWN;
                            register_peak.call(this, i, searchMode, last_peak);
                        } else if (this.lowmap.get_index(i) !== 0) {
                            last_peak_i = i;
                            last_peak = this.lowmap.get_index(i);
                            searchMode = PEAK;
                            register_peak.call(this, i, searchMode, last_peak);
                        }    
                    } else if (searchMode == PEAK) {
                        if (this.lowmap.get_index(i) !== 0 && this.lowmap.get_index(i) < last_peak) {
                            last_peak = this.lowmap.get_index(i);
                            last_peak_i = i;
                            if (prev_peak !== null) {
                                if (this.peak.get_index(prev_peak) > this.lowmap.get_index(i)) {
                                    //core.drawLine(out, core.range(prev_peak, i), Peak[prev_peak], prev_peak, LowMap[i], i, ZagC);
                                    //out:setColor(prev_peak, ZigC);  
                                    this.out_low.set_index(this.lowmap.get_index(i), i);                                      
                                } else {
                                    //core.drawLine(out, core.range(prev_peak, i), Peak[prev_peak], prev_peak, LowMap[i], i, ZigC);
                                    //out:setColor(prev_peak, ZagC);   
                                    this.out_high.set_index(this.lowmap.get_index(i), i);                                 
                                }
                            }
                            replace_last_peak.call(this, i, searchMode, last_peak);
                        }
                        if (this.highmap.get_index(i) !== 0 && this.lowmap.get_index(i) == 0) {
                            //core.drawLine(out, core.range(last_peak_i, i), last_peak, last_peak_i, HighMap[i], i, ZigC);
                            //out:setColor(last_peak_i, ZagC);
                            this.out_high.set_index(this.highmap.get_index(i), i);
                            prev_peak = last_peak_i;
                            last_peak = this.highmap.get_index(i);
                            last_peak_i = i;
                            searchMode = LAWN;
                            register_peak.call(this, i, searchMode, last_peak);                      
                        }
                    } else if (searchMode == LAWN) {
                        if (this.highmap.get_index(i) !== 0 && this.highmap.get_index(i) > last_peak) {
                            last_peak = this.highmap.get_index(i);
                            last_peak_i = i;
                            if (prev_peak !== null) {
                                //core.drawLine(out, core.range(prev_peak, i), Peak[prev_peak], prev_peak, HighMap[i], i, ZigC);
                                //out:setColor(prev_peak, ZagC);    
                                this.out_high.set_index(this.highmap.get_index(i), i);                               
                            }
                            replace_last_peak.call(this, i, searchMode, last_peak);                            
                        }
                        if (this.lowmap.get_index(i) !== 0 && this.highmap.get_index(i) == 0) {
                            if (last_peak > this.lowmap.get_index(i)) {
                                //core.drawLine(out, core.range(last_peak_i, i), last_peak, last_peak_i, LowMap[i], i, ZagC);
                                //out:setColor(last_peak_i, ZigC);         
                                this.out_low.set_index(this.lowmap.get_index(i), i);                           
                            } else {
                                //core.drawLine(out, core.range(last_peak_i, i), last_peak, last_peak_i, LowMap[i], i, ZigC);
                                //out:setColor(last_peak_i, ZagC);       
                                this.out_high.set_index(this.lowmap.get_index(i), i);                         
                            }
                        }
                        prev_peak = last_peak_i;
                        last_peak = this.lowmap.get_index(i);
                        last_peak_i = i;
                        searchMode = PEAK;
                        register_peak.call(this, i, searchMode, last_peak);                       
                    }
                }
            }
        }
    }

    function register_peak(period, mode, peak) {
        this.peak_count++;
        //out:setBookmark(peak_count, period);
        this.bookmarks[this.peak_count] = period;
        //SearchMode[period] = mode;
        this.searchmode.get_index(mode, period);
        //Peak[period] = peak;
        this.peak.set_index(peak, period);
    }

    function replace_last_peak(period, mode, peak) {
        //out:setBookmark(peak_count, period);
        this.bookmarks[this.peak_count] = period;
        //SearchMode[period] = mode;
        this.searchmode.get_index(mode, period);
        //Peak[period] = peak;
        this.peak.set_index(peak, period);
    }

    function get_peak(offset) {
        var peak;
        peak = this.peak_count + offset;
        if (peak < 1) return -1;
        //peak = out:getBookmark(peak);
        peak = this.bookmarks[peak] || -1;
        if (peak < 0) return -1;
        return peak;
    }


})
