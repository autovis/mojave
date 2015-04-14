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

            var dot = cont.selectAll("circle.dot")
              .data(vis.data, function(d) {return d.key})
                .attr("cx", function(d) {return (d.key-first_idx)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("cy", function(d) {return d.value.trade_start ? vis.y_scale(d.value.trade_start.price.ask) : vis.y_scale(d.value.trade_start.price.bid)});
            dot.enter().append("circle")
              .filter(function(d) {return _.has(d.value, 'trade_start') || _.has(d.value, 'trade_end')})
                .attr("class", "dot")
                .attr("cx", function(d) {return (d.key-first_idx)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("cy", function(d) {return d.value.trade_start ? vis.y_scale(d.value.trade_start.price.ask) : vis.y_scale(d.value.trade_start.price.bid)})
                .attr("r", 10)
                .style("fill", function(d) {
                    if (_.has(d.value, 'trade_start')) {
                        return d.value.trade_start.direction == 1 ? "green" : "red";
                    } else if (_.has(d.value, 'trade_end')) {
                        return "grey";
                    }
                });
            dot.exit().remove();
        }

    }
})
