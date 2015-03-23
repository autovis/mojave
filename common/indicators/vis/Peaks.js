define([], function() {

    return  {
        param_names: [],

        input: ['peak'],

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0));
        },

        // VISUAL #################################################################

        vis_render_fields: ['high', 'low'],

        vis_init: function(d3, vis, options) {
        },

        vis_render: function(d3, vis, options, cont) {
            options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);
        },

        //vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {

            var highs = vis.data.filter(function(i) {return i.value.high !== null});
            var lows = vis.data.filter(function(i) {return i.value.low !== null});

            var first_idx = _.first(vis.data).key;

            // High dots
            var high_dot = cont.selectAll("circle.high_dot")
                .data(highs, function(d) {return d.key})
                //.select(function(d) {return d.value.high !== null || d.value.low !== null})
                .attr("cx", function(d) {return (d.key-first_idx)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("cy", function(d) {return vis.y_scale(d.value.high) - 10})
                .attr("r", 3)
                .style("stroke", "green")
                .style("fill", "green")
            high_dot.enter().append("circle")
                .attr("class", "high_dot")

            high_dot.exit().remove()

            // Low dots
            var low_dot = cont.selectAll("circle.low_dot")
                .data(lows, function(d) {return d.key})
                //.select(function(d) {return d.value.high !== null || d.value.low !== null})
                .attr("cx", function(d) {return (d.key-first_idx)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("cy", function(d) {return vis.y_scale(d.value.low) + 10})
                .attr("r", 3)
                .style("stroke", "red")
                .style("fill", "red")
            low_dot.enter().append("circle")
                .attr("class", "low_dot")

            low_dot.exit().remove()

        }

    }
})