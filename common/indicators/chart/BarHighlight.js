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

        vis_init: function(d3, vis, options) {
        },

        vis_render: function(d3, vis, options, cont) {

            cont.selectAll("*").remove();

            this.cont = cont;

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options]);
        },

        vis_update: function(d3, vis, options, cont) {

            var bar = cont.selectAll("rect.highlight")
              .data(vis.data, function(d) {return d.key})
                .attr("x", function(d,i) {return i * (vis.config.bar_width + vis.config.bar_padding)})
                .attr("y", vis.margin.top)
                .attr("height", vis.height)
            bar.enter().append("rect")
              .filter(function(d) {return d.value && true})
                .attr("class", "highlight")
                .attr("x", function(d,i) {return i * (vis.config.bar_width + vis.config.bar_padding)})
                .attr("y", vis.margin.top)
                .attr("width", function(d) {return vis.config.bar_width})
                .attr("height", vis.height)
            bar.exit().remove();

        }

    }
})