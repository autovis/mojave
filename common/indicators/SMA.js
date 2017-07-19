'use strict';

define({

    param_names: ['period'],

    input: 'num',
    output: 'num',

    initialize() {
    },

    on_bar_update() {
        if (this.index === 0) {
            this.output.set(this.inputs[0].get(0));
        } else {
            var last = this.output.get(1) * Math.min(this.index, this.param.period);

            if (this.index >= this.param.period) {
                this.output.set((last + this.inputs[0].get(0) - this.inputs[0].get(this.param.period)) / Math.min(this.index, this.param.period));
            } else {
                this.output.set((last + this.inputs[0].get(0)) / (Math.min(this.index, this.param.period) + 1));
            }
        }
    }

});
