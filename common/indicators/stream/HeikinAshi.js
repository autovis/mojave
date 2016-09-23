'use strict';

define(['indicators/vis/Price'], Price => {
    return {
        description: `Converts normal candlestick data to Heiken-Ashi candlesticks.
        http://stockcharts.com/school/doku.php?id=chart_school:chart_analysis:heikin_ashi`,

        param_names: [],

        input: ['candle_bar'],
        output: 'candle_bar',

        initialize() {
        },

        on_bar_update() {
            var curr_bar = this.inputs[0].get();
            if (this.index > 0) {
                var last_ha_bar = this.output.get(1);
                var out = {};
                out.date = curr_bar.date;
                out.volume = curr_bar.volume;
                out.close = (curr_bar.open + curr_bar.high + curr_bar.low + curr_bar.close) / 4;
                out.open = (last_ha_bar.open + last_ha_bar.close) / 2;
                out.high = Math.max(curr_bar.high, out.open, out.close);
                out.low = Math.min(curr_bar.low, out.open, out.close);
                this.output.set(out);
            } else {
                this.output.set(curr_bar);
            }
        },

        vis_render_fields: Price.vis_render_fields,
        vis_init: Price.vis_init,
        vis_render: Price.vis_render,
        vis_update: Price.vis_update
    };
});
