'use strict';

define(['lodash', 'uitools'], function(_, uitools) {

    var LONG = 1, SHORT = -1, FLAT = 0;

    return  {
        param_names: [],

        input: ['trade_evts'],
        output: [['events', 'trade_evts'], ['positions', 'trade_positions']],

        initialize: function(params, input_streams, output) {
            this.last_index = null;
            this.positions = [];
        },

        on_bar_update: function(params, input_streams, output) {

            var events = _.cloneDeep(input_streams[0].get());

            _.each(input_streams[0].get(), function(evt) {
                switch (_.first(evt)) {
                    case 'trade_start':
                        this.positions.push({
                            id: evt[1].id,
                            date: evt[1].date,
                            direction: evt[1].direction,
                            units: evt[1].units,
                            entry_price: evt[1].entry_price,
                            stop: evt[1].stop,
                            limit: evt[1].limit
                        });
                        break;
                    case 'trade_end':
                        this.positions = _.reject(this.positions, function(pos) {
                            pos.id === evt[1].id;
                        }, this);
                        break;
                    case 'stop_updated':
                        var pos = _.find(this.positions, function(pos) {
                            return pos.id === evt[1].id;
                        });
                        if (pos) pos.stop = evt[1].price;
                        break;
                    case 'limit_updated':
                        var pos = _.find(this.positions, function(pos) {
                            return pos.id === evt[1].id;
                        });
                        if (pos) pos.limit = evt[1].price;
                        break;
                    default:
                }
            }, this);

            output.set({events: events, positions: _.cloneDeep(this.positions)});
        },

        // VISUAL #################################################################

        vis_init: function(d3, vis, options) {
            this.trades = null;
            this.trade_starts = [];
            this.trade_ends = [];
        },

        vis_render: function(d3, vis, options, cont) {
            cont.selectAll('*').remove();

            var first_idx = _.first(vis.data).key;

            // Plot the segments of stop/limit movement during trades
            var segments = {};
            _.each(vis.data, function(dat) {
                _.each(dat.value && dat.value.positions, function(pos) {
                    if (!_.has(segments, pos.id)) segments[pos.id] = {};
                    segments[pos.id][dat.key] = pos;
                }, this);
            }, this);

            _.each(segments, function(seg, id) {
            }, this);

            // --------------------------------------------------------------------------

            this.trade_starts = [];
            _.each(vis.data, function(dat) {
                _.each(dat.value && dat.value.events, function(evt) {
                    if (evt[0] === 'trade_start') {
                        this.trade_starts.push(_.assign(evt[1], {bar: dat.key}));
                    }
                }, this);
            }, this);

            var starts = cont.append('g').classed({'trade-start': true})
            _.each(this.trade_starts, function(trade) {
                starts.append('line')
                    .classed({marker: true})
                    .attr('x1', (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                    .attr('x2', (trade.bar - first_idx + 1) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding)
                    .attr('y1', vis.y_scale(trade.entry_price))
                    .attr('y2', vis.y_scale(trade.entry_price))
                    .style('stroke-width', 2)
                var pin = new uitools.PinLabel({
                    container: starts,
                    color: 'rgb(111, 215, 221)',
                    side: 'left',
                    target_x: (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding),
                    target_y: vis.y_scale(trade.entry_price),
                    text: (trade.direction === -1 ? '◢' : '◥'),
                    size: 12,
                    //opacity: vis.chart.config.selected_trade && vis.chart.config.selected_trade !== trade.id ? 0.5 : 1.0
                    opacity: 1.0
                });
                pin.render();
            }, this);

            // --------------------------------------------------------------------------

            this.trade_ends = [];
            _.each(vis.data, function(dat) {
                _.each(dat.value && dat.value.events, function(evt) {
                    if (evt[0] === 'trade_end') {
                        this.trade_ends.push(_.assign(evt[1], {bar: dat.key}));
                    }
                }, this);
            }, this);

            var ends = cont.append('g').classed({'trade-end': true})
            _.each(this.trade_ends, function(trade) {
                ends.append('line')
                    .classed({marker: true})
                    .attr('x1', (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                    .attr('x2', (trade.bar - first_idx + 1) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding)
                    .attr('y1', vis.y_scale(trade.exit_price))
                    .attr('y2', vis.y_scale(trade.exit_price))
                    .style('stroke-width', 2)
                var pin = new uitools.PinLabel({
                    container: ends,
                    color: trade.pips > 0 ? 'rgb(13, 219, 13)' : 'rgb(216, 13, 13)',
                    side: 'right',
                    target_x: (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_width,
                    target_y: vis.y_scale(trade.exit_price),
                    text: format_val(trade.pips),
                    size: 12,
                    //opacity: vis.chart.config.selected_trade && vis.chart.config.selected_trade !== trade.id ? 0.5 : 1.0
                    opacity: 1.0
                });
                pin.render();
                // Draw line connecting to trade_start
                var start = _.find(this.trade_starts, function(ts) {
                    return ts.id === trade.id;
                });
                if (start) {
                    cont.insert('line', 'g')
                        .attr('x1', (start.bar - first_idx + 1) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - vis.chart.setup.bar_padding)
                        .attr('y1', vis.y_scale(start.entry_price))
                        .attr('x2', (trade.bar - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
                        .attr('y2', vis.y_scale(trade.exit_price))
                        .style('stroke', '#000')
                        .style('stroke-dasharray', '3,2')
                        .style('stroke-width', 1)
                        //.style('stroke-opacity', vis.chart.config.selected_trade && vis.chart.config.selected_trade !== trade.id ? 0.5 : 1.0);
                        .style('stroke-opacity', 1.0);
                }
            }, this);

            function format_val(val) {
                return val < 0 ? '(' + Math.abs(val).toString() + ')' : val.toString();
            }

            //options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);
        },

        vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {

           // console.log("trade update");

        }

    };
});
