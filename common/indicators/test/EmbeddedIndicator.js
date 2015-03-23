define(['underscore', 'indicators/MVA'], function(_, MVA) {

    return {

        param_names: ["period"],

        input: 'num',
        output: 'num',

        initialize: function(params, input_streams) {
            this.mva = this.indicator([MVA, params.period], input_streams[0]);
        },

        on_bar_update: function(params, input_streams, output) {

            this.mva.update();

            output.set(this.mva.get(0));
        }
    }
})
