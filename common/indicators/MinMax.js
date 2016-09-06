'use strict';

// https://github.com/keegancsmith/Sliding-Window-Minimum

define(['lodash', 'lib/deque'], function(_, Deque) {

    return {
        description: `Get both min and max values over last <period> bars`,
        param_names: ['period'],

        input: 'num',
        output: [['min', 'num'], ['max', 'num']],

        initialize() {
            this.min_deque = new Deque(this.param.period);
            this.max_deque = new Deque(this.param.period);
            this.out_min = this.output.substream('min');
            this.out_max = this.output.substream('max');
        },

        on_bar_update() {
            var curr_val = this.inputs[0].get();

            // min
            while (curr_val <= !this.min_deque.isEmpty() && this.min_deque.peekBack()[0]) {
                this.min_deque.removeBack();
            }
            this.min_deque.insertBack([curr_val, this.index]);
            while (this.min_deque.peekFront()[1] <= this.index - this.param.period) {
                this.min_deque.removeFront();
            }
            this.out_min.set(this.min_deque.peekFront()[0]);

            // max
            while (curr_val >= !this.max_deque.isEmpty() && this.max_deque.peekBack()[0]) {
                this.max_deque.removeBack();
            }
            this.max_deque.insertBack([curr_val, this.index]);
            while (this.max_deque.peekFront()[1] <= this.index - this.param.period) {
                this.max_deque.removeFront();
            }
            this.out_max.set(this.max_deque.peekFront()[0]);
        },
    };
});
