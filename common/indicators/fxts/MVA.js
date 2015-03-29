define(['underscore'], function(_) {

    return {

        param_names: ["period"],

        input: 'num',
        output: 'num',

        initialize: function(params) {
            this.range = _.range(0, params.period).reverse();
        },

        on_bar_update: function(params, input_streams, output) {

            var input = input_streams[0];

            /*
            if (period >= first) then
                out[period] = mathex.avg(source, period - n + 1, period);
            end
            */
            var value = this.current_index() >= params.period-1 ? _.reduce(this.range, function(memo, num) { return memo + input.get(num); }, 0) / this.range.length : null;
            output.set(value);
        }
    }
})
