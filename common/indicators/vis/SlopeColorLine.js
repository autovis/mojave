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

        // VISUAL #################################################################

        vis_init: function(d3, vis, options) {

            var ind = this;

            if (!_.isArray(options.colorscale)) options.colorscale = ['#CC1B00', '#8F8F79', '#027F00'];
            if (_.isNumber(options.threshold)) {
                ind.color_scale = d3.scale.linear()
                    .domain([-options.threshold, 0, options.threshold])
                    .range(options.colorscale)
                    .clamp(true);
            } else {
                ind.color_scale = val => val >= 0 ? _.last(options.colorscale) : _.first(options.colorscale);
            }

            // TODO: Remove isFinite()
            ind.line = d3.svg.line()
                .x((d, i) => Math.round(i * vis.x_factor + vis.chart.setup.bar_width / 2))
                .y(d => vis.y_scale(_.isFinite(d.value) ? d.value : 0));

            ind.add_stop = function(perc, color, id) {
                ind.gradient.append('stop')
                    .attr('offset', perc.toFixed(3) + '%')
                    .attr('stop-color', color)
                    .attr('id', id);
            };
        },

        vis_render: function(d3, vis, options, cont) {

            var ind = this;

            vis.chart.defs.select('linearGradient#' + options.id + '-gradient').remove();

            cont.selectAll('*').remove();

            cont.append('path')
              .datum(vis.data)
                .attr('stroke', 'url(#' + options.id + '-gradient)')
                .attr('stroke-width', options.width || 2)
                .attr('stroke-opacity', options.opacity || 1.0)
                .attr('stroke-dasharray', options.dasharray || 'none')
                .attr('fill', 'none')
                .attr('d', ind.line);

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);

        },

        vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {

            var ind = this;

            if (vis.data.length < 2) {

                return;
            }

            vis.chart.defs.selectAll('#' + options.id + '-gradient').remove();

            ind.gradient = vis.chart.defs.append('linearGradient')
                .attr('id', options.id + '-gradient');

            var curr_color = null, last_color = ind.color_scale(vis.data[1].value - vis.data[0].value);
            var curr_perc = null, last_perc = 0;
            for (var i = 0; i <= vis.data.length - 2; i++) {
                curr_color = ind.color_scale(vis.data[i + 1].value - vis.data[i].value);
                curr_perc = ((i + 1) / (vis.data.length - 1)) * 100;
                if (curr_color !== last_color) {
                    ind.add_stop(last_perc, last_color, i);
                    ind.add_stop(curr_perc, curr_color, i);
                }
                last_color = curr_color;
                last_perc = curr_perc;
            }
            ind.add_stop(100, ind.color_scale(vis.data[vis.data.length - 1].value - vis.data[vis.data.length - 2].value));

            cont.selectAll('path')
                .attr('d', ind.line);

        }

    };
});
