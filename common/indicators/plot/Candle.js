'use strict';

define([], function() {

    return  {
        param_names: [],

        input: 'candle_bar',
        output: 'candle_bar',

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0));
        },

        /////////////////////////////////////////////////////////////////////////////////

        plot_render_fields: ['open', 'high', 'low', 'close'],

        plot_init: function(d3, vis, options) {
        },

        plot_render: function(d3, vis, options, cont) {

            this.wicks = cont.append('g').attr('class', 'wicks');
            this.candles = cont.append('g').attr('class', 'candles');

            options._indicator.indicator.plot_update.apply(this, [d3, vis, options]);
        },

        plot_update: function(d3, vis, options) {

            var wick = this.wicks.selectAll('line.wick')
              .data(vis.data, d => d.key)
                .attr('x1', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + Math.floor((vis.chart.setup.bar_width) / 2) + (options.wickoffset * vis.chart.setup.bar_width || 0))
                .attr('x2', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + Math.floor((vis.chart.setup.bar_width) / 2) + (options.wickoffset * vis.chart.setup.bar_width || 0))
                .attr('y1', d => vis.y_scale(d.value.low))
                .attr('y2', d => vis.y_scale(d.value.high))
                .classed('fall', d => d.value.open > d.value.close);
            wick.enter().append('line')
                .attr('class', 'wick')
                .attr('x1', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + Math.floor((vis.chart.setup.bar_width) / 2) + (options.wickoffset * vis.chart.setup.bar_width || 0))
                .attr('x2', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + Math.floor((vis.chart.setup.bar_width) / 2) + (options.wickoffset * vis.chart.setup.bar_width || 0))
                .attr('y1', d => vis.y_scale(d.value.low))
                .attr('y2', d => vis.y_scale(d.value.high))
                .style('stroke-dasharray', options.dasharray || undefined)
                .classed('fall', d => d.value.open > d.value.close)
                .on('mousemove', () => vis.updateCursor());
            wick.exit().remove();

            var candle = this.candles.selectAll('rect.cndl')
              .data(vis.data, d => d.key)
                .attr('x', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                .attr('y', d => vis.y_scale(Math.max(d.value.open, d.value.close)))
                .attr('height', d =>  Math.max(0.1, Math.abs(vis.y_scale(d.value.open) - vis.y_scale(d.value.close))))
                .classed('fall', d => d.value.open > d.value.close);
            candle.enter().append('rect')
                .attr('class', 'cndl')
                .attr('x', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                .attr('y', d => vis.y_scale(Math.max(d.value.open, d.value.close)))
                .attr('width', d => vis.chart.setup.bar_width)
                .attr('height', d => Math.max(0.1, Math.abs(vis.y_scale(d.value.open) - vis.y_scale(d.value.close))))
                .style('stroke-dasharray', options.dasharray || undefined)
                .style('fill-opacity', options.fillopacity || undefined)
                .classed('fall', d => d.value.open > d.value.close)
                .on('mousemove', () => vis.updateCursor());
            candle.exit().remove();

        }

    };
});
