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
            if (!this.anchor.instrument) throw new Error('First input must have an instrument defined');
            this.instrument = this.anchor.instrument;
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
            var self = this;
            var sel = _.find(vis.selections, sel => sel.id === self.config.id);
            if (sel) {
                self.sel_data = _.filter(sel.data, sd => sd.instrument === self.instrument.id);
                self.sel_data = _.fromPairs(_.map(sel.data, sd => [sd.date, sd]));
            } else {
                self.sel_data = {};
            }
        },

        vis_render: function(d3, vis, options, cont) {
            var self = this;

            cont.selectAll('*').remove();

            this.cont = cont;
            this.dialog = null;
            this.selected_bar = null;

            _.each(vis.data, d => {
                var sel = self.sel_data[d.value.date];
                if (sel) d.value.tags = sel.tags;
            });

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options]);
        },

        vis_update: function vis_update(d3, vis, options, cont) {
            var self = this;

            var first_idx = _.head(vis.data).key;

            // selection bars
            var bar = self.cont.selectAll('rect.sel')
              .data(vis.data, d => d.key)
                .attr('x', d => (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding));
            bar.enter().append('rect')
              .filter(d => !!d.value.base)
                .classed({sel: true})
                //.attr('transform', 'translate(-0.5,-0.5)')
                .attr('x', d => (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - 0.5)
                .attr('y', 0)
                .attr('width', d => vis.chart.setup.bar_width + 1.0)
                .attr('height', vis.height)
                .style('fill', self.config.color)
                .on('mousemove', () => vis.updateCursor())
                .on('click', function(d) {
                    // save and close existing dialog if open
                    if (self.dialog) self.dialog.close();
                    var chart_svg = vis.chart.chart;
                    self.selected_bar = d3.select(this);
                    self.selected_bar.style('fill-opacity', 0.0);
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
                    var sel_config;
                    var save_callback = function(tag_values) {
                        var payload = {
                            date: d.value.date,
                            inputs: d.value.inputs,
                            tags: tag_values
                        };
                        d.value.tags = tag_values;
                        vis.destroy();
                        vis.render();
                        self.dpclient.send(sel_config, payload);
                    };
                    var close_callback = function() {
                        chart_svg.selectAll('.sel-bar').remove();
                        if (self.selected_bar) self.selected_bar.style('fill-opacity', null);
                        chart_svg.on('click', null);
                    };
                    sel_config = {
                        id: self.config.id,
                        instrument: self.instrument.id,
                        color: self.config.color,
                        source: 'selection/' + self.config.id,
                        inputs: self.config.inputs,
                        tags: self.config.tags,
                        container: container,
                        x_pos: container.offsetLeft + (vis.margin.left + vis.x) + (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width / 2,
                        y_pos: vis.y + vis.margin.top + d3.mouse(this)[1],
                        x_dist: 30,
                        kb_listener: vis.chart.kb_listener,
                        save_callback: save_callback,
                        close_callback: close_callback
                    };
                    self.dialog = new uitools.SelectionDialog(sel_config);
                    self.dialog.set_tag_values(d.value.tags || {});
                    vis.chart.selection_dialog = true;
                    self.dialog.render();
                    chart_svg.on('click', function handler() {
                        self.dialog.close();
                        if (self.selected_bar) {
                            self.selected_bar.style('fill-opacity', null);
                            delete self.selected_bar;
                        }
                    });
                    d3.event.stopPropagation();
                });
            bar.exit().remove();

            // "is tagged" bookmarks
            var bmark_len = 30;
            var tag_bmrk = self.cont.selectAll('path.tag-bmrk')
              .data(vis.data, d => d.key)
                .attr('transform', d => 'translate(' + ((d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding)) + ',0)');
            tag_bmrk.enter().append('path')
              .filter(d => d.value.base && !_.isEmpty(d.value.tags))
                .attr('transform', d => 'translate(' + ((d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding)) + ',0)rotate(0)')
                .attr('class', 'tag-bmrk')
                .attr('d', 'M0,0H' + vis.chart.setup.bar_width + 'V' + bmark_len + 'L' + (vis.chart.setup.bar_width / 2) + ',' + (bmark_len - 10) + 'L0,' + bmark_len + 'Z')
                .style('fill', d => self.config.color)
                .style('stroke', d => d3.rgb(self.config.color).brighter().toString())
                .style('stroke-width', 1.0)
                .style('pointer-events', 'none')
                .style('opacity', 0.8);
            tag_bmrk.exit().remove();
        }

    };
});
