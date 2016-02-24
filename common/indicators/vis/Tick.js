'use strict';

define([], function() {

    return  {
        param_names: [],

        input: 'tick',

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0));
        },

        // VISUAL #################################################################

        vis_subfields: ['ask', 'bid'],

        vis_init: function(d3, vis, options) {

            var ind = this;

            ind.ask_line = d3.svg.line()
                .x((d, i) => Math.round(i * vis.x_factor + vis.chart.setup.bar_width / 2))
                .y(d => vis.y_scale(d.value.ask));

            ind.bid_line = d3.svg.line()
                .x((d, i) => Math.round(i * vis.x_factor + vis.chart.setup.bar_width / 2))
                .y(d => vis.y_scale(d.value.bid));
        },

        vis_render: function(d3, vis, options, cont) {

            var ind = this;

            cont.append('path')
                .datum(vis.data)
                .attr('class', 'ask')
                .attr('fill', 'none')
                .attr('stroke', options.color || 'green')
                .attr('stroke-width', options.width || 2)
                .attr('stroke-opacity', options.opacity || 1.0)
                .attr('stroke-dasharray', options.dasharray || 'none')
                .attr('d', ind.ask_line);

            cont.append('path')
                .datum(vis.data)
                .attr('class', 'bid')
                .attr('fill', 'none')
                .attr('stroke', options.color || 'red')
                .attr('stroke-width', options.width || 2)
                .attr('stroke-opacity', options.opacity || 1.0)
                .attr('stroke-dasharray', options.dasharray || 'none')
                .attr('d', ind.bid_line);
        },

        vis_update: function(d3, vis, options, cont) {
            this.vis_render.apply(this, arguments, cont);
        },

    };
});
