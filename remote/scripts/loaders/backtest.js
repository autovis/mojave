'use strict';

requirejs(['lodash', 'jquery', 'jquery-ui', 'dataprovider', 'async', 'moment', 'd3', 'stream', 'collection_factory'], function(_, $, jqueryUI, dataprovider, async, moment, d3, Stream, CollectionFactory) {

    var config = {
        datapath: ['oanda', 'eurusd', 'm5', 100],
        collection: '2015.03.MACD_OBV',

        source: 'oanda',
        instrument: 'eurusd',
        timeframe: 'm5',
        higher_timeframe: 'H1',
        history: 1000
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
        PnL: function(d) {
            return '-';
        }
    };

    var tbody;

    async.series([

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
                        size: 325
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

            tbody = $('<tbody>');
            table.append(tbody);
            $('#bt-table').append(table);

            cb();
        },

        function(cb) {
            // ----------------------------------------------------------------------------------
            // Set up dataprovider connection and initialize collection

            var client = dataprovider.register();

            var stream = {};
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
                            var trow = $('<tr>');
                            _.each(table_renderer, function(renderer, field) {
                                var td = $('<td>');
                                if (field === 'date') {
                                    td.css('white-space', 'nowrap');
                                } else if (field === 'pips') {
                                    td.css('font-weight', 'bold');
                                    td.css('font-family', 'monospace');
                                    td.css('text-align', 'right');
                                    if (evt[1].pips > 7) {
                                        td.css('background', 'rgb(13, 206, 13)');
                                    } else if (evt[1] > 1) {
                                        td.css('background', 'rgb(119, 247, 119)');
                                    } else if (evt[1].pips < 7) {
                                        td.css('background', 'rgb(236, 52, 26)');
                                    } else if (evt[1].pips < -1) {
                                        td.css('background', 'rgb(241, 137, 122)');
                                    } else {
                                        td.css('background', '#eee');
                                    }
                                }
                                td.text(renderer(evt[1]));
                                trow.append(td);
                            });
                            tbody.append(trow);
                        }
                    });

                });

                var conn = client.connect('fetch', [config.source, config.instrument, config.timeframe, config.history]);

                conn.on('data', function(packet) {
                    stream.ltf.next();
                    stream.ltf.set(packet.data);
                    stream.ltf.emit('update', {timeframes: [config.timeframe]});
                });

                conn.on('end', function() {
                    var trow = $('<tr>');
                    var td = $('<td>')
                        .css('text-align', 'center')
                        .css('font-weight', 'bold')
                        .css('color', 'white')
                        .css('background', 'rgb(99, 113, 119)')
                        .attr('colspan', _.keys(table_renderer).length)
                        .html('&mdash;&nbsp;&nbsp;&nbsp;END&nbsp;&nbsp;&nbsp;&mdash;');
                    tbody.append(trow.append(td));

                    $('body').layout().open('east');
                });

                cb();
            });

        }


    ], function(err) {
        if (err) console.error(err);
    });


}); // requirejs
