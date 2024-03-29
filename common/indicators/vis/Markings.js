'use strict';

define(['lodash'], function(_) {

    return  {
        param_names: [],

        input: ['markings'],
        output: 'markings',

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0));
        },

        // VISUAL #################################################################

        vis_init: function(d3, vis, options) {
            this.vis_last_index = -1;
        },

        vis_render: function(d3, vis, options, cont) {

            var first_idx = vis.data.length > 0 && _.head(vis.data).key || 0;

            cont.selectAll('*').remove();

            var lines = cont.append('g').attr('class', 'trend-lines');
            var ticks = cont.append('g').attr('class', 'bar-ticks');

            var domain = vis.y_scale.domain();

            _.each(vis.data, d => {
                _.each(d && d.value, line => {

                    let start = Math.max(line.start, first_idx);
                    let strong = Math.abs(line.pearson) > 0.97 && line.points.length > 2;

                    // plot trend lines
                    lines.append('path')
                        .datum([
                            [line.slope * start + line.yint, start],
                            [line.slope * d.key + line.yint, d.key]
                        ])
                        .classed({'trend-line': true, 'strong': strong})
                        .attr('fill', 'none')
                        .attr('stroke', strong ? 'yellow' : '#fff')
                        .attr('stroke-dasharray', _.includes(line.tags, 'major') ? 'none' : '2,4')
                        .attr('stroke-width', 1.0)
                        .attr('stroke-opacity', strong ? 0.1 : 0.05)
                        .attr('d', d3.svg.line()
                            .x(d => Math.round((d[1] - first_idx) * vis.x_factor + vis.chart.setup.bar_width / 2))
                            .y(d => vis.y_scale(d[0])));

                    // plot bar markers
                    var yval = line.slope * d.key + line.yint;
                    var yplot = vis.y_scale(yval);
                    if (yval >= domain[0] && yval <= domain[1]) {
                        let mark_height = strong ? 1.5 : 0.75;
                        ticks.append('path')
                            .datum([
                                [yplot - mark_height, d.key],
                                [yplot + mark_height, d.key]
                            ])
                            .classed({'bar-tick': true, 'strong': strong})
                            .attr('fill', 'none')
                            .attr('stroke', strong ? 'red' : '#fff')
                            .attr('stroke-width', _.includes(line.tags, 'major') ? vis.chart.setup.bar_width : vis.chart.setup.bar_width / 3)
                            .attr('d', d3.svg.line()
                                .x(d => Math.round((d[1] - first_idx) * vis.x_factor + vis.chart.setup.bar_width / 2))
                                .y(d => d[0]));
                    }

                });
            });
        },

        vis_render_fields: null,

        vis_update: function(d3, vis, options, cont) {

            if (this.index === this.vis_last_index) return;
            this.vis_last_index = this.index;

            options._indicator.indicator.vis_render.apply(this, [d3, vis, options, cont]);
        }

    };
});
