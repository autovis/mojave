define(['underscore'], function(_) {

    return {

        param_names: ['thres'],

        input: 'num',
        output: 'direction',

        initialize: function(params, input_streams, output) {
            if (_.isArray(params.reach)) {
                params.long_thres = params.thres[0];
                params.short_thres = params.thres[1];
            } else {
                params.long_thres = params.short_thres = params.thres;
            }
            this.input = input_streams[0];
        },

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
