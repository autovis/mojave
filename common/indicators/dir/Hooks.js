define([], function() {

    return {

        param_names: [],

        input: 'num',
        output: 'direction',

        // Initialize indicator
        initialize: function(params, input_streams, output) {
            this.input = input_streams[0];
        },

        // Called when input streams are updated
        on_bar_update: function(params, input_streams, output) {
            if (this.current_index() >= 2) {        
                if (this.input.get(1) <= this.input.get(2) && this.input.get(0) > this.input.get(1)) {
                    output.set(1);
                } else if (this.input.get(1) >= this.input.get(2) && this.input.get(0) < this.input.get(1)) {
                    output.set(-1);
                } else {
                    output.set(null);
                }
            } else {
                output.set(null);
            }
        }
    }
})
