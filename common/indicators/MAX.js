'use strict';

// https://github.com/keegancsmith/Sliding-Window-Minimum

define(['lodash', 'lib/deque'], function(_, Deque) {

    return {
        param_names: ['period'],

        input: 'num',
        output: 'num',

        initialize() {
            this.deque = new Deque(this.param.period);
        },

        on_bar_update() {
            var curr_val = this.inputs[0].get();
            while (!this.deque.isEmpty() && this.deque.peekBack()[0] <= curr_val) {
                this.deque.removeBack();
            }
            this.deque.insertBack([curr_val, this.index]);
            while (this.deque.peekFront()[1] <= this.index - this.param.period) {
                this.deque.removeFront();
            }
            this.output.set(this.deque.peekFront()[0]);
        },
    };
});
