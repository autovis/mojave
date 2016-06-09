'use strict';

define(['lodash'], function(_) {

    return  {
        param_names: [],

        input: ['trendlines'],
        output: 'trendlines',

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0));
        },

        // VISUAL #################################################################

        vis_init: function(d3, vis, options) {
            /*
            this.line = d3.svg.line()
                .x((d, i) => Math.round(i * vis.x_factor + vis.chart.setup.bar_width / 2))
                // TODO: Remove isFinite()
                .y(d => vis.y_scale(_.isFinite(d.value) ? d.value : 0));
            */
        },

        vis_render: function(d3, vis, options, cont) {

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);
        },

        vis_render_fields: null,

        vis_update: function(d3, vis, options, cont) {

            var first_idx = vis.data.length > 0 && _.head(vis.data).key || 0;

            cont.selectAll('*').remove();

            _.each(vis.data, d => {
                _.each(d && d.value, line => {
                    let start = Math.max(line.start, first_idx);
                    cont.append('path')
                        .datum([
                            [line.slope * start + line.yint, start],
                            [line.slope * d.key + line.yint, d.key]
                        ])
                        .attr('class', 'trendline')
                        .attr('fill', 'none')
                        .attr('stroke', '#fff')
                        .attr('stroke-dasharray', line.type.match(/^major/) ? 'none' : '4,4')
                        .attr('stroke-width', 1.0)
                        .attr('stroke-opacity', 0.4)
                        .attr('d', d3.svg.line()
                            .x(d => Math.round((d[1] - first_idx) * vis.x_factor + vis.chart.setup.bar_width / 2))
                            .y(d => vis.y_scale(_.isFinite(d[0]) ? d[0] : 0)));
                });
            });

        }

    };
});
