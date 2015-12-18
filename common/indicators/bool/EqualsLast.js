define(['lodash'], function(_) {
    return {

        // Whether the last 'period' bars ALL had their value equal to 'compvalue'

        param_names: ["compvalue", "period"],

        input: 'num',
        output: 'bool',

        // Initialize indicator
        initialize: function(params) {
            this.range = _.range(0, params.period).reverse();
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output_stream) {

            var input = input_streams[0];

            /*
            if (period >= first) then
                out[period] = mathex.avg(source, period - n + 1, period);
            end
            */
            var value = this.current_index() >= params.period-1 ? _.reduce(this.range, function(memo, num) { return memo && input.get(num) == params.compvalue; }, true) / this.range.length : null;
            output_stream.set(value);
        }
    }
})