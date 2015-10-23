define([], function() {

    return  {
        param_names: [],

        input: 'num',
        output: 'num',

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0) || null);
        },

        // VISUAL #################################################################

        vis_render_fields: [],

        vis_init: function(d3, vis, options) {
        },

        vis_render: function(d3, vis, options, cont) {

            cont.selectAll("*").remove();

            this.cont = cont;

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options]);
        },

        vis_update: function(d3, vis, options, cont) {

            var bar = this.cont.selectAll("rect.cndl")
              .data(vis.data, function(d) {return d.key})
                .attr("x", function(d,i) {return i*(vis.chart.setup.bar_width+vis.chart.setup.bar_padding)})
                .attr("y", function(d) {return Math.round(vis.y_scale(d.value >= 0 ? d.value : 0))})
                .attr("height", function(d) {
                    return Math.max(0.1,Math.round(Math.abs(vis.y_scale(d.value)-vis.y_scale(0))))
                })
                .classed("fall", function(d) {return d.value < 0});
            bar.enter().append("rect")
                .attr("class", "cndl")
                .attr("x", function(d,i) {return i*(vis.chart.setup.bar_width+vis.chart.setup.bar_padding)})
                .attr("y", function(d) {return Math.round(vis.y_scale(d.value >= 0 ? d.value : 0))})
                .attr("width", function(d) {return vis.chart.setup.bar_width})
                .attr("height", function(d) {return Math.max(0.1,Math.round(Math.abs(vis.y_scale(d.value)-vis.y_scale(0))))})
                .classed("fall",function(d) {return d.value < 0})
                .on("mousemove", function() {vis.updateCursor()});
            bar.exit().remove();

        }

    }
})
