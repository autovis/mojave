define(['lodash', 'indicators/MVA'], function(_, MVA) {

    return {

        param_names: ["trig_thres", "exit_thres"],

        input: ['direction_confidence', 'bool'],
        output: 'trade',

        initialize: function(params, input_streams) {
            this.
            this.trigger = input_streams[1];
            this.in_trade = false;
        },

        on_bar_update: function(params, input_streams, output) {


            this.mva.update();

            output.set(this.mva.get(0));
        }
    }
})
