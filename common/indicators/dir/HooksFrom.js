define(['lodash'], function(_) {

    return {

        param_names: ['reach'],

        input: 'num',
        output: 'direction',

        // Initialize indicator
        initialize: function(params, input_streams, output) {
            //if (params.short_backreach === undefined) params.short_backreach = params.long_backreach;
            if (_.isArray(params.reach)) {
                params.long_backreach = params.reach[0];
                params.short_backreach = params.reach[1];
                if (params.long_backreach >= params.short_backreach) throw new Error("First element of 'thres' param array must be less than second element");
            } else {
                params.long_backreach = params.short_backreach = params.reach;
            }
            this.input = input_streams[0];
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output) {
            if (this.input.get(0) > this.input.get(1) && this.input.get(1) < params.long_backreach) {
                output.set(1);
            } else if (this.input.get(0) < this.input.get(1) && this.input.get(1) > params.short_backreach) {
                output.set(-1);
            } else {
                output.set(null);
            }
        }
    }
})
