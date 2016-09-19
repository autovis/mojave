'use strict';

define(['lodash', 'lib/deque'], (_, Deque) => {

    var default_options = {
        'min_r2': 0.90,
        'min_slope': 0.2,
        'max_slope': 2.0,

        // number of bars price must close outside of trendline to be considered a confirmed break
        'break_bar_count': 3,
    };

    return {

        description: `Detect trend conditions`,

        param_names: ['options'],

        input: ['candle_bar', 'trendlines'],
        output: [
            ['state', 'string'],
            ['dir', 'direction'],
            ['conf', 'confidence'],
            ['line', 'object']
        ],

        initialize() {
            this.options = _.assign({}, default_options, this.param.options || {});
            this.unit_size = this.inputs[0].instrument.unit_size;

            // ...

            this.last_index = -1;
        },

        on_bar_update() {

        },

        on_bar_open() {
            this.output.set({
                state: "",
                dir: 1,
                conf: 1.0,
                line: {}
            });
            //this.on_bar_close.apply(this, arguments);
        },

        on_bar_close() {
            this.output.set({
                state: "",
                dir: -1,
                conf: 1.0,
                line: {}
            });
        }

    };

});
