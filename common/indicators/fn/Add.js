define([], function() {

    return {

        param_names: [],

        input: ['num', 'num+'],
        output: 'num',

        // Initialize indicator
        initialize: function(params, input_streams, output) {
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output) {
            var sum = input_streams.reduce(function(memo, val) {return memo + val}, 0);
            output.set(sum);
        }
    };
});
