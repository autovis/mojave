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

            this.line = d3.svg.line()
                .x(function(d,i) {return Math.round(i*vis.x_factor+vis.chart.config.bar_width/2)})
                // TODO: Remove isFinite()
                .y(function(d) {return vis.y_scale(_.isFinite(d.value) ? d.value : 0)});
        },

        vis_render: function(d3, vis, options, cont) {

            cont.selectAll("*").remove();

            /*
            cont.append("path")
              .datum(vis.data)
                .attr("fill", "none")
                .attr("stroke", options.color || "cornflowerblue")
                .attr("stroke-width", options.width || 2)
                .attr("stroke-opacity", options.opacity || 1.0)
                .attr("stroke-dasharray", options.dasharray || "none")
                .attr("d", this.line);
            */

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);
        },

        vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {

            /*
            cont.selectAll("path")
                //.datum(vis.data)
                .attr("d", this.line);
            */
            var data_filtered = vis.data.filter(function(i) {return !_.isNull(i) && !isNaN(i) && !_.isUndefined(i)});

            var data_enter_exit = data_filtered.filter(function(i) {return _.has(i, 'enter_long') || _.has(i, 'enter_short') || _.has(i, 'exit')})

            var dot = cont.selectAll("circle")
                .data(data_enter_exit)
                .attr("cx", function(d,i) {return i*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("cy", function(d) {return vis.y_scale(_.isFinite(d.value) ? d.value : 0)})
            dot.enter().append("circle")
                .attr("class", "dot")
                .attr("cx", function(d,i) {return i*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("cy", function(d) {return vis.y_scale(_.isFinite(d.value) ? d.value : 0)})
                .attr("r", 10)
                .style("fill", function(d) {return (_.has(d, 'enter_long') || _.has('enter_short')) ? "green" : "red"});

            dot.exit().remove()
        }

    }
})
