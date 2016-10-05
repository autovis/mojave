'use strict';

define(['lodash', 'lib/deque'], (_, Deque) => {

    var default_options = {
        levels: [
            [50, 61.8]
        ]
    };

    return {

        description: ``,

        param_names: ['options'],

        input: ['peak+'],
        output: 'bands',

        initialize() {
            this.options = _.assign({}, default_options, this.param.options || {});
            this.unit_size = this.inputs[0].instrument.unit_size;

            this.last_index = -1;
        },

        on_bar_update() {

            if (this.index === this.last_index) return;

            var hlines = [];



            this.output.set(hlines);

            this.last_index = this.index;

        }

    };

});
