'use strict';

define(['lodash'], _ => {

    return {

        description: `The ZigZag indicator -- formula ported from FXCM Trading Station`,

        param_names: ['depth', 'deviation', 'backstep'],

        input: 'candle_bar',
        output: 'peak',

        initialize() {

            if (!this.inputs[0].instrument) throw new Error('ZigZag indicator input stream must define an instrument');

            this.unit_size = this.inputs[0].instrument.unit_size;

            this.highmap = this.output.substream('high');
            this.lowmap = this.output.substream('low');
            this.lastlow = null;
            this.lasthigh = null;

            this.last_index = -1;
        },

        on_bar_update() {

            console.log("### " + this.index + " -----------------------------");
            if (this.index === this.last_index) return;
            if (this.index < this.param.depth) return;

            var source = this.inputs[0].simple();
            var source_high = this.inputs[0].substream('high');
            var source_low = this.inputs[0].substream('low');

            /////////////////////////////////////////////////////////////////////////
            // LOWs

            // get lowest of past <depth> bars
            var lowest = _.min(source_low.slice(this.param.depth));

            if (lowest === this.lastlow) {
                lowest = null;
            } else {
                this.lastlow = lowest;
                console.log('NEW LOW: ' + this.lastlow + ' [' + this.index + ']');

                // if current bar is lower than lowest by deviation
                if ((source.low() - lowest) > (this.param.deviation * this.unit_size)) {
                    lowest = null;
                } else {
                    for (let back = 1; back <= this.param.backstep; back++) {
                        let res = this.lowmap.get(back);
                        if (res !== null && res > lowest) {
                            this.lowmap.set(null, back);
                            console.log('LOWMAP[' + (this.index - back) + '] = null');
                        }
                    }
                }
            }

            if (source.low() === lowest) {
                this.lowmap.set(lowest);
                console.log('LOWMAP[' + this.index + '] = ' + lowest);
            } else {
                this.lowmap.set(null);
                console.log('LOWMAP[' + this.index + '] = null');
            }

            /////////////////////////////////////////////////////////////////////////
            // HIGHs

            var highest = _.max(source_high.slice(this.param.depth));

            if (highest === this.lasthigh) {
                highest = null;
            } else {
                this.lasthigh = highest;
                console.log('NEW HIGH: ' + this.lasthigh + ' [' + this.index + ']');

                // if current bar is higher than highest by deviation
                if ((highest - source.high()) > (this.param.deviation * this.unit_size)) {
                    highest = null;
                } else {
                    for (var back = 1; back <= this.param.backstep; back++) {
                        var res = this.highmap.get(back);
                        if (res !== null && res < highest) {
                            this.highmap.set(null, back);
                            console.log('HIGHMAP[' + (this.index - back) + '] = null');
                        }
                    }
                }
            }

            if (source.high() === highest) {
                this.highmap.set(highest);
                console.log('HIGHMAP[' + this.index + ']: = ' + highest);
            } else {
                this.highmap.set(null);
                console.log('HIGHMAP[' + this.index + '] = null');
            }

            this.last_index = this.index;
        },

    };

});
