'use strict';

define(['lodash'], function(_) {

    return {
        description: `Consolidates bars from multiple "trade_cmd" sources into a single output.
                      Only unique commands are propagated.`,

        param_names: [],
        //      trade commands
        input: ['trade_cmds', 'trade_cmds*'],
        synch: ['a', 'b*'],

        output: 'trade_cmds',

        initialize: function(params, input_streams, output_stream) {
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
            var self = this;
            var cmds = _.filter(input_streams[src_idx].get(), cmd => self.is_first_seen(cmd));
            if (_.isEmpty(cmds)) {
                self.stop_propagation();
                console.log(this.current_index() + ": cmd:Union -- src: " + src_idx + " (stop_propagation)");
            } else {
                var out = output_stream.get() || [];
                output_stream.set(_.concat(out, cmds));
                console.log(this.current_index() + ": cmd:Union -- src: " + src_idx + " (propagate)");
            }
        }
    };
});
