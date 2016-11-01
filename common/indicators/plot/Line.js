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

            this.line = d3.svg.line()
                .x((d, i) => Math.round(i * vis.x_factor + vis.chart.setup.bar_width / 2))
                // TODO: Remove isFinite()
                .y(d => vis.y_scale(_.isFinite(d.value) ? d.value : 0));
        },

        plot_render: function(d3, vis, options, cont) {

            cont.selectAll('*').remove();

            cont.append('path')
              .datum(vis.data)
                .attr('fill', 'none')
                .attr('stroke', options.color || 'cornflowerblue')
                .attr('stroke-width', options.width || 2)
                .attr('stroke-opacity', options.opacity || 1.0)
                .attr('stroke-dasharray', options.dasharray || 'none')
                .attr('d', this.line);

            options._indicator.indicator.plot_update.apply(this, [d3, vis, options, cont]);
        },

        //plot_render_fields: [],

        plot_update: function(d3, vis, options, cont) {
            cont.selectAll('path')
                //.datum(vis.data)
                .attr('d', this.line);
        }

    };
});
