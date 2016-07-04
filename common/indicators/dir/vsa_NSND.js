'use strict';

define(['lodash'], function(_) {

    const LONG = 1, SHORT = -1;

    return {

        description: 'Returns LONG on no supply candle and SHORT on no demand candle',

        param_names: [],

        input: ['candle_bar'],
        output: 'direction',

        initialize() {
            this.pot_no_supply = null;
            this.pot_no_demand = null;
        },

        on_bar_update() {
            if (this.index >= 2) {
                var bar = this.inputs[0].get();
                var bar_1 = this.inputs[0].get(1);
                var bar_2 = this.inputs[0].get(2);
                if (bar.open > bar.close && bar.volume < bar_1.volume && bar.volume < bar_2.volume) { // no supply
                    this.output.set(LONG);
                } else if (bar.close > bar.open && bar.volume < bar_1.volume && bar.volume < bar_2.volume) { // no demand
                    this.output.set(SHORT);
                }
            }
        }
    };
});
