'use strict';

define(['lodash', 'dataprovider'], function(_, dataprovider) {

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

            var first_idx = _.head(vis.data).key;

            var bar = this.cont.selectAll('rect.sel')
              .data(vis.data, d => d.key)
                .attr('x', d => (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding));
            bar.enter().append('rect')
              .filter(d => !!d.value.base)
                .attr('class', 'sel')
                .attr('transform', 'translate(0.5,0.5)')
                .attr('x', d => (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                .attr('y', 0)
                .attr('width', d => vis.chart.setup.bar_width)
                .attr('height', vis.height)
                .style('fill', this.config.color)
                .on('mousemove', () => vis.updateCursor())
                .on('click', d => {
                    var sel_config = {
                        id: this.config.id,
                        source: 'selection/' + this.config.id,
                        inputs: this.config.inputs,
                        tags: _.keys(this.config.tags)
                    };
                    var payload = {
                        date: d.value.date,
                        inputs: d.value.inputs,
                        tags: {}
                    };
                    console.log('payload', payload);
                    this.dpclient.send(sel_config, payload);
                });
            bar.exit().remove();

        }

    };
});
