'use strict';

requirejs(['lodash', 'jquery', 'jquery-ui', 'dataprovider', 'async', 'moment', 'd3', 'simple-statistics', 'stream', 'collection_factory', 'charting/chart', 'charting/equity_chart'], function(_, $, jqueryUI, dataprovider, async, moment, d3, ss, Stream, CollectionFactory, Chart, EquityChart) {

    var config = {
        collection: '2015.03.MACD_OBV',
        chart_setup: '2015.03.MACD_OBV',

        source: 'oanda',
        instrument: 'eurusd',
        timeframe: 'm5',
        higher_timeframe: 'H1',
        history: 3000
    }

    var table_renderer = {
        instr: function(d) {
            return config.instrument.toUpperCase();
        },
        id: function(d) {
            return d.id;
        },
        date: function(d) {
            return moment(d.date).format('M/D HH:mm');
        },
        dir: function(d) {
            return d.direction === 1 ? '◢' : '◥';
        },
        pips: function(d) {
            return d.pips < 0 ? '(' + Math.abs(d.pips) + ')' : d.pips;
        },
        reason: function(d) {
            return d.reason;
        },
        lot: function(d) {
            return d.units;
        },
        pnl: function(d) {
            return d.pips * d.units;
        }
    };

    var chart;
    var stream;
    var trades = [];
    var stat = {};           // holds each result stat
    var indicator_data;      // array of objects with indicator outputs from collection
                             // {tf => [{ind_id => ind_value}]}
    var trades_tbody;        // `tbody` of trades table

    async.series([

        // ----------------------------------------------------------------------------------
        // Init

        function(cb) {
            stream = {};
            trades = [];
            stat = {};
            cb();
        },

        // ----------------------------------------------------------------------------------
        // Set up layout

        function(cb) {
            requirejs(['jquery-ui-layout-min'], function() {
                $('body').layout({
                    defaults: {
                        closable: true,
                        resizable: true,
                        slideable: true
                    },
                    north: {
                        closable: false,
                        resizable: false,
                        slidable: false,
                        size: 100
                    },
                    west: {
                        size: 375
                    },
                    east: {
                        size: 430,
                        initClosed: true
                    }
                });
                cb();
            });
        },

        // ----------------------------------------------------------------------------------
        // Apply CSS theme

        function(cb) {


            cb();
        },

        // ----------------------------------------------------------------------------------
        // Set up backtesting table

        function(cb) {

            var table = $('<table>').addClass('result').css('width', '100%');
            var thead = $('<thead>');
            var hdr_row = $('<tr>');
            _.each(_.keys(table_renderer), function(field) {
                hdr_row.append($('<th>').text(field));
            });
            table.append(thead.append(hdr_row));

            trades_tbody = $('<tbody>');
            trades_tbody.data('insert_trade', function(trade) {
                var trow = $('<tr>');
                _.each(table_renderer, function(renderer, field) {
                    var td = $('<td>');

                    switch (field) {
                        case 'date':
                            td.css('white-space', 'nowrap');
                            break;
                        case 'pips':
                            td.css('font-weight', 'bold');
                            td.css('font-family', 'monospace');
                            td.css('text-align', 'right');
                            if (trade.pips > 7) {
                                td.css('background', 'rgb(13, 206, 13)');
                            } else if (trade > 1) {
                                td.css('background', 'rgb(119, 247, 119)');
                            } else if (trade.pips < 7) {
                                td.css('background', 'rgb(236, 52, 26)');
                            } else if (trade.pips < -1) {
                                td.css('background', 'rgb(241, 137, 122)');
                            } else {
                                td.css('background', '#eee');
                            }
                            break;
                        default:
                    }
                    td.text(renderer(trade));
                    trow.append(td);
                });
                trades_tbody.append(trow);
            })
            table.append(trades_tbody);
            $('#bt-table').append(table);

            cb();
        },

        // ----------------------------------------------------------------------------------
        // Initialize collection

        function(cb) {

            stream.tick = new Stream(200, '<' + config.datasource + '>', {is_root: true, instrument: config.instrument, tf: 'T', type: 'object'});
            stream.ltf = new Stream(200, '<' + config.datasource + '>', {is_root: true, instrument: config.instrument, tf: config.timeframe, type: 'object'});
            stream.htf = new Stream(200, '<' + config.datasource + '>', {is_root: true, instrument: config.instrument, tf: config.higher_timeframe, type: 'object'});

            CollectionFactory.create(config.collection, [stream.tick, stream.ltf, stream.htf], config, function(err, collection) {
                if (err) return console(err);

                config.collection = collection;
                //var chart_tfs = _.uniq(_.map(chart.components, function(comp) {return comp.anchor && comp.anchor.output_stream.tf}))

                if (!collection.indicators['trade_events']) return cb("No 'trade_events' indicator is defined in collection");
                var trade_stream = collection.indicators['trade_events'].output_stream;
                //var anchor_stream = collection.indicators['src'].output_stream;

                trade_stream.on('update', function(args) {

                    var events = trade_stream.get();

                    _.each(events, function(evt) {
                        if (evt[0] === 'trade_end') {
                            // append new row of trade stats to backtest table
                            trades_tbody.data('insert_trade')(evt[1]);
                            $('#bt-table').scrollTop($('#bt-table').height());
                            // add trade data to equity chart data
                            trades.push(evt[1]);
                            //equity_data.push(evt[1] && evt[1].pips && evt[1].units && evt[1].pips * evt[1].units);
                        }
                    });

                });

                cb();
            });
        },

        // ----------------------------------------------------------------------------------
        // Set up chart

        function(cb) {

            chart = new Chart({
                setup: config.chart_setup,
                collection: config.collection,
                container: d3.select('#bt-chart')
            });

            chart.init(function(err) {
                if (err) return cb(err);
                chart.setup.maxsize = 50;
                chart.setup.barwidth = 4;
                chart.setup.barpadding = 2;
                cb();
            });
        },

        // ----------------------------------------------------------------------------------
        // Set up dataprovider connection and fetch data

        function(cb) {

            var client = dataprovider.register();
            var conn = client.connect('fetch', [config.source, config.instrument, config.timeframe, config.history]);
            var pkt_count = 0;

            // set up progress bar
            var progress_bar = $('<div>').progressbar({value: 0}).width('100%').height(15);
            $('#bt-head').append(progress_bar);

            conn.on('data', function(packet) {

                // insert new bar and fire update event on stream(s)
                stream.ltf.next();
                stream.ltf.set(packet.data);
                stream.ltf.emit('update', {timeframes: [config.timeframe]});

                // update progress bar
                progress_bar.progressbar({
                    value: Math.round(pkt_count * 100 / config.history)
                });

                pkt_count++;
            });

            conn.on('end', function() {
                cb();
            });

        },

        // ----------------------------------------------------------------------------------
        // Render chart, stats table and equity chart

        function(cb) {

            if (chart) chart.render();

            // calculate stats
            var equity_data = trades.map(function(trade) {
                return trade && trade.pips && trade.units && trade.pips * trade.units;
            });

            stat.expectancy = equity_data.reduce(function(memo, val) {
                return memo + val;
            }, 0) / equity_data.length;
            stat.stdev = ss.standard_deviation(equity_data);
            var wins = equity_data.filter(function(t) {return t > 0});
            var nonwins = equity_data.filter(function(t) {return t <= 0});
            stat['win:nonwin'] = wins.length / nonwins.length;
            stat['avg_win_pnl'] = wins.reduce(function(memo, t) {return memo + t}, 0) / wins.length;
            stat['avg_nonwin_pnl'] = nonwins.reduce(function(memo, t) {return memo + t}, 0) / nonwins.length;

            var daygrouped = _.groupBy(trades, function(trade) {
                return moment(trade.date).format('YYYY-MM-DD');
            });
            var day_trade_cnt = _.values(daygrouped).map(function(g) {return g.length});
            stat['avg_trades/day'] = day_trade_cnt.reduce(function(memo, t) {return memo + t}, 0) / day_trade_cnt.length;

            // Add END marker to trades table
            var trow = $('<tr>');
            var td = $('<td>')
                .css('text-align', 'center')
                .css('font-weight', 'bold')
                .css('color', 'white')
                .css('background', 'rgb(99, 113, 119)')
                .attr('colspan', _.keys(table_renderer).length)
                .html('&mdash;&nbsp;&nbsp;&nbsp;END&nbsp;&nbsp;&nbsp;&mdash;');
            trades_tbody.append(trow.append(td));
            $('#bt-table').scrollTop($('#bt-table').height());

            // title
            $('#bt-stats').prepend($('<div>').addClass('title').text('Backtest Results'))

            // Create stats table
            $('#bt-stats').append(render_stats_table());

            // Plot equity chart
            var equity = new EquityChart({
            }, document.getElementById('stats-table'));
            equity.data = _.compact(equity_data);
            equity.render();
            $('body').layout().open('east');

        }

    ], function(err) {
        if (err) console.error(err);
    });

    /////////////////////////////////////////////////////////////////////////////////////

    function render_value(val) {
        if (_.isNumber(val)) {
            val = Math.round(val * 100) / 100;
            return val < 0 ? '<span class="negval">(' + Math.abs(val) + ')</span>' : val;
        } else {
            return val;
        }
    }

    function render_stats_table() {
        var table = $('<table>').addClass('result').addClass('keyval');
        var tbody = $('<tbody>');
        _.each(stat, function(value, name) {
            var th = $('<th>').addClass('key').text(name).css('font-family', 'monospace');
            var td = $('<td>').addClass('value').html(render_value(value));
            tbody.append($('<tr>').append(th).append(td));
        });
        table.append(tbody);
        return table;
    }


}); // requirejs
