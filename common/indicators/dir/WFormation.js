define(['underscore'], function(_) {

    return {

        description: "Get direction for a simple rising W formation",

        param_names: [],

        input: ['num'],
        output: 'direction',

        initialize: function(params, input_streams, output) {
            this.input = input_streams[0];
        },

        on_bar_update: function(params, input_streams, output) {

            if (this.current_index() >= 4) {

                var result = [
                    // W pattern
                    Math.sign(this.input.get(4) - this.input.get(3)),
                    Math.sign(this.input.get(2) - this.input.get(3)),
                    Math.sign(this.input.get(2) - this.input.get(1)),
                    Math.sign(this.input.get(0) - this.input.get(1)),
                    // second hump is higher
                    Math.sign(this.input.get(1) - this.input.get(3))                
                ].reduce(function(memo, val) {
                    if (memo === null) return val;
                    return memo === val ? val : 0;
                }, null);

                output.set(result);
            }
        }
    }
})
