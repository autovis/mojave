'use strict';

define(['lodash'], function(_) {

    return {

        param_names: [],

        input: 'pivot',
        output: 'pivot',

        initialize: function(params, input_streams, output) {
            this.input = input_streams[0];
            this.last_index = -1;
            this.current_bar = null;
        },

        on_bar_update: function(params, input_streams, output) {
            if (this.last_index !== this.input.current_index() && _.isObject(this.input.get(1))) {
                /*
                this.current_bar = {
                    p: this.input.get(1).p,
                    s1: this.input.get(1).s1,
                    s2: this.input.get(1).s2,
                    s3: this.input.get(1).s3,
                    s3: this.input.get(1).s4,
                    r1: this.input.get(1).r1,
                    r2: this.input.get(1).r2,
                    r3: this.input.get(1).r3,
                    r3: this.input.get(1).r4
                };
                */
                this.current_bar = this.input.get(1);
                this.last_index = this.input.current_index();
            }
            if (this.current_bar) output.set(this.current_bar);
        },

        /////////////////////////////////////////////////////////////////////////////////

        plot_render_fields: [],

        plot_init: function(d3, vis, options) {
            this.last_bar = null;
            this.lines = ['p', 's1', 's2', 's3', 's4', 'r1', 'r2', 'r3', 'r4'];
        },

        plot_render: function(d3, vis, options, cont) {

            options._indicator.indicator.plot_update.apply(this, [d3, vis, options, cont]);
        },

        plot_update: function(d3, vis, options, cont) {

            var ind = this;
            cont.selectAll('*').remove();

            var last_bar = _.fromPairs(_.map(ind.lines, function(line) {return [line, null]}));
            var current_bar = _.clone(last_bar);

            _.each(vis.data, function(datum, idx) {
                var newlast = false;
                _.each(ind.lines, function(line) {
                    if (last_bar[line] === null && datum.value[line] !== null) {
                        last_bar[line] = datum.value[line];
                        newlast = true;
                    } else if (datum.value[line] !== last_bar[line]) {
                        if (last_bar[line] >= vis.ymin && last_bar[line] <= vis.ymax) {
                            plot_pivot(line, idx);
                        }
                        last_bar[line] = datum.value[line];
                        newlast = true;
                    }
                });
                if (newlast) last_bar.x1 = idx * vis.chart.x_factor;
            });

            _.each(ind.lines, function(line) {
                if (last_bar[line] !== null && last_bar[line] >= vis.ymin && last_bar[line] <= vis.ymax) {
                    plot_pivot(line, vis.data.length);
                }
            });

            function plot_pivot(line, last_idx) {
                cont.append('line')
                    .attr('x1', last_bar.x1 - Math.floor(vis.chart.setup.bar_padding / 2) - 0.5)
                    .attr('y1', Math.round(vis.y_scale(last_bar[line])))
                    .attr('x2', last_idx * vis.chart.x_factor - Math.floor(vis.chart.setup.bar_padding / 2) - 0.5)
                    .attr('y2', Math.round(vis.y_scale(last_bar[line])))
                    .style('stroke-dasharray', '8,6,4,6')
                    .style('stroke-width', options.width || 2)
                    .style('stroke-opacity', options.opacity || 1.0)
                    .style('stroke', line === 'p' ? 'rgb(56, 56, 238)' : 'red');

                // left side label
                cont.append('text')
                    .attr('x', last_bar.x1 - Math.floor(vis.chart.setup.bar_padding / 2) + 5)
                    .attr('y', Math.round(vis.y_scale(last_bar[line])) - 3.0)
                    .style('fill', line === 'p' ? 'rgb(56, 56, 238)' : 'red')
                    .text(line.toUpperCase());

                // right side label
                cont.append('text')
                    .attr('x', last_idx * vis.chart.x_factor - Math.floor(vis.chart.setup.bar_padding / 2) - 18.5)
                    .attr('y', Math.round(vis.y_scale(last_bar[line])) - 3.0)
                    .style('fill', line === 'p' ? 'rgb(56, 56, 238)' : 'red')
                    .text(line.toUpperCase());
            }

        } // plot_update

    };

});
