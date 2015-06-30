'use strict';

requirejs(['lodash', 'jquery', 'jquery-ui', 'dataprovider', 'async', 'moment', 'd3', 'simple-statistics', 'spin', 'stream', 'collection_factory', 'charting/chart', 'charting/equity_graph'], function(_, $, jqueryUI, dataprovider, async, moment, d3, ss, Spinner, Stream, CollectionFactory, Chart, EquityGraph) {

    var config = {
        collection: '2015.03.MACD_OBV',
        chart_setup: '2015.03.MACD_OBV',

        source: 'oanda',
        instruments: 'eurusd,gbpusd,audusd,usdcad',
        timeframe: 'm5',
        higher_timeframe: 'H1',
        history: 3000
    }

    var table_renderer = {
        instr: function(d) {
            return d.instr.toUpperCase();
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
    var trades;
    var stat;                // holds each result stat
    var trades_tbody;        // `tbody` of trades table
    var spinner;             // spinning activity indicator

    var source = {};         // holds all state info/handlers relevant to each instrument
    var prices = {};         // stores prices for each instrument (used for rendering chart on trade select)

    async.series([

        // ----------------------------------------------------------------------------------
        // Init

        function(cb) {
            _.each(config.instruments.split(','), function(instr) {
                source[instr] = {
                    stream: {},
                    queue: []
                };
            });
            trades = [];
            stat = {};

            spinner = new Spinner({
              lines: 13, // The number of lines to draw
              length: 49, // The length of each line
              width: 7, // The line thickness
              radius: 84, // The radius of the inner circle
              scale: 1, // Scales overall size of the spinner
              corners: 0.8, // Corner roundness (0..1)
              color: '#000', // #rgb or #rrggbb or array of colors
              opacity: 0.1, // Opacity of the lines
              rotate: 0, // The rotation offset
              direction: 1, // 1: clockwise, -1: counterclockwise
              speed: 0.7, // Rounds per second
              trail: 43, // Afterglow percentage
              fps: 20, // Frames per second when using setTimeout() as a fallback for CSS
              zIndex: 2e9, // The z-index (defaults to 2000000000)
              className: 'spinner', // The CSS class to assign to the spinner
              top: '50%', // Top position relative to parent
              left: '50%', // Left position relative to parent
              shadow: false, // Whether to render a shadow
              hwaccel: false, // Whether to use hardware acceleration
              position: 'absolute' // Element positioning
            });

            cb();
        },

        // ----------------------------------------------------------------------------------
        // Set up jquery-ui-layout

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
            table.append(trades_tbody);
            $('#bt-table').append(table);

            cb();
        },

        // ----------------------------------------------------------------------------------
        // Initialize collection(s)

        function(cb) {

            var instruments = config.instruments.split(',');
            async.each(instruments, function(instr, cb) {

                var src = source[instr];

                src.stream.tick = new Stream(200, '<' + config.datasource + '>', {is_root: true, instrument: instr, tf: 'T', type: 'object'});
                src.stream.ltf = new Stream(200, '<' + config.datasource + '>', {is_root: true, instrument: instr, tf: config.timeframe, type: 'object'});
                src.stream.htf = new Stream(200, '<' + config.datasource + '>', {is_root: true, instrument: instr, tf: config.higher_timeframe, type: 'object'});

                CollectionFactory.create(config.collection, [src.stream.tick, src.stream.ltf, src.stream.htf], config, function(err, collection) {
                    if (err) return cb(err);

                    src.collection = collection;

                    if (!src.collection.indicators['trade_events']) return cb("No 'trade_events' indicator is defined in collection");
                    var trade_stream = src.collection.indicators['trade_events'].output_stream;

                    trade_stream.on('update', function(args) {

                        var trade_events = trade_stream.get();

                        _.each(trade_events, function(evt) {
                            if (evt[0] === 'trade_end') {
                                var trade = _.assign(evt[1], {instr: instr});
                                time_buffer_trade(trade);
                            }
                        });

                    });

                    cb();
                });

            }, cb);

        },

        // ----------------------------------------------------------------------------------
        // Create and initialize chart to show details on selecting a trade

        /*
        function(cb) {

            chart = new Chart({
                setup: config.chart_setup,
                collection: config.collection,
                container: d3.select('#bt-chart')
            });

            chart.init(function(err) {
                if (err) return cb(err);
                //var chart_tfs = _.uniq(_.map(chart.components, function(comp) {return comp.anchor && comp.anchor.output_stream.tf}))
                chart.setup.maxsize = 50;
                chart.setup.barwidth = 4;
                chart.setup.barpadding = 2;
                cb();
            });
        },
        */

        // ----------------------------------------------------------------------------------
        // Set up dataprovider connection and fetch data

        function(cb) {

            // set up progress bar
            var progress_bar = $('<div>').progressbar({value: 0}).width('100%').height(15);
            $('#bt-head').append(progress_bar);

            var client = dataprovider.register();
            var pkt_count = 0;
            var instruments = config.instruments.split(',');
            async.parallel(_.map(instruments, function(instr) {

                var src = source[instr];
                var conn = client.connect('fetch', [config.source, instr, config.timeframe, config.history]);

                prices[instr] = []; // collect prices to build chart on trade select

                return function(cb) {

                    conn.on('data', function(packet) {
                        // insert new bar and fire update event on stream(s)
                        src.stream.ltf.next();
                        src.stream.ltf.set(packet.data);
                        src.stream.ltf.emit('update', {timeframes: [config.timeframe]});
                        // update progress bar
                        progress_bar.progressbar({
                            value: Math.round(pkt_count * 100 / (config.history * instruments.length))
                        });
                        prices[instr].push(packet.data);
                        pkt_count++;
                    });

                    conn.on('end', function() {
                        cb();
                    });
                };
            }), cb);

        },

        // ----------------------------------------------------------------------------------
        // Render chart, stats table and equity graph

        function(cb) {

            flush_queues();
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
            $('#stats-table').append(render_stats_table());

            // Plot equity chart
            var equity = new EquityGraph({
            }, document.getElementById('equity-graph'));
            equity.data = _.compact(equity_data);
            equity.render();
            $('body').layout().open('east');
        }

    ], function(err) {
        if (err) console.error(err);
    });

    /////////////////////////////////////////////////////////////////////////////////////

    // insert new row on trade table
    function insert_trade_row(trade) {
        // prepare table row to be inserted
        var trow = $('<tr>')
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
                        td.css('color', '#000000').css('background', 'rgb(13, 206, 13)');
                    } else if (trade > 1) {
                        td.css('color', '#000000').css('background', 'rgb(119, 247, 119)');
                    } else if (trade.pips < 7) {
                        td.css('color', '#000000').css('background', 'rgb(236, 52, 26)');
                    } else if (trade.pips < -1) {
                        td.css('color', '#000000').css('background', 'rgb(241, 137, 122)');
                    } else {
                        td.css('color', '#000000').css('background', '#eee');
                    }
                    break;
                default:
            }
            td.text(renderer(trade));
            trow.append(td);
        });
        trow.children()
            .css('cursor', 'pointer')
            .on('click', function() {
                if (trades_tbody.data('selected')) {
                    trades_tbody.data('selected').children().removeClass('selected');
                }
                $(this).parent().children().addClass('selected');
                trades_tbody.data('selected', $(this).parent());
                show_trade_on_chart(trade);
            });
        trades_tbody.append(trow);
        $('#bt-table').scrollTop($('#bt-table').height());
    }

    // add trade to buffered queues with logic to ensure final chronological order
    function time_buffer_trade(trade) {
        source[trade.instr].queue.push(trade);
        var all_instr;
        do {
            all_instr = _.all(source, function(src) {
                return src.queue.length > 0;
            });
            if (all_instr) {

                var next = _.first(_.sortBy(_.values(source), function(src) {
                    return _.first(src.queue).date.getTime();
                })).queue.shift();

                trades.push(next);
                insert_trade_row(next);

            }
        } while (all_instr);
    }

    // complete processing trades that remain in buffered queues
    function flush_queues() {
        var trades_queued;
        do {
            trades_queued = _.some(source, function(src) {return src.queue.length > 0});
            if (trades_queued) {
                var has_waiting = _.values(source).filter(function(src) {return src.queue.length > 0});
                var next = _.first(_.sortBy(has_waiting, function(src) {
                    return _.first(src.queue).date.getTime();
                })).queue.shift();

                trades.push(next);
                insert_trade_row(next);
            }
        } while (trades_queued);
    }

    // create and render chart that is focused on selected trade
    function show_trade_on_chart(trade, cb) {

        console.log('Trade:', trade);

        spinner.spin(document.getElementById('bt-chart'));

        var inputs = [];
        inputs.push(new Stream(200, '<' + config.datasource + '>', {is_root: true, instrument: trade.instr, tf: 'T', type: 'object'}));
        inputs.push(new Stream(200, '<' + config.datasource + '>', {is_root: true, instrument: trade.instr, tf: config.timeframe, type: 'object'}));
        inputs.push(new Stream(200, '<' + config.datasource + '>', {is_root: true, instrument: trade.instr, tf: config.higher_timeframe, type: 'object'}));

        CollectionFactory.create(config.collection, inputs, config, function(err, collection) {
            if (err) return cb(err);

            chart = new Chart({
                setup: config.chart_setup,
                collection: config.collection,
                container: d3.select('#bt-chart')
            });

            chart.init(function(err) {
                if (err) return console.error(err);
                chart.setup.maxsize = 50;
                chart.setup.barwidth = 4;
                chart.setup.barpadding = 2;
            });

            chart.render();
            cb();
        });
    }

    // format and render a stat value
    function render_value(val) {
        if (_.isNumber(val)) {
            val = Math.round(val * 100) / 100;
            return val < 0 ? '<span class="negval">(' + Math.abs(val) + ')</span>' : val;
        } else {
            return val;
        }
    }

    // render backtest statistics results table
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

});