'use strict';

define(['lodash'], function(_) {

    return {

        param_names: [],

        input: ['num[]', 'num', 'num+'], // at least 2 req'd
        output: 'num',

        initialize: function(params, input_streams, output) {
            if (!_.isArray(params.weights)) throw new Error("'weights' param must be provided with an array of nums");
            if (params.weights.length !== input_streams.length) throw new Error("'weights' param must have array size equal to number of input streams");
            var sum = params.weights.reduce((memo, num) => memo + num, 0);
            if (!_.isFinite(sum)) throw new Error("'weights' param must be an array of nums");
            this.nweights = _.map(params.weights, w => w / sum);
        },

        on_bar_update: function(params, input_streams, output) {
            var wsum = _.reduce(_.range(input_streams.length), function(memo, i) {return memo + input_streams[i].get(0) * this.nweights[i]}, 0);
            output.set(wsum);
        }
    };
});
