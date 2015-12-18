define(['lodash'], function(_) {

    return  {
        param_names: [],

        input: ['num'],

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0));
        },

        // VISUAL #################################################################

        vis_init: function(d3, vis, options) {

            this.line = d3.svg.line()
                .x(function(d,i) {return Math.round(i*vis.x_factor+vis.chart.setup.bar_width/2)})
                // TODO: Remove isFinite()
                .y(function(d) {return vis.y_scale(_.isFinite(d.value) ? d.value : 0)});
        },

        vis_render: function(d3, vis, options, cont) {

            cont.selectAll("*").remove();

            cont.append("path")
              .datum(vis.data)
                .attr("fill", "none")
                .attr("stroke", options.color || "cornflowerblue")
                .attr("stroke-width", options.width || 2)
                .attr("stroke-opacity", options.opacity || 1.0)
                .attr("stroke-dasharray", options.dasharray || "none")
                .attr("d", this.line);

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);
        },

        //vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {
            cont.selectAll("path")
                //.datum(vis.data)
                .attr("d", this.line);
        }

    }
})
