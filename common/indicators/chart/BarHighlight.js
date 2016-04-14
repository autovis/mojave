'use strict';

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

            cont.selectAll('*').remove();

            this.cont = cont;

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options]);
        },

        vis_update: function(d3, vis, options, cont) {

            var bar = cont.selectAll('rect.highlight')
              .data(vis.data.filter(d => d.value && true), d => d.key)
                .attr('x', (d, i) => i * (vis.config.bar_width + vis.config.bar_padding))
                .attr('y', vis.margin.top)
                .attr('height', vis.height);
            bar.enter().append('rect')
                .attr('class', 'highlight')
                .attr('x', (d, i) => i * (vis.config.bar_width + vis.config.bar_padding))
                .attr('y', vis.margin.top)
                .attr('width', d => vis.config.bar_width)
                .attr('height', vis.height);
            bar.exit().remove();

        }

    };
});
