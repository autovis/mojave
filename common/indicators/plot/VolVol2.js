'use strict';

define(['lodash'], function(_) {

    return  {
        param_names: ['vol_thres', 'atr_thres', 'thres_dist'],

        input: ['num', 'num'],
        output: ['vol', 'atr'],

        initialize: function(params, input_streams, output) {
            if (!_.isObject(input_streams[1].instrument)) throw new Error("VolVol indicator's second input stream (ATR) must define an instrument");
            this.unit_size = input_streams[1].instrument.unit_size;
            this.vol_ma = this.indicator(['EMA', 3], this.inputs[0]);
        },

        on_bar_update: function(params, input_streams, output) {
            var adj_atr = input_streams[1].get(0) / this.unit_size;
            let vol = input_streams[0].get(0);
            this.vol_ma.update();
            output.set({
                vol: vol,
                vol_ma: this.vol_ma.get(),
                atr: _.isFinite(adj_atr) ? adj_atr : 0
            });
        },

        /////////////////////////////////////////////////////////////////////////////////

        plot_init: function(d3, vis, options) {
            var ind = this;

            ind.atr_line = d3.svg.line()
                .x((d, i) => Math.round(i * vis.x_factor + vis.chart.setup.bar_width / 2))
                .y(d => vis.height - ind.atr_scale(d.value.atr));

        },


        plot_render: function(d3, vis, options, cont) {
            var ind = this;

            ind.vol_scale = d3.scale.linear().domain([0, options.vol_thres]).range([0, options.thres_dist]);
            ind.atr_scale = d3.scale.linear().domain([0, options.atr_thres]).range([0, options.thres_dist]);

            cont.selectAll('*').remove();

            // vol/atr threshold line
            cont.append('line')
                .attr('class', 'volvol_thres')
                .attr('x1', -Math.floor(vis.chart.setup.bar_padding / 2) - 0.5)
                .attr('y1', d => Math.round(vis.height - options.thres_dist))
                .attr('x2', vis.width - Math.floor(vis.chart.setup.bar_padding / 2) - 0.5)
                .attr('y2', d => Math.round(vis.height - options.thres_dist));

            ind.atr_path = cont.append('g').attr('class', 'atr');
            ind.volumes = cont.append('g').attr('class', 'volume');

            ind.atr_path.append('path')
                .datum(vis.data)
                .attr('class', 'atr_plot')
                .attr('d', ind.atr_line);

            let high_perc = 0.20;
            let low_perc = 0.20;

            ind.volumes.selectAll('rect.vol')
              .data(vis.data)
                .enter().append('rect')
                .attr('class', 'vol')
                .attr('x', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                .attr('y', d => vis.height - Math.ceil(ind.vol_scale(d.value.vol)))
                .attr('width', d => vis.chart.setup.bar_width)
                .attr('height', d => Math.ceil(ind.vol_scale(d.value.vol)))
                .style('fill', d => {
                    if (d.value.vol - d.value.vol_ma > d.value.vol_ma * high_perc) {
                        return 'red';
                    } else if (d.value.vol_ma - d.value.vol > d.value.vol_ma * low_perc) {
                        return 'green';
                    } else {
                        return 'none';
                    }
                })
                .style('fill-opacity', d => {
                    if (Math.abs(d.value.vol - d.value.vol_ma) > d.value.vol_ma * high_perc) {
                        return 0.4;
                    } else {
                        return 'none';
                    }
                })
                .on('mousemove', () => vis.updateCursor());

            options._indicator.indicator.plot_update.apply(this, [d3, vis, options, cont]);

        },

        plot_render_fields: [],

        plot_update: function(d3, vis, options, cont) {
            var ind = this;

            cont.select('line.volvol_thres')
                .attr('x2', vis.width - Math.floor(vis.chart.setup.bar_padding / 2) - 0.5);

            var vol = ind.volumes.selectAll('rect.vol')
              .data(vis.data)
                .attr('x', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                .attr('y', d => vis.height - Math.ceil(ind.vol_scale(d.value.vol)))
                .attr('width', d => vis.chart.setup.bar_width)
                .attr('height', d => Math.ceil(ind.vol_scale(d.value.vol)));
            vol.enter().append('rect')
                .attr('class', 'vol')
                .attr('x', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                .attr('y', d => vis.height - Math.ceil(ind.vol_scale(d.value.vol)))
                .attr('width', d => vis.chart.setup.bar_width)
                .attr('height', d => Math.ceil(ind.vol_scale(d.value.vol)));
            vol.exit().remove();

            ind.atr_path.select('path.atr_plot')
                .attr('d', ind.atr_line);

        },

    };
});