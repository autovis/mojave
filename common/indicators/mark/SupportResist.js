'use strict';

define(['lodash', 'lib/deque'], (_, Deque) => {

    var default_options = {

        expire_bars: 10,
        y_thres: 3.0

        //deque_size: 16
    };

    return {

        description: ``,

        param_names: ['options'],

        input: ['candle_bar'],
        output: 'hlines',

        initialize() {
            this.options = _.assign({}, default_options, this.param.options || {});
            this.unit_size = this.inputs[0].instrument.unit_size;

            this.last_index = -1;
        },

        on_bar_update() {
            var self = this;

            if (this.index === this.last_index) return;

            var hlines = [];



            this.output.set(hlines);

            this.last_index = this.index;

        }

    };

});
