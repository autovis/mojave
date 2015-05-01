define(['underscore', 'stream'], function(_, Stream) {

    return {

        description: "Return direction for double hook formation, where second hook is higher than first, and distance between hooks is within 'max_dist'",

        param_names: ['max_dist'],

        input: ['num'],
        output: 'direction',

        initialize: function(params, input_streams, output) {
            this.input = input_streams[0];
            params.max_dist = params.max_dist || 10;
            this.minima = new Stream(2, 'mins', {type: [['index', 'uint'], ['value', 'num']]});
            this.maxima = new Stream(2, 'maxs', {type: [['index', 'uint'], ['value', 'num']]});
            this.last_peak = 0;
        },

        on_bar_update: function(params, input_streams, output) {

            if (this.current_index() > 1) {

                if (this.input.get(0) > this.input.get(1) && this.input.get(1) <= this.input.get(2)) {
                    this.minima.next();
                    this.minima.set({index: this.current_index()-1, value: this.input.get(1)});
                    this.last_peak = 1;
                } else if (this.input.get(0) < this.input.get(1) && this.input.get(1) >= this.input.get(2)) {
                    this.maxima.next();
                    this.maxima.set({index: this.current_index()-1, value: this.input.get(1)});
                    this.last_peak = -1;
                }

                if (this.minima.current_index() > 1 &&
                    this.last_peak === 1 &&
                    this.minima.get(0).value > this.minima.get(1).value &&
                    this.minima.get(0).index - this.minima.get(1).index <= params.max_dist) {
                        output.set(1);
                } else if (this.maxima.current_index() > 1 &&
                    this.last_peak === -1 &&
                    this.maxima.get(0).value < this.maxima.get(1).value &&
                    this.maxima.get(0).index - this.maxima.get(1).index <= params.max_dist) {
                        output.set(-1);
                }

            }
        }
    }
})
