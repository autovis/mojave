'use strict';

define(['lodash', 'indicators/MAX', 'indicators/MIN'], function(_, MAX, MIN) {

    return {

        param_names: ['period'],

        input: 'candle_bar',
        output: ['ub', 'lb'],

        initialize: function(params, input_streams, output_stream) {
            this.upper = this.indicator([MAX, params.period], input_streams[0].substream('high'));
            this.lower = this.indicator([MIN, params.period], input_streams[0].substream('low'));
        },

        on_bar_update: function(params, input_streams, output_stream) {
            this.upper.update();
            this.lower.update();
            output_stream.set({ub: this.upper.get(), lb: this.lower.get()});
        }
    };
});
