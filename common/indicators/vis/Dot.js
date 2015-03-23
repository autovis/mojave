define([], function() {

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
        },

        vis_render: function(d3, vis, options, cont) {
            options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);
        },

        //vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {

            var filtered = vis.data.filter(function(i) {return i !== null && i !== NaN && i !== undefined});

            var dot = cont.selectAll("circle")
                .data(filtered)
                .attr("cy", function(d) {return vis.y_scale(_.isFinite(d.value) ? d.value : 0)})
            dot.enter().append("circle")
                .attr("class", "dot")

            dot.exit().remove()
        }

    }
})