define(['underscore', 'd3'], function(_, d3) {

    return {

        param_names: ['weights', 'scales'],

        input: ['num', 'num+'], // at least 2 req'd
        output: 'confidence',

        initialize: function(params, input_streams, output) {
            if (!_.isArray(params.weights)) throw new Error("'weights' param must be provided with an array of nums");
            if (params.weights.length != input_streams.length) throw new Error("'weights' param must have array size equal to number of input streams");
            var sum = params.weights.reduce(function(memo, num) {return memo+num}, 0);
            if (!_.isFinite(sum)) throw new Error("'weights' param must be an array of nums");
            this.nweights = _.map(params.weights, function(w) {return w / sum});
            this.scales = _.map(input_streams, function(inp, idx) {
                if (_.isArray(params.scales) && params.scales[idx]) {
                    var scale = params.scales[idx];
                    if (_.isArray(scale)) {
                        return d3.scale.linear().domain(scale)
                    } else {
                        return d3.scale.linear()
                    }
                } else {
                    return d3.scale.linear()
                }
            });
        },

        on_bar_update: function(params, input_streams, output) {
            var wsum = _.reduce(_.range(input_streams.length), function(memo, i) {return memo + this.scales[i](input_streams[i].get(0)) * this.nweights[i]}, 0);
            output.set(wsum);
        }
    };

})
