define(['underscore', 'sylvester'], function(_, syl) {

    return {

        param_names: ["period", "power"],

        input: 'num',
        output: 'poly',

        initialize: function(params) {
            if (params.period < 3) throw new Error("'period' parameters must be at least 3");
        },

        on_bar_update: function(params, input_streams, output) {

            var input = input_streams[0];
            params.power = params.power || 1;

            if (this.current_index() >= params.period+1) {
                var points = _.map(_.range(_.max([this.current_index() - params.period, 0]), this.current_index()), function(idx) {
                    return {x:idx, y:input.get_index(idx)};
                });

                // setup necessary matrices and vectors
                var X_data = [];
                var y_data = [];
                _.each(points, function(p) {
                    var row = [];
                    _.each(_.range(0,params.power+1), function(deg) {
                        row.push(Math.pow(p.x,deg));
                    })
                    X_data.push(row);
                    y_data.push(p.y);
                });

                var X = syl.Matrix.create(X_data);
                var y = syl.Vector.create(y_data);

                // apply least squares estimation
                // (X_T * X)^-1 * X_T * y
                // see: http://en.wikipedia.org/wiki/Polynomial_regression#Matrix_form_and_calculation_of_estimates

                var X_T = X.transpose();
                var a = X_T.multiply(X).inverse().multiply(X_T.multiply(y));

                output.set(a.elements);

            } else {
                output.set(null);
            }
        }
    }
})
