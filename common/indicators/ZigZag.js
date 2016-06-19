'use strict';

define(['lodash', 'lib/deque', 'expression'], (_, Deque, Expression) => {

    return {

        description: `The ZigZag indicator`,

        param_names: ['depth', 'deviation'],

        input: ['candle_bar', '_*'],
        output: 'peak',

        initialize() {

            if (!this.inputs[0].instrument) throw new Error('ZigZag indicator input stream must define an instrument');
            if (!_.isNumber(this.param.depth)) throw new Error('<depth> parameter must be a number');
            this.unit_size = this.inputs[0].instrument.unit_size;
            if (_.isString(this.param.deviation)) {
                this.vars.unit_size = this.unit_size;
                let dev_expr = new Expression(this.param.deviation, {streams: this.inputs, vars: this.vars});
                this.get_deviation = () => dev_expr.evaluate();
            } else if (_.isNumber(this.param.deviation)) {
                this.get_deviation = () => this.param.deviation * this.unit_size;
            } else throw new Error('<deviation> parameter must be a number or valid expression');

            this.high_deque = new Deque(this.param.depth);
            this.low_deque = new Deque(this.param.depth);

            this.highmap = this.output.substream('high');
            this.lowmap = this.output.substream('low');
            this.highest_prev_bar = null;
            this.lowest_prev_bar = null;
            this.last_high = [null, 0];
            this.last_low = [null, 0];

            this.src = this.inputs[0].simple();
            this.last_index = -1;
        },

        on_bar_update() {

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

            if (!this.highest_prev_bar) {
                this.highmap.set_index(highest[0], highest[1]);
                this.highest_prev_bar = highest;
                this.last_high = highest;
            }
            if (!this.lowest_prev_bar) {
                this.lowmap.set_index(lowest[0], lowest[1]);
                this.lowest_prev_bar = lowest;
                this.last_low = lowest;
            }

            /////////////////////////////////////////////////////////////////////////
            // HIGHs

            if (highest[1] !== this.highest_prev_bar[1]) {
                if (highest[1] > lowest[1] && highest[0] - this.last_low[0] > this.get_deviation()) {
                    if (this.last_high[1] > this.last_low[1]) {
                        this.highmap.set_index(null, this.last_high[1]);
                    }
                    this.highmap.set_index(highest[0], highest[1]);
                    this.last_high = highest;
                }
            }

            /////////////////////////////////////////////////////////////////////////
            // LOWs

            if (lowest[1] !== this.lowest_prev_bar[1]) {
                if (lowest[1] > highest[1] && this.last_high[0] - lowest[0] > this.get_deviation()) {
                    if (this.last_low[1] > this.last_high[1]) {
                        this.lowmap.set_index(null, this.last_low[1]);
                    }
                    this.lowmap.set_index(lowest[0], lowest[1]);
                    this.last_low = lowest;
                }
            }

            /////////////////////////////////////////////////////////////////////////

            this.last_index = this.index;
            this.highest_prev_bar = highest;
            this.lowest_prev_bar = lowest;
        },

    };

});
