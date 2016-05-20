'use strict';

define(['lodash', 'lib/deque'], (_, Deque) => {

    return {

        description: `The ZigZag indicator`,

        param_names: ['depth', 'deviation'],

        input: 'candle_bar',
        output: 'peak',

        initialize() {

            if (!this.inputs[0].instrument) throw new Error('ZigZag indicator input stream must define an instrument');

            this.unit_size = this.inputs[0].instrument.unit_size;

            this.high_deque = new Deque(this.param.depth);
            this.low_deque = new Deque(this.param.depth);

            this.highmap = this.output.substream('high');
            this.lowmap = this.output.substream('low');
            this.lasthigh = null;
            this.lastlow = null;
            this.lasthigh_bar = -1;
            this.lastlow_bar = -1;

            this.src = this.inputs[0].simple();
            this.last_index = -1;
        },

        on_bar_update() {

            console.log("### " + this.index + " -----------------------------");
            if (this.index === this.last_index) return;

            // get lowest
            var curr_low = this.src.low();
            while (!this.low_deque.isEmpty() && this.low_deque.peekBack()[0] >= curr_low) {
                this.low_deque.removeBack();
            }
            this.low_deque.insertBack([curr_low, this.index]);
            while (this.low_deque.peekFront()[1] <= this.index - this.param.depth) {
                this.low_deque.removeFront();
            }
            var lowest = this.low_deque.peekFront()[0];

            // get highest
            var curr_high = this.src.high();
            while (!this.high_deque.isEmpty() && this.high_deque.peekBack()[0] <= curr_high) {
                this.high_deque.removeBack();
            }
            this.high_deque.insertBack([curr_high, this.index]);
            while (this.high_deque.peekFront()[1] <= this.index - this.param.depth) {
                this.high_deque.removeFront();
            }
            var highest = this.high_deque.peekFront()[0];

            /////////////////////////////////////////////////////////////////////////////

            if (this.index < this.param.depth) return;

            /////////////////////////////////////////////////////////////////////////
            // LOWs

            if (lowest === this.lastlow) {
                lowest = null;
            } else {
                this.lastlow = lowest;
                console.log('NEW LOW: ' + this.lastlow + ' [' + this.index + ']');

                // if current bar is lower than lowest by deviation
                if ((this.src.low() - lowest) > (this.param.deviation * this.unit_size)) {
                    lowest = null;
                } else {
                    for (let back = 1; back <= (this.index - this.lastlow_bar); back++) {
                        let res = this.lowmap.get(back);
                        if (res !== null && res > lowest && this.lasthigh_bar < this.index - back) {
                            this.lowmap.set(null, back);
                            console.log('LOWMAP[' + (this.index - back) + '] = null');
                        }
                    }
                }
            }

            if (this.src.low() === lowest) {
                this.lowmap.set(lowest);
                this.lastlow_bar = this.index;
                console.log('LOWMAP[' + this.index + '] = ' + lowest);
            } else {
                this.lowmap.set(null);
                console.log('LOWMAP[' + this.index + '] = null');
            }

            /////////////////////////////////////////////////////////////////////////
            // HIGHs

            if (highest === this.lasthigh) {
                highest = null;
            } else {
                this.lasthigh = highest;
                console.log('NEW HIGH: ' + this.lasthigh + ' [' + this.index + ']');

                // if current bar is higher than highest by deviation
                if ((highest - this.src.high()) > (this.param.deviation * this.unit_size)) {
                    highest = null;
                } else {
                    for (var back = 1; back <= (this.index - this.lasthigh_bar); back++) {
                        var res = this.highmap.get(back);
                        if (res !== null && res < highest && this.lastlow_bar < this.index - back) {
                            this.highmap.set(null, back);
                            console.log('HIGHMAP[' + (this.index - back) + '] = null');
                        }
                    }
                }
            }

            if (this.src.high() === highest) {
                this.highmap.set(highest);
                this.lasthigh_bar = this.index;
                console.log('HIGHMAP[' + this.index + ']: = ' + highest);
            } else {
                this.highmap.set(null);
                console.log('HIGHMAP[' + this.index + '] = null');
            }

            this.last_index = this.index;
        },

    };

});
