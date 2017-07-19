'use strict';

define(['lodash'], function(_) {

    return  {
        param_names: [],

        input: ['num'],

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0));
        },

        /////////////////////////////////////////////////////////////////////////////////

        plot_init: function(d3, vis, options) {
        },

        plot_render: function(d3, vis, options, cont) {
            options._indicator.indicator.plot_update.apply(this, [d3, vis, options, cont]);
        },

        //plot_render_fields: [],

        plot_update: function(d3, vis, options, cont) {

            var first_idx = vis.data.length > 0 && _.head(vis.data).key || 0;

            var domain = vis.y_scale.domain();
            var filtered = vis.data.filter(d => !_.isNull(d.value) && !isNaN(d.value) && !_.isUndefined(d.value) && d.value >= domain[0] && d.value <= domain[1]);

            var dot = cont.selectAll('circle')
                .data(filtered)
                .attr('cx', d => (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + Math.floor((vis.chart.setup.bar_width) / 2));
            dot.enter().append('circle')
                .attr('class', 'dot')
                .attr('cy', d => vis.y_scale(_.isFinite(d.value) ? d.value : 0))
                .attr('cx', d => (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + Math.floor((vis.chart.setup.bar_width) / 2))
                .attr('r', 2)
                .style('stroke', 'white');

            dot.exit().remove();
        }

    };
});
