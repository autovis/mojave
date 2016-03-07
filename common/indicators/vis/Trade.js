'use strict';

define(['lodash', 'uitools', 'node-uuid'], function(_, uitools, uuid) {

    const LONG = 1, SHORT = -1, FLAT = 0;
    var triangle_marker_height = 4;

    return  {
        param_names: [],

        input: ['trade_evts'],
        output: [['events', 'trade_evts'], ['positions', 'trade_positions']],

        initialize: function(params, input_streams, output) {
            this.last_index = null;
            this.positions = [];

            // filter on items that haven't been seen in 'n' unique instances
            var seen_items = Array(20), seen_idx = 0;
            this.is_first_seen = function(item) {
                if (_.includes(seen_items, item)) return false;
                seen_items[seen_idx % seen_items.length] = item;
                seen_idx += 1;
                return true;
            };
        },

        on_bar_update: function(params, input_streams, output) {

            var self = this;
            var events = _.cloneDeep(input_streams[0].get());

            var pos;
            _.each(input_streams[0].get(), function(evt) {
                if (!self.is_first_seen(evt[1].evt_uuid)) return; // skip events already processed
                switch (_.head(evt)) {
                    case 'trade_start':
                        var pos = _.assign(_.clone(evt[1]), {
                            start_bar: input_streams[0].current_index()
                        });
                        self.positions.push(pos);
                        break;
                    case 'trade_end':
                        self.positions = _.reject(self.positions, p => p.pos_uuid === evt[1].pos_uuid, self);
                        break;
                    case 'stop_updated':
                        pos = _.find(self.positions, p => p.pos_uuid === evt[1].pos_uuid);
                        if (pos) pos.stop = evt[1].price;
                        break;
                    case 'limit_updated':
                        pos = _.find(self.positions, p => p.pos_uuid === evt[1].pos_uuid);
                        if (pos) pos.limit = evt[1].price;
                        break;
                    default:
                }
            });

            output.set({events: events, positions: _.cloneDeep(self.positions)});
        },

        // VISUAL #################################################################

        vis_init: function(d3, vis, options) {
            this.trades = null;
            this.trade_starts = [];
            this.trade_ends = [];
            this.last_index = null;
        },

        vis_render: function(d3, vis, options, cont) {
            var self = this;
            cont.selectAll('*').remove();

            var first_idx = vis.data.length > 0 && _.head(vis.data).key || 0;

            var stops = cont.append('g').classed({'trade-stop': true});
            var limits = cont.append('g').classed({'trade-limit': true});

            // Plot positions of stop and loss orders with each position
            _.each(vis.data, function(d) {
                _.each(d.value && d.value.positions, function(pos) {
                    if (pos.stop) {
                        if (pos.stop < vis.ymin || pos.stop > vis.ymax) return;
                        stops.append('g')
                            .attr('transform', 'translate(' + (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + ',' + vis.y_scale(pos.stop) + ')')
                          .append('path')
                            .classed({stop_marker: true})
                            .attr('d', 'M0,0' +
                                       'L' + d3.round(vis.chart.setup.bar_width, 2) + ',0' +
                                       'L' + d3.round(vis.chart.setup.bar_width / 2, 2) + ',' + d3.round(triangle_marker_height * -pos.direction, 2) +
                                       'Z')
                            .style('fill', 'rgba(240, 78, 44, 0.75)')
                            .style('stroke-width', 1);
                    }
                    if (pos.limit) {
                        if (pos.limit < vis.ymin || pos.limit > vis.ymax) return;
                        limits.append('g')
                            .attr('transform', 'translate(' + (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + ',' + vis.y_scale(pos.limit) + ')')
                          .append('path')
                            .classed({limit_marker: true})
                            .attr('d', 'M0,0' +
                                       'L' + d3.round(vis.chart.setup.bar_width, 2) + ',0' +
                                       'L' + d3.round(vis.chart.setup.bar_width / 2, 2) + ',' + d3.round(triangle_marker_height * pos.direction, 2) +
                                       'Z')
                            .style('fill', 'rgba(39, 172, 39, 0.75)')
                            .style('stroke-width', 1);
                    }
                });
            });

            // --------------------------------------------------------------------------

            self.trade_starts = [];
            _.each(vis.data, function(d) {
                _.each(d.value && d.value.events, function(evt) {
                    if (evt[0] === 'trade_start') {
                        self.trade_starts.push(_.assign(evt[1], {bar: d.key}));
                    }
                });
            });

            var starts = cont.append('g').classed({'trade-start': true});
            _.each(self.trade_starts, function(trade) {
                // Opening label
                var pin = new uitools.PinLabel({
                    container: starts,
                    color: 'rgb(111, 215, 221)',
                    side: 'left',
                    target_x: (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding),
                    target_y: vis.y_scale(trade.entry_price),
                    text: (trade.label || '') + (trade.direction === -1 ? '⬇' : '⬆'),
                    size: 12,
                    //opacity: vis.chart.config.selected_trade && vis.chart.config.selected_trade !== trade.pos_uuid ? 0.5 : 1.0
                    opacity: 1.0
                });
                pin.render();
                // Marker
                starts.append('line')
                    .classed({marker: true})
                    .attr('x1', (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                    .attr('x2', (trade.bar - first_idx + 1) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding)
                    .attr('y1', vis.y_scale(trade.entry_price))
                    .attr('y2', vis.y_scale(trade.entry_price))
                    .style('stroke-width', 3.0);
            });

            // --------------------------------------------------------------------------

            self.trade_ends = [];
            _.each(vis.data, function(d) {
                _.each(d.value && d.value.events, function(evt) {
                    if (evt[0] === 'trade_end') {
                        self.trade_ends.push(_.assign(_.clone(evt[1]), {bar: d.key}));
                    }
                });
            });

            var ends = cont.append('g').classed({'trade-end': true});
            _.each(self.trade_ends, function(trade) {
                // Closing label
                var pin = new uitools.PinLabel({
                    container: ends,
                    color: trade.pips > 0 ? 'rgb(13, 219, 13)' : 'rgb(216, 13, 13)',
                    side: 'right',
                    target_x: (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width,
                    target_y: vis.y_scale(trade.exit_price),
                    text: format_val(trade.pips),
                    size: 12,
                    //opacity: vis.chart.config.selected_trade && vis.chart.config.selected_trade !== trade.pos_uuid ? 0.5 : 1.0
                    opacity: 1.0
                });
                pin.render();
                // Marker
                ends.append('line')
                    .classed({marker: true})
                    .attr('x1', (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                    .attr('x2', (trade.bar - first_idx + 1) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding)
                    .attr('y1', vis.y_scale(trade.exit_price))
                    .attr('y2', vis.y_scale(trade.exit_price))
                    .style('stroke-width', 3.0);
                // Draw line connecting to trade_start, if exists on chart
                var start = _.find(self.trade_starts, function(ts) {
                    return ts.pos_uuid === trade.pos_uuid;
                });
                if (start) {
                    cont.insert('line', 'g')
                        .classed({labellink: true})
                        .attr('x1', (start.bar - first_idx + 1) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding)
                        .attr('y1', vis.y_scale(start.entry_price))
                        .attr('x2', (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                        .attr('y2', vis.y_scale(trade.exit_price))
                        .style('stroke-dasharray', '3,2')
                        .style('stroke-width', 1)
                        //.style('stroke-opacity', vis.chart.config.selected_trade && vis.chart.config.selected_trade !== trade.pos_uuid ? 0.5 : 1.0);
                        .style('stroke-opacity', 1.0);
                }
            });

        },

        vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {
            var self = this;
            if (self.current_index() !== self.last_index) {
                options._indicator.indicator.vis_render.apply(self, [d3, vis, options, cont]);
                self.last_index = self.current_index();
            }
        }

    };

    /////////////////////////////////////////////////////////////////////////////////////

    function format_val(val) {
        return val < 0 ? '(' + Math.abs(val).toString() + ')' : val.toString();
    }

});
