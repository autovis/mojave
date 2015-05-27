'use strict';

define(['lodash'], function(_) {

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

            console.log(vis.data);

            // Plot the segments of stop/limit movement during trades
            var segments = {};
            _.each(vis.data, function(dat) {
                _.each(dat.value && dat.value.positions, function(pos) {
                    if (!_.has(segments, pos.id)) segments[pos.id] = {};
                    segments[pos.id][dat.key] = pos;
                }, this);
            }, this);

            console.log('trade segments', segments);

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

            var starts = cont.selectAll("rect.trade_start")
              .data(this.trade_starts, function(d) {return d.id})
                .attr('x', function(d, i) {return (d.bar - first_idx) * (vis.chart.config.bar_width + vis.chart.config.bar_padding)})
                .attr('y', function(d) {return vis.y_scale(d.entry_price)})
                .attr('height', function(d) {return 2})
            starts.enter().append('rect')
                .classed({
                    trade_start: true,
                    long: function(d) {
                        return d.direction === LONG;
                    },
                    short: function(d) {
                        return d.direction === SHORT;
                    }
                })
                .attr('x', function(d, i) {return (d.bar - first_idx) * (vis.chart.config.bar_width + vis.chart.config.bar_padding)})
                .attr('y', function(d) {return vis.y_scale(d.entry_price)})
                .attr('width', function(d) {return vis.chart.config.bar_width})
                .attr('height', function(d) {return 2})
                .on("mousemove", function() {vis.updateCursor()});
            starts.exit().remove();

            // --------------------------------------------------------------------------

            this.trade_ends = [];
            _.each(vis.data, function(dat) {
                _.each(dat.value && dat.value.events, function(evt) {
                    if (evt[0] === 'trade_end') {
                        this.trade_ends.push(_.assign(evt[1], {bar: dat.key}));
                    }
                }, this);
            }, this);

            var ends = cont.selectAll("rect.trade_end")
              .data(this.trade_ends, function(d) {return d.id})
                .attr('x', function(d, i) {return (d.bar - first_idx) * (vis.chart.config.bar_width + vis.chart.config.bar_padding)})
                .attr('y', function(d) {return vis.y_scale(d.exit_price)})
                .attr('height', function(d) {return 2})
            ends.enter().append('rect')
                .classed({
                    trade_end: true
                })
                .attr('x', function(d, i) {return (d.bar - first_idx) * (vis.chart.config.bar_width + vis.chart.config.bar_padding)})
                .attr('y', function(d) {return vis.y_scale(d.exit_price)})
                .attr('width', function(d) {return vis.chart.config.bar_width})
                .attr('height', function(d) {return 2})
                .on("mousemove", function() {vis.updateCursor()});
            ends.exit().remove();

            //options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);
        },

        vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {

           // console.log("trade update");

        }

    };
});
