'use strict';

define(['lodash'], function(_) {

    return {
        description: `Consolidates bars from multiple "trade_cmd" sources into a single output.
                      Only unique commands are propagated.`,

        param_names: [],
        //      anchor  trade commands
        input: ['_',    'trade_cmds+'],
        synch: ['a',    'b'],

        output: 'trade_cmds',

        initialize() {
            // filter on items that haven't been seen in 'n' unique instances
            var seen_items = Array(20), seen_idx = 0;
            this.is_first_seen = function(item) {
                if (seen_items.indexOf(item) > -1) return false;
                seen_items[seen_idx % seen_items.length] = item;
                seen_idx += 1;
                return true;
            };
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {
            let out = this.output.get() || [];
            this.output.set(out);
            if (src_idx === 0) return this.stop_propagation();
            var cmds = _.filter(this.inputs[src_idx].get(), cmd => this.is_first_seen(cmd)) || [];
            if (_.isEmpty(cmds)) {
                this.output.set(out.concat(cmds));
                this.stop_propagation();
            } else {
                this.output.set(out.concat(cmds));
            }
        }
    };
});
