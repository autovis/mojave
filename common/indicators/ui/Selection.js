'use strict';

define(['lodash', 'dataprovider', 'uitools'], function(_, dataprovider, uitools) {

    return  {
        param_names: ['config'],

        input: ['dated', 'bool', '^a+'],
        output: [
            ['date', 'datetime'],
            ['base', 'bool'],
            ['inputs', 'array']
        ],

        initialize: function(params, input_streams, output) {
            if (!_.isObject(params.config)) throw new Error('"config" object param must be provided');
            this.config = params.config;
            this.anchor = input_streams[0];
            this.base = input_streams[1];
            this.inputs = input_streams.slice(2);
            this.dpclient = dataprovider.register(':selection:' + params.config.id);
        },

        on_bar_update: function(params, input_streams, output) {
            output.set({
                'date': this.anchor.get(0).date,
                'base': this.base.get(0),
                'inputs': _.map(this.inputs, inp => inp.get())
            });
        },

        // VISUAL #################################################################

        vis_render_fields: [],

        vis_init: function(d3, vis, options) {
        },

        vis_render: function(d3, vis, options, cont) {

            cont.selectAll('*').remove();

            this.cont = cont;

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options]);
        },

        vis_update: function(d3, vis, options, cont) {
            var self = this;

            var first_idx = _.head(vis.data).key;

            var bar = this.cont.selectAll('rect.sel')
              .data(vis.data, d => d.key)
                .attr('x', d => (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding));
            bar.enter().append('rect')
              .filter(d => !!d.value.base)
                .attr('class', 'sel')
                //.attr('transform', 'translate(-0.5,-0.5)')
                .attr('x', d => (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - 0.5)
                //.attr('x', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                .attr('y', 0)
                .attr('width', d => vis.chart.setup.bar_width + 1.0)
                .attr('height', vis.height)
                .style('fill', this.config.color)
                .on('mousemove', () => vis.updateCursor())
                .on('click', function(d) {
                    var chart_svg = vis.chart.chart;
                    chart_svg.selectAll('.sel-bar').remove();
                    // left vertical line
                    chart_svg.append('line')
                        .classed({'sel-bar': true})
                        .style('stroke', self.config.color)
                        .attr('x1', (vis.margin.left + vis.x) + (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding / 2)
                        .attr('y1', 0)
                        .attr('x2', (vis.margin.left + vis.x) + (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding / 2)
                        .attr('y2', vis.chart.height);
                    // right vertical line
                    chart_svg.append('line')
                        .classed({'sel-bar': true})
                        .style('stroke', self.config.color)
                        .attr('x1', (vis.margin.left + vis.x - 1.0) + (d.key - first_idx + 1) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding / 2 + 2.0)
                        .attr('y1', 0)
                        .attr('x2', (vis.margin.left + vis.x - 1.0) + (d.key - first_idx + 1) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding / 2 + 2.0)
                        .attr('y2', vis.chart.height);
                    var container = vis.chart.svg.node().parentNode;
                    var sel_config = {
                        id: self.config.id,
                        color: self.config.color,
                        source: 'selection/' + self.config.id,
                        inputs: self.config.inputs,
                        tags: _.keys(self.config.tags),
                        container: container,
                        x_pos: container.offsetLeft + (vis.margin.left + vis.x) + (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width / 2,
                        y_pos: vis.y + 30,
                        x_dist: 30
                    };
                    var payload = {
                        date: d.value.date,
                        inputs: d.value.inputs,
                        tags: {}
                    };
                    var dialog = new uitools.SelectionDialog(sel_config);
                    vis.chart.selection_dialog = true;
                    dialog.render();

                    console.log('payload', payload);
                    //self.dpclient.send(sel_config, payload);
                });
            bar.exit().remove();

        }

    };
});
