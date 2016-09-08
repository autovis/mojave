'use strict';

define(['lodash', 'node-uuid', 'uitools'], function(_, uuid, uitools) {

    const LONG = 1, SHORT = -1, FLAT = 0;
    const TRIANGLE_MARKER_HEIGHT_FACTOR = 0.4;

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

            var events = _.cloneDeep(input_streams[0].get());

            if (this.current_index() !== this.last_index) {
                this.output_positions = _.cloneDeep(this.positions);
                this.last_index = this.current_index();
            }

            var pos;
            _.each(input_streams[0].get(), evt => {
                if (!this.is_first_seen(evt[1].evt_uuid)) return; // skip events already processed
                switch (_.head(evt)) {
                    case 'trade_start':
                        this.positions.push(_.assign(evt[1], {
                            entry_bar: output.index
                        }));
                        this.output_positions.push(_.cloneDeep(evt[1]));
                        break;
                    case 'trade_end':
                        this.positions = _.reject(this.positions, p => p.pos_uuid === evt[1].pos_uuid);
                        break;
                    case 'stop_updated':
                        pos = _.find(this.positions, p => p.pos_uuid === evt[1].pos_uuid);
                        if (pos) pos.stop = evt[1].price;
                        pos = _.find(this.output_positions, p => p.pos_uuid === evt[1].pos_uuid);
                        if (pos) pos.stop = evt[1].price;
                        break;
                    case 'limit_updated':
                        pos = _.find(this.positions, p => p.pos_uuid === evt[1].pos_uuid);
                        if (pos) pos.limit = evt[1].price;
                        pos = _.find(this.output_positions, p => p.pos_uuid === evt[1].pos_uuid);
                        if (pos) pos.limit = evt[1].price;
                        break;
                    default:
                }
            });

            output.set({events: events, positions: this.output_positions});
        },

        // VISUAL #################################################################

        vis_init: function(d3, vis, options) {
            this.trades = null;
            this.trade_starts = [];
            this.trade_ends = [];
            this.vis_last_index = null;
        },

        vis_render: function(d3, vis, options, cont) {
            cont.selectAll('*').remove();

            var first_idx = vis.data.length > 0 && _.head(vis.data).key || 0;

            var stops = cont.append('g').classed({'trade-stop': true});
            var limits = cont.append('g').classed({'trade-limit': true});

            // Plot positions of stop and loss orders with each position
            _.each(vis.data, d => {
                _.each(d.value && d.value.positions, pos => {
                    if (pos.stop) {
                        if (pos.stop < vis.ymin || pos.stop > vis.ymax) return;
                        stops.append('g')
                            .attr('transform', 'translate(' + (d.key - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + ',' + vis.y_scale(pos.stop) + ')')
                          .append('path')
                            .classed({stop_marker: true})
                            .attr('d', 'M0,0' +
                                       'L' + d3.round(vis.chart.setup.bar_width, 2) + ',0' +
                                       'L' + d3.round(vis.chart.setup.bar_width / 2, 2) + ',' + d3.round(vis.chart.setup.bar_width * TRIANGLE_MARKER_HEIGHT_FACTOR * -pos.direction, 2) +
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
                                       'L' + d3.round(vis.chart.setup.bar_width / 2, 2) + ',' + d3.round(vis.chart.setup.bar_width * TRIANGLE_MARKER_HEIGHT_FACTOR * pos.direction, 2) +
                                       'Z')
                            .style('fill', 'rgba(39, 172, 39, 0.75)')
                            .style('stroke-width', 1);
                    }
                });
            });

            // --------------------------------------------------------------------------

            this.trade_starts = [];
            _.each(vis.data, d => {
                _.each(d.value && d.value.events, evt => {
                    if (evt[0] === 'trade_start') {
                        this.trade_starts.push(_.assign(evt[1], {bar: d.key}));
                    }
                });
            });

            var starts = cont.append('g').classed({'trade-start': true});
            _.each(this.trade_starts, trade => {
                // Opening label
                var pin = new uitools.PinLabel({
                    container: starts,
                    color: 'rgb(111, 215, 221)',
                    side: 'left',
                    target_x: (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding),
                    target_y: vis.y_scale(trade.entry_price),
                    text: (trade.label || '') + (trade.direction === SHORT ? '▼' : '▲'),
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

            this.trade_ends = [];
            _.each(vis.data, d => {
                _.each(d.value && d.value.events, evt => {
                    if (evt[0] === 'trade_end') {
                        this.trade_ends.push(_.assign(_.clone(evt[1]), {bar: d.key}));
                    }
                });
            });

            var ends = cont.append('g').classed({'trade-end': true});
            _.each(this.trade_ends, trade => {
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
                var start = _.find(this.trade_starts, ts => {
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
            if (this.current_index() !== this.vis_last_index) {
                options._indicator.indicator.vis_render.apply(this, [d3, vis, options, cont]);
                this.vis_last_index = this.current_index();
            }
        }

    };

    /////////////////////////////////////////////////////////////////////////////////////

    function format_val(val) {
        return val < 0 ? '(' + Math.abs(val).toString() + ')' : val.toString();
    }

});
