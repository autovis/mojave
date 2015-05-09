define({

    description: "Returns direction of a swing on #1 when it 'bounces' off #2 on the same bar within diff_thres and within swing_dist bars ago",

    param_names: ['diff_thres', 'swing_dist'],

    input: ['num', 'num'],
    output: 'direction',

    initialize: function(params, input_streams, output_stream) {
        params.diff_thres = params.diff_thres || 0;
        params.swing_dist = params.swing_dist || 10;
        this.input = input_streams[0];
        this.last_swing = null;
    },

    on_bar_update: function(params, input_streams, output_stream) {

        if (this.current_index() > 1) {
            if (this.input.get(0) > this.input.get(1) && this.input.get(1) <= this.input.get(2)) {
                this.last_swing = {dir: 1, index: this.current_index()-1, value: this.input.get(1)};
            } else if (this.input.get(0) < this.input.get(1) && this.input.get(1) >= this.input.get(2)) {
                this.last_swing = {dir: -1, index: this.current_index()-1, value: this.input.get(1)};
            }
        }

        if (this.last_swing !== null && this.current_index() - this.last_swing.index <= params.swing_dist) {
            if (this.last_swing.dir === 1 && this.last_swing.value - input_streams[1].get_index(this.last_swing.index) >= params.diff_thres) {
                output_stream.set(1);
            } else if (this.last_swing.dir === -1 && input_streams[1].get_index(this.last_swing.index) - this.last_swing.value >= params.diff_thres) {
                output_stream.set(-1);
            }
        }
    }
});
