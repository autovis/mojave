'use strict';

define(['lodash', 'dataprovider', 'uitools'], function(_, dataprovider, uitools) {

    return  {
        param_names: ['config'],

        input: ['dated', '^a', '^b+'],
        output: [
            ['date', 'datetime'],
            ['base', 'bool'],
            ['inputs', 'array']
        ],

        initialize: function() {
            if (!_.isObject(this.param.config)) throw new Error('"config" object param must be provided');
            this.config = this.param.config;
            this.anchor = this.inputs[0];
            this.base = this.inputs[1];
            if (!_.includes(['bool', 'direction'], this.base.type)) throw new Error('"base" input stream must be of type bool or direction');
            if (!this.anchor.instrument) throw new Error('First input must have an instrument defined');
            this.instrument = this.anchor.instrument;
            this.dpclient = dataprovider.register(':selection:' + this.param.config.id);
        },

        on_bar_update: function() {
            this.output.set({
                'date': this.anchor.get(0).date,
                'base': this.base.get(0),
                'inputs': _.map(this.inputs.slice(2), inp => inp.get())
            });
        },

        // VISUAL #################################################################

        vis_render_fields: [],

        vis_init: function(d3, vis, options) {
            var self = this;
            var sel = _.find(vis.selections, sel => sel.id === self.config.id);
            if (sel) {
                self.sel_data = _.filter(sel.data, sd => sd.instrument === self.instrument.id);
                self.sel_data = _.fromPairs(_.map(self.sel_data, sd => [sd.date, sd]));
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
              .data(vis.data.filter(d => !!d.value.base), d => d.key)
                .attr('x', d => (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding));
            bar.enter().append('rect')
                .classed({sel: true})
                //.attr('transform', 'translate(-0.5,-0.5)')
                .attr('x', d => (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - 0.5)
                .attr('y', 0)
                .attr('width', d => vis.chart.setup.bar_width + 1.0)
                .attr('height', vis.height)
                .style('fill', d => (self.config.base ? d.value.base : !_.isEmpty(d.value.tags)) ? self.config.color : 'rgba(0,0,0,0.0)')
                .on('mousemove', () => vis.updateCursor())
                .on('click', function(d) {
                    // save and close existing dialog if open
                    if (self.dialog) self.dialog.close();
                    var chart_svg = vis.chart.chart;
                    self.selected_bar = d3.select(this);
                    self.selected_bar.style('fill-opacity', 0.0);
                    // dark veil
                    var veil_width = (vis.chart.margin.left + vis.chart.width + vis.chart.margin.right) - ((vis.margin.left + vis.x - 1.0) + (d.key - first_idx + 1) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding / 2 + 2.0);
                    chart_svg.append('rect')
                        .classed({'dark-veil': true})
                        .attr('x', (vis.margin.left + vis.x - 1.0) + (d.key - first_idx + 1) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding / 2 + 2.0)
                        .attr('y', 0)
                        .attr('width', veil_width)
                        .attr('height', vis.chart.height);
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
                        chart_svg.selectAll('.dark-veil').remove();
                        if (self.selected_bar) self.selected_bar.style('fill-opacity', null);
                        chart_svg.on('click', null);
                        vis.chart.kb_listener.unregister_combo('left');
                        vis.chart.kb_listener.unregister_combo('right');
                    };
                    sel_config = {
                        id: self.config.id,
                        instrument: self.instrument.id,
                        color: self.config.color,
                        source: 'selection/' + self.config.id,
                        inputs: self.config.inputs,
                        tags: self.config.tags,
                        container: container,
                        x_pos: (vis.margin.left + vis.x) + (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width / 2,
                        y_pos: d3.event.y_pos || vis.y + vis.margin.top + d3.mouse(this)[1],
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
                    vis.chart.kb_listener.simple_combo('left', () => {
                        var evt = new MouseEvent('click');
                        evt.y_pos = vis.y + vis.margin.top + vis.height / 2;
                        if (this.previousElementSibling) this.previousElementSibling.dispatchEvent(evt);
                    });
                    vis.chart.kb_listener.simple_combo('right', () => {
                        var evt = new MouseEvent('click');
                        evt.y_pos = vis.y + vis.margin.top + vis.height / 2;
                        if (this.nextElementSibling) this.nextElementSibling.dispatchEvent(evt);
                    });
                    d3.event.stopPropagation();
                });
            bar.exit().remove();

            // --------------------------------------------------------------------------
            // Bookmarks (visible when at least one tag is set)

            var bmark_len = 55;
            var tag_bmrk = self.cont.selectAll('path.tag-bmrk')
              .data(vis.data.filter(d => !_.isEmpty(d.value.tags)), d => d.key)
                .attr('transform', d => 'translate(' + ((d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding)) + ',0)');
            tag_bmrk.enter().append('path')
                .attr('transform', d => 'translate(' + ((d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding)) + ',0)')
                .attr('class', 'tag-bmrk')
                .attr('d', 'M0,0H' + vis.chart.setup.bar_width + 'V' + bmark_len + 'L' + (vis.chart.setup.bar_width / 2) + ',' + (bmark_len - 10) + 'L0,' + bmark_len + 'Z')
                .style('fill', d => self.config.color)
                .style('stroke', d => d3.rgb(self.config.color).brighter().toString())
                .style('stroke-width', 1.0)
                .style('pointer-events', 'none')
                .style('opacity', 0.8);
            tag_bmrk.exit().remove();

            // --------------------------------------------------------------------------
            // Bookmark Decorators

            var decor_pos = 0;

            // "has notes" asterisk
            var asterisk = self.cont.selectAll('text.asterisk')
              .data(vis.data.filter(d => d.value.base && _.isObject(d.value.tags) && !_.isEmpty(d.value.tags.notes)), d => d.key)
                .attr('transform', d => 'translate(' + ((d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width / 2) + ',' + (decor_pos + 5) + ')');
            asterisk.enter().append('text')
                .classed({decor: 1, asterisk: 1})
                .attr('transform', d => 'translate(' + ((d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width / 2) + ',' + (decor_pos + 5) + ')')
                .style('fill', 'red')
                .text('*');
            asterisk.exit().remove();
            decor_pos += 10;

            // direction arrow
            var dir_arrow = self.cont.selectAll('text.dir_arrow')
              .data(vis.data.filter(d => d.value.base && _.isObject(d.value.tags) && (d.value.tags.dir === 1 || d.value.tags.dir === -1)), d => d.key)
                .attr('transform', d => 'translate(' + ((d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width / 2) + ',' + (decor_pos + 5) + ')');
            dir_arrow.enter().append('text')
                .classed({decor: 1, dir_arrow: 1})
                .attr('transform', d => 'translate(' + ((d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width / 2) + ',' + (decor_pos + 5) + ')')
                .text(d => d.value.tags.dir === 1 ? '▲' : '▼')
                .style('font-size', 13)
                .style('fill', d => d.value.tags.dir === 1 ? 'green' : 'red');
            dir_arrow.exit().remove();
            decor_pos += 15;

            // strategy label
            var strat_label = self.cont.selectAll('text.strat_label')
              .data(vis.data.filter(d => d.value.base && _.isObject(d.value.tags) && !_.isEmpty(d.value.tags.strategy)), d => d.key)
                .attr('transform', d => 'translate(' + ((d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width / 2) + ',' + (decor_pos + 5) + ')');
            strat_label.enter().append('text')
                .classed({decor: 1, strat_label: 1})
                .attr('transform', d => 'translate(' + ((d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width / 2) + ',' + (decor_pos + 5) + ')')
                .text(d => d.value.tags.strategy)
                .style('font-size', 12)
                .style('fill', 'yellow');
            strat_label.exit().remove();
            decor_pos += 15;

        }

    };
});
