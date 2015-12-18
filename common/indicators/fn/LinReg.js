define(['lodash', 'simple_statistics'], function(_, ss) {

    return {

        param_names: ["period"],

        input: 'num',
        output: 'num',

        initialize: function(params) {
            this.range = _.range(0, params.period).reverse();
        },

        on_bar_update: function(params, input_streams, output) {

            var input = input_streams[0];

            // Regression[period] = mathex.lreg(source, core.rangeTo(period, n));
            if (this.current_index() > 0) {
                var data = _.map(_.range(_.max([this.current_index() - params.period, 0]), this.current_index()), function(idx) {
                    return [idx, input.get_index(idx)];
                });
                var line = ss.linearRegression().data(data).line();
                output.set(line(this.current_index()));
            } else {
                output.set(null);
            }
        }
    }
});
