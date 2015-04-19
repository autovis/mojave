define(['underscore'], function(_) {

    const LONG = 1, SHORT = -1, FLAT = 0;

    return  {
        param_names: [],

        input: ['trade'],
        output: ['trade'],

        initialize: function(params, input_streams, output) {

            this.position = FLAT;
            this.entry = null;

            this.stop = null;
            this.limit = null;
            this.lotsize = null;
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0));
        },

        // VISUAL #################################################################

        vis_init: function(d3, vis, options) {
        },

        vis_render: function(d3, vis, options, cont) {
            cont.selectAll("*").remove();
            options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);
        },

        vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {

            var first_idx = _.first(vis.data).key;

            // Entry
            var entry_dot = cont.selectAll("circle.dot.entry")
              .data(vis.data, function(d) {return d.key})
                .attr("cx", function(d) {return (d.key-first_idx)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("cy", function(d) {return vis.y_scale(d.value.trade_start.entry_price)});
            entry_dot.enter().append("circle")
              .filter(function(d) {return _.has(d.value, 'trade_start')})
                .classed({dot: true, entry: true})
                .attr("cx", function(d) {return (d.key-first_idx)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("cy", function(d) {return vis.y_scale(d.value.trade_start.entry_price)})
                .attr("r", 5)
                .style("fill", function(d) {
                    return d.value.trade_start.direction == 1 ? "rgb(9, 253, 9)" : "rgb(255, 0, 0)";
                });
            entry_dot.exit().remove();

            // Exit
            var exit_dot = cont.selectAll("circle.dot.exit")
              .data(vis.data, function(d) {return d.key})
                .attr("cx", function(d) {return (d.key-first_idx)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("cy", function(d) {return vis.y_scale(d.value.trade_end.exit_price)});
            exit_dot.enter().append("circle")
              .filter(function(d) {return _.has(d.value, 'trade_end')})
                .classed({dot: true, exit: true})
                .attr("cx", function(d) {return (d.key-first_idx)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("cy", function(d) {return vis.y_scale(d.value.trade_end.exit_price)})
                .attr("r", 5)
                .style("fill", function(d) {
                    switch (d.value.trade_end.reason) {
                        case 'exit':
                            return 'white';
                        case 'stop':
                            return 'rgb(215, 128, 31)';
                        case 'limit':
                            return 'rgb(21, 214, 249)';
                    }
                });
            exit_dot.exit().remove();
        }

    };
});
