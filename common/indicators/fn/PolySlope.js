define(['lodash', 'sylvester'], function(_, syl) {

    return {

        param_names: [],

        input: ['poly', 'num?'],
        output: 'num',

        initialize: function(params) {
        },

        on_bar_update: function(params, input_streams, output) {

            var xval = input_streams[1] ? input_streams[1].get(0) : this.current_index();

            // get derivative of poly
            var poly = input_streams[0].get(0);

            if (_.isArray(poly)) {
                var poly_d = _.map(_.range(1, poly.length), function(i) {
                    return poly[i] * i;
                });

                // evaluate derived function using current x value
                output.set(_.reduce(_.range(0,poly_d.length), function(memo, j) {
                    return memo + poly_d[j] * Math.pow(xval, j);
                }, 0));
            } else {
                output.set(null);
            }
        }
    }
});
