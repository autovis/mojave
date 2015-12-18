define(['lodash'], function(_) {
    return {
        description: "Returns direction if all input streams have the same direction; else returns null",

        param_names: ['threshold'], // threshold of distance from 0 to not be flat

        input: ['num*'],
        output: 'direction',

        initialize: function(params, input_streams, output_stream) {
            if (params.threshold && !_.isNumber(params.threshold)) throw Error("param 'threshold' must be a number");
            params.threshold = Math.abs(params.threshold || 0);
        },

        on_bar_update: function(params, input_streams, output_stream) {
            if (this.current_index() > 0) {
                var value = input_streams.map(function(stream) {
                    var diff = stream.get(0) - stream.get(1);
                    return diff > params.threshold ? 1 : (diff < -params.threshold ? -1 : 0);
                }).reduce(function(prev, curr) {
                    return prev === undefined ? curr : (curr === prev ? curr : null);
                }, undefined);
                output_stream.set(value);
            }
        }
    };
});
