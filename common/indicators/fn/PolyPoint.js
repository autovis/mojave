define(['underscore', 'sylvester'], function(_, syl) {

    return {

        param_names: [],

        input: ['poly', 'num?'],
        output: 'num',

        initialize: function(params) {
        },

        on_bar_update: function(params, input_streams, output) {
            
            var xval = input_streams[1] ? input_streams[1].get(0) : this.current_index(); 
            
            // Calculate point on poly line given x value
            output.set(_.reduce(_.range(1,params.power+1), function(memo, j) {
                return memo + a.e(j) * Math.pow(xval, j-1);
            }, 0));
        }
    }
})
