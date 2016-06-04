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
            this.lasthigh = [null, 0];
            this.lastlow = [null, 0];

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
            var lowest = this.low_deque.peekFront();

            // get highest
            var curr_high = this.src.high();
            while (!this.high_deque.isEmpty() && this.high_deque.peekBack()[0] <= curr_high) {
                this.high_deque.removeBack();
            }
            this.high_deque.insertBack([curr_high, this.index]);
            while (this.high_deque.peekFront()[1] <= this.index - this.param.depth) {
                this.high_deque.removeFront();
            }
            var highest = this.high_deque.peekFront();

            /////////////////////////////////////////////////////////////////////////////

            if (this.index < this.param.depth) return;

            /////////////////////////////////////////////////////////////////////////
            // LOWs

            if (lowest[1] !== this.lastlow[1]) {
                if (this.index - this.lastlow[1] > this.param.depth) {
                    // previous lastlow is removed
                    this.lowmap.set_index(null, this.lastlow[1]);
                } else {
                    // previous lastlow stays
                    // (do nothing)
                }
                // a new low is found: lastlow is updated
                this.lastlow = lowest;
                this.lowmap.set_index(this.lastlow[0], this.lastlow[1]);
            }

            /////////////////////////////////////////////////////////////////////////
            // HIGHs

            if (highest[1] !== this.lasthigh[1]) {
                if (this.index - this.lasthigh[1] > this.param.depth) {
                    // previous lasthigh is removed
                    this.highmap.set_index(null, this.lasthigh[1]);
                } else {
                    // previous lasthigh stays
                    // (do nothing)
                }
                // a new low is found: lasthigh is updated
                this.lasthigh = highest;
                this.highmap.set_index(this.lasthigh[0], this.lasthigh[1]);
            }

            /////////////////////////////////////////////////////////////////////////

            this.last_index = this.index;
        },

    };

});
