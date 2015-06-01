'use strict';

requirejs(['lodash', 'jquery', 'jquery-ui', 'dataprovider', 'async', 'moment', 'd3', 'simple-statistics', 'stream', 'collection_factory', 'charting/equity_chart'], function(_, $, jqueryUI, dataprovider, async, moment, d3, ss, Stream, CollectionFactory, EquityChart) {

    var config = {
        datapath: ['oanda', 'eurusd', 'm5', 100],
        collection: '2015.03.MACD_OBV',

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


    var stream;
    var stat = {};           // holds each result stat
    var equity_data;         // array of values to use for equity chart
    var backtest_stats;
    var trades_tbody;

    async.series([

        // ----------------------------------------------------------------------------------
        // Init

        function(cb) {
            stream = {};
            equity_data = [];
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
                        size: 400,
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

                if (!collection.indicators['trade_events']) return cb("No 'trade_events' indicadtor defined in collection");
                var trade_stream = collection.indicators['trade_events'].output_stream;
                //var anchor_stream = collection.indicators['src'].output_stream;

                trade_stream.on('update', function(args) {

                    var events = trade_stream.get();

                    _.each(events, function(evt) {
                        if (evt[0] === 'trade_end') {
                            // append new row of trade stats to backtest table
                            trades_tbody.data('insert_trade')(evt[1]);
                            // add trade data to equity chart data
                            equity_data.push(evt[1] && evt[1].pips && evt[1].units && evt[1].pips * evt[1].units);
                        }
                    });

                });

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
        // Render stats table and equity chart

        function(cb) {

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

            // calculate stats
            stat.expectancy = equity_data.reduce(function(memo, val) {return memo + val;}, 0) / equity_data.length;
            stat.stdev = ss.standard_deviation(equity_data);

            // title
            $('#bt-stats').prepend($('<div>').addClass('title').text('Backtest Results'))

            // Create stats table
            $('#bt-stats').append(render_stats_table());

            // Plot equity chart
            var equity = new EquityChart({
                tradenum: equity_data.length
            }, document.getElementById('stats-table'));
            equity.data = _.compact(equity_data);
            console.log(equity.data);
            equity.init();
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
            return val < 0 ? '(' + Math.abs(val) + ')' : val;
        } else {
            return val;
        }
    }

    function render_stats_table() {
        var table = $('<table>').addClass('result').addClass('keyval');
        var tbody = $('<tbody>');
        _.each(stat, function(value, name) {
            var th = $('<th>').addClass('key').text(name);
            var td = $('<td>').addClass('value').text(render_value(value));
            tbody.append($('<tr>').append(th).append(td));
        });
        table.append(tbody);
        return table;
    }


}); // requirejs
