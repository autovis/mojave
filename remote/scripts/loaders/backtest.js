'use strict';

var chart = null;
var trades = [];
var stat = {};

requirejs(['lodash', 'jquery', 'jquery-ui', 'dataprovider', 'async', 'Keypress', 'moment-timezone', 'd3', 'simple-statistics', 'spin', 'hash', 'stream', 'config/instruments', 'collection_factory', 'charting/chart', 'charting/equity_graph', 'node-uuid'],
  function(_, $, jqueryUI, dataprovider, async, keypress, moment, d3, ss, Spinner, hash, Stream, instruments, CollectionFactory, Chart, EquityGraph, uuid) {

    var key_listener = new keypress.Listener();

    var config = {
        collection: 'geom',
        chart_setup: 'geom_chart',

        // ---------------------------------
        // Data source

        source: 'oanda',
        instruments: ['eurusd', 'gbpusd', 'audusd', 'usdjpy'],
        vars: {
            ltf: 'm5',
            htf: 'H1'
        },

        source_input: 'm1.input', // Only one input is fed into when backtesting
        // TODO: Apply ('count' or 'range') to 'source_input'

        //count: {ltf_dcdl: 3000},
        count: {
            'm1.input': 300
        },
        //range: ['2016-05-01', '2016-06-14'],

        save_inputs: true, // must be 'true' for chart to work

        // ---------------------------------
        // Chart

        trade_chartsize: 75, // width of chart in bars
        trade_preload: 50,    // number of bars to load prior to first visible bar on chart
        trade_pad: 5,        // number of bars to pad on right side of trade exit on chart
        pixels_per_pip: 17,  // maintain chart scale fixed to this
        trade_event_uuids_maxsize: 10  // maxsize of buffer of UUIDs to check against to avoid duplicate events
    };

    var table_renderer = {
        instr: function(d) {
            var retval = d.instr.toUpperCase();
            var color = d3.scale.category10().domain(_.range(0, 9));
            var idx = _.indexOf(config.instruments, d.instr);
            if (idx >= 0 && idx <= 10) {
                retval = "<span style='color:" + color(idx) + ";'>■</span>&nbsp;" + retval;
            }
            return retval;
        },
        //id: d => d.id,
        time: d => d.start && moment(d.start.date).format('HH:mm') || 'N/A',
        stgy: d => d.label,
        dir: d => d.direction === -1 ? '▼' : '▲',
        pips: d => d.pips < 0 ? '(' + Math.abs(d.pips) + ')' : d.pips,
        reason: d => d.reason,
        //lot: d => d.units,
        //pnl: d => d.pips * d.units
    };

    var trades_tbody;        // `tbody` of trades table
    var progress_bar;        // general purpose progress bar
    var spinner;             // spinning activity indicator

    var instruments_state = {};     // holds all state info/handlers relevant to each instrument
    var theme = localStorage.getItem('theme') || 'light';

    async.series([

        // ----------------------------------------------------------------------------------
        // Apply CSS theme

        function(cb) {
            // apply theme
            var btss = d3.select('#backtest-stylesheet');
            var chss = d3.select('#chart-stylesheet');
            var rtss = d3.select('#result-table-stylesheet');
            if (theme === 'dark') {
                btss.attr('href', '/css/backtest-dark.css');
                chss.attr('href', '/css/chart-default-dark.css');
                rtss.attr('href', '/css/result-table-dark.css');
            } else {
                btss.attr('href', '/css/backtest-light.css');
                chss.attr('href', '/css/chart-default.css');
                rtss.attr('href', '/css/result-table.css');
            }
            cb();
        },

        // ----------------------------------------------------------------------------------
        // Initialize global states

        function(cb) {

            _.each(config.instruments, instr => {
                instruments_state[instr] = {
                    collection: null,
                    queue: [],
                    inputs: {}  // store data for each input per instrument (used for rendering chart on trade select)
                };
            });

            spinner = new Spinner({
                lines: 24, // The number of lines to draw
                length: 20, // The length of each line
                width: 5, // The line thickness
                radius: 50, // The radius of the inner circle
                scale: 1, // Scales overall size of the spinner
                corners: 0.3, // Corner roundness (0..1)
                color: theme === 'dark' ? '#ffe' : '#000', // #rgb or #rrggbb or array of colors
                opacity: 0.1, // Opacity of the lines
                rotate: 0, // The rotation offset
                direction: 1, // 1: clockwise, -1: counterclockwise
                speed: 0.7, // Rounds per second
                trail: 43, // Afterglow percentage
                fps: 20, // Frames per second when using setTimeout() as a fallback for CSS
                zIndex: 2e9, // The z-index (defaults to 2000000000)
                className: 'spinner', // The CSS class to assign to the spinner
                top: '33%', // Top position relative to parent
                left: '50%', // Left position relative to parent
                shadow: false, // Whether to render a shadow
                hwaccel: false, // Whether to use hardware acceleration
                position: 'absolute' // Element positioning
            });

            // Initialize dates using current timezone
            if (_.isArray(config.range)) {
                config.range = _.map(config.range, date => moment.tz(date, moment.tz.guess()));
            }

            cb();
        },

        // ----------------------------------------------------------------------------------
        // Set up jquery-ui-layout

        function(cb) {
            requirejs(['jquery-ui-layout-min'], () => {
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
                        size: 300 //230
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
        // Set up backtesting results table

        function(cb) {

            var table = $('<table>').addClass('result').css('width', '100%');
            trades_tbody = $('<tbody>');
            table.append(trades_tbody);
            $('#bt-table').append(table);

            cb();
        },

        // ----------------------------------------------------------------------------------
        // Create and initialize a collection per instrument

        function(cb) {

            async.each(config.instruments, (instr, cb) => {

                var instr_state = instruments_state[instr];

                var instr_config = {
                    source: config.source,
                    count: config.count,
                    range: config.range,
                    instrument: instr,
                    vars: _.assign({}, config.vars, hash.get())
                };

                // filter on items that haven't been seen in 'n' unique instances
                var seen_items = Array(20), seen_idx = 0;
                var is_first_seen = function(item) {
                    if (seen_items.includes(item)) return false;
                    seen_items[seen_idx % seen_items.length] = item;
                    seen_idx += 1;
                    return true;
                };
                var trade_starts = {}; // track `trade_start` events to match corresp. `trade_end` with

                CollectionFactory.create(config.collection, instr_config, (err, collection) => {
                    if (err) return cb(err);

                    collection.on('error', err => {
                        console.error(err);
                    });

                    let trade_stream = _.get(collection.sources, 'trade_evts');
                    if (!trade_stream) return cb("A 'trade_evts' indicator must be defined for backtesting");

                    instr_state.collection = collection;

                    trade_stream.on('update', args => {

                        if (trade_stream.current_index() < config.trade_preload) return;
                        var trade_events = trade_stream.get();

                        _.each(trade_events, evt => {
                            if (!is_first_seen(evt[1].evt_uuid)) return; // skip events already processed
                            if (evt[0] === 'trade_end') {
                                var trade = _.assign({}, evt[1], {
                                    instr: instr,
                                    indexes: _.fromPairs(_.map(collection.input_streams, (istream, inp_id) => [inp_id, istream.current_index()])),
                                    start: trade_starts[evt[1].pos_uuid] || null
                                });
                                time_buffer_trade(trade);
                                delete trade_starts[evt[1].pos_uuid];
                            } else if (evt[0] === 'trade_start') {
                                trade_starts[evt[1].pos_uuid] = evt[1];
                            }
                        });

                    });

                    /*
                    _.each(collection.indicators, (ind, ind_id) => {
                        var stream = collection.indicators[ind_id].output_stream;
                        stream.on('update', () => {
                            var bar = stream.get();
                            console.log(stream.current_index(), ind_id, bar);
                        });
                    });
                    */

                    cb();
                });

            }, cb);

        },

        // ----------------------------------------------------------------------------------
        // Set up dataprovider connection and fetch data

        function(cb) {

            // set up progress bar
            progress_bar = $('<div>').progressbar({value: false}).width('100%').height(15);
            $('#bt-head').append(progress_bar);

            //var client = dataprovider.register();
            var range = {};
            var range_scale = null;
            if (_.isArray(config.range)) {
                range.start = config.range[0].toDate();
                range.end = config.range[1].toDate() || moment.tz(moment.tz.guess()).toDate();
                range_scale = d3.time.scale()
                    .domain([range.start, range.end])
                    .rangeRound([0, 100]);
            }
            var instr_percents = _.fromPairs(_.map(config.instruments, instr => [instr, 0])); // {instrument => num(0-100)}
            var inp_count = 0;

            // Create hooks on input streams for tracking progress
            var total_count = _.isObject(config.count) ? _.reduce(_.values(config.count), (memo, val) => memo + val, 0) : parseInt(config.count) * config.instruments.length;
            _.each(instruments_state, (instr_state, instr) => {
                _.each(instr_state.collection.input_streams, (istream, inp_id) => {
                    instr_state.inputs[inp_id] = [];
                    istream.on('next', (bar, idx) => {
                        if (idx === -1) return;
                        inp_count += 1;
                        if (config.save_inputs) instr_state.inputs[inp_id].push(bar);
                        // update progress bar every 10 packets
                        if (inp_count % 10 === 0) {
                            if (range_scale) {
                                var packet_date = bar && bar.date && moment(bar.date);
                                packet_date = packet_date && packet_date.isValid() && packet_date.toDate();
                                instr_percents[instr] = packet_date ? range_scale(packet_date) : 0;
                            } else { // assume config.history is defined
                                instr_percents[instr] = Math.round(inp_count * 100 / total_count);
                            }
                            var percents = _.values(instr_percents);
                            progress_bar.progressbar({
                                // calculate avg of percentages across instruments
                                value: !_.isEmpty(percents) ? _.reduce(percents, (memo, perc) => memo + perc, 0) / percents.length : false
                            });
                        }
                    });
                });
            });

            // On pressing 'ESC', cancel fetching data and skip to results
            key_listener.simple_combo('esc', () => {
                _.each(instruments_state, instr_state => {
                    _.each(instr_state.input_streams, (istream, inp_id) => {
                        if (istream.conn) istream.conn.client.close_all();
                    });
                });
            });

            // Start inputs for each collection simultaneously
            async.parallel(_.map(instruments_state, (instr_state, instr) => {
                return cb => instr_state.collection.start({}, cb);
            }), err => { // called when all inputs are finished
                if (err) return cb(err);
                progress_bar.progressbar({value: 100});
                cb();
            });

        },

        // ------------------------------------------------------------------------------
        // Render chart, stats table and equity graph

        function(cb) {

            flush_queues();

            // calculate stats
            stat['#_trades'] = trades.length;
            var equity_data = trades.map(trade => trade && trade.pips && trade.units && trade.pips * trade.units);

            stat.expectancy = equity_data.reduce((memo, val) => memo + val, 0) / equity_data.length;
            stat.stdev = ss.standardDeviation(equity_data);
            var wins = equity_data.filter(t => t > 0);
            var nonwins = equity_data.filter(t => t <= 0);
            stat['#_wins'] = wins.length;
            //stat['#_nonwins'] = nonwins.length;
            stat['%_wins'] = wins.length / equity_data.length;
            //stat['%_nonwins'] = nonwins.length / equity_data.length;
            //stat['win:nonwin'] = wins.length / nonwins.length;
            stat['avg_win_pnl'] = _.reduce(wins, (memo, t) => memo + t, 0) / wins.length;
            stat['avg_nonwin_pnl'] = _.reduce(nonwins, (memo, t) => memo + t, 0) / nonwins.length;

            var daygrouped = _.groupBy(trades, trade => moment(trade.date).format('YYYY-MM-DD'));
            var day_trade_cnt = _.map(_.values(daygrouped), g => g.length);
            stat['avg_trades/day'] = _.reduce(day_trade_cnt, (memo, t) => memo + t, 0) / day_trade_cnt.length;

            // Add END marker to trades table
            var trow = $('<tr>');
            var td = $('<td>').addClass('section')
                .attr('colspan', _.keys(table_renderer).length)
                .html('&mdash;&nbsp;&nbsp;&nbsp;END&nbsp;&nbsp;&nbsp;&mdash;');
            trades_tbody.append(trow.append(td));
            $('#bt-table').scrollTop($('#bt-table').find('table').height());

            // Create stats table
            $('#stats-table').append(render_stats_table());

            // Plot equity chart
            var equity = new EquityGraph({
            }, document.getElementById('equity-graph'));
            equity.data = _.compact(equity_data);
            equity.render();
            $('body').layout().open('east');
            cb();
        },

        // ------------------------------------------------------------------------------
        // Set up keyboard listeners

        function(cb) {
            var barwidth_inc = 3;
            key_listener.simple_combo(']', () => {
                if (!chart || chart.setup.bar_width >= 50) return;
                chart.setup.bar_width =  Math.floor(chart.setup.bar_width / barwidth_inc) * barwidth_inc + barwidth_inc;
                chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
                var comp_y = 0;
                _.each(chart.components, comp => {
                    comp.y = comp_y;
                    comp.resize();
                    comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
                });
                //chart.save_transform();
                chart.render();
            });
            key_listener.simple_combo('[', () => {
                if (!chart || chart.setup.bar_width <= barwidth_inc) return;
                chart.setup.bar_width =  Math.floor(chart.setup.bar_width / barwidth_inc) * barwidth_inc - barwidth_inc;
                chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
                var comp_y = 0;
                _.each(chart.components, comp => {
                    comp.y = comp_y;
                    comp.resize();
                    comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
                });
                //chart.save_transform();
                chart.render();
            });
            key_listener.simple_combo('.', () => {
                if (!chart) return;
                chart.selectedComp.height = Math.min(chart.selectedComp.height + 20, 2000);
                if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height, 0]);
                chart.on_comp_resize(chart.selectedComp);
            });
            key_listener.simple_combo(',', () => {
                if (!chart) return;
                chart.selectedComp.height = Math.max(chart.selectedComp.height - 20, 20);
                if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height, 0]);
                chart.on_comp_resize(chart.selectedComp);
            });
            key_listener.simple_combo('q', () => {
                var btss = d3.select('#backtest-stylesheet');
                var chss = d3.select('#chart-stylesheet');
                var rtss = d3.select('#result-table-stylesheet');
                if (btss.attr('href') === '/css/backtest-light.css') {
                    btss.attr('href', '/css/backtest-dark.css');
                    chss.attr('href', '/css/chart-default-dark.css');
                    rtss.attr('href', '/css/result-table-dark.css');
                    localStorage.setItem('theme', 'dark');
                } else {
                    btss.attr('href', '/css/backtest-light.css');
                    chss.attr('href', '/css/chart-default.css');
                    rtss.attr('href', '/css/result-table.css');
                    localStorage.setItem('theme', 'light');
                }
                if (chart) chart.render();
            });
            cb();
        }

    ], err => {
        if (err) console.error(err);
    });

    /////////////////////////////////////////////////////////////////////////////////////

    // insert new row on trade table
    var loading = false;
    var prev_trade = null;
    stat.days = 0;
    function insert_trade_row(trade) {
        // insert section header if new day
        if (!_.isObject(prev_trade) || trade.date.getDay() !== prev_trade.date.getDay()) {
            // section title (day)
            var td = $('<td>').attr('colspan', _.keys(table_renderer).length).addClass('section').appendTo($('<tr>').appendTo(trades_tbody));
            td.html(moment(trade.date).format('dddd — MMM D'));
            // column headers
            var hdr_row = $('<tr>');
            _.each(_.keys(table_renderer), field => {
                hdr_row.append($('<th>').text(field));
            });
            trades_tbody.append(hdr_row);
            stat.days += 1;
        }

        // prepare table row to be inserted
        var trow = $('<tr>');
        _.each(table_renderer, (renderer, field) => {
            var td = $('<td>');

            switch (field) {
                case 'date':
                    td.css('white-space', 'nowrap');
                    break;
                case 'pips':
                    td.css('font-weight', 'bold');
                    td.css('font-family', 'monospace');
                    td.css('text-align', 'center');
                    td.css('color', '#000000');
                    if (trade.pips > 7) {
                        td.css('background', 'rgb(13, 206, 13)');
                    } else if (trade.pips > 1) {
                        td.css('background', 'rgb(119, 247, 119)');
                    } else if (trade.pips < -7) {
                        td.css('background', 'rgb(236, 52, 26)');
                    } else if (trade.pips < -1) {
                        td.css('background', 'rgb(241, 137, 122)');
                    } else {
                        td.css('background', '#eee');
                    }
                    break;
                default:
            }
            td.html(renderer(trade));
            trow.append(td);
        });
        trow.children()
            .css('cursor', 'pointer')
            // on click: select trade and load chart
            .on('click', function() {
                if (loading) return;
                if (trades_tbody.data('selected')) {
                    trades_tbody.data('selected').children().removeClass('selected');
                }
                $(this).parent().children().addClass('selected');
                trades_tbody.data('selected', $(this).parent());
                loading = true;
                show_trade_on_chart(trade, err => {
                    if (err) console.error(err);
                    loading = false;
                });
            });
        trades_tbody.append(trow);
        $('#bt-table').scrollTop($('#bt-table').height());
        prev_trade = trade;
    }

    // add trade to buffered queues with logic to ensure final chronological order
    function time_buffer_trade(trade) {
        instruments_state[trade.instr].queue.push(trade);
        var all_instr;
        do {
            all_instr = _.every(instruments_state, instr_state => instr_state.queue.length > 0);
            if (all_instr) {

                var next = _.head(_.sortBy(_.values(instruments_state), instr_state => {
                    return _.head(instr_state.queue).date.getTime();
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
            trades_queued = _.some(instruments_state, instr_state => instr_state.queue.length > 0);
            if (trades_queued) {
                var has_waiting = _.values(instruments_state).filter(instr_state => instr_state.queue.length > 0);
                var next = _.head(_.sortBy(has_waiting, instr_state => {
                    return _.head(instr_state.queue).date.getTime();
                })).queue.shift();

                trades.push(next);
                insert_trade_row(next);
            }
        } while (trades_queued);
    }

    // create and render chart that is focused on selected trade
    function show_trade_on_chart(trade, cb) {

        console.log('Selected trade:', trade);
        d3.select('#bt-chart g.chart').style('opacity', '0.5');
        spinner.spin(document.getElementById('bt-chart'));

        // reset dialogs first
        if (chart) {
            var evt = new MouseEvent('click');
            chart.chart.node().dispatchEvent(evt);
        }

        var instr_state = instruments_state[trade.instr];

        // Create new config specialized for chart collection from backtest collection
        var coll_config = _.assign({}, config, {
            input_streams: _.fromPairs(_.map(instr_state.collection.input_streams, (str, inp_id) => {
                var stream;
                let inp = str.jsnc;
                stream = new Stream(100, 'input:' + str.type, {
                    type: str.type,
                    instrument: str.instrument,
                    tstep: str.tstep
                });
                inp.stream = stream;
                //if (_.has(tsconfig.defs, inp.tstep)) inp.tstepconf = tsconfig.defs[inp.tstep];
                return [inp_id, stream];
            })),
            vars: _.assign({}, config.vars, hash.get())
        });

        CollectionFactory.create(config.collection, coll_config, (err, collection) => {
            if (err) return cb(err);

            chart = new Chart({
                setup: config.chart_setup,
                container: d3.select('#bt-chart'),
                collection: collection,
                //selected_trade: trade.id
                vars: _.assign({}, config.vars, hash.get())
            });
            chart.kb_listener = key_listener;
            chart.on('setvar', (key, val) => {
                var obj = {};
                obj[key] = val;
                hash.add(obj);
            });

            chart.init(err => {
                if (err) return cb(err);

                // remove any tick-based components
                chart.components = _.filter(chart.components, comp => comp.config.anchor !== 'tick');

                chart.setup.maxsize = config.trade_chartsize;
                chart.setup.barwidth = 4;
                chart.setup.barpadding = 2;
                //chart.setup.pan_and_zoom = true;

                // determine slice needed from prices to build up chart highlighting trade
                var index = trade.indexes[config.source_input];
                var end_index = Math.min(index + config.trade_pad, instr_state.inputs[config.source_input].length - 1);
                var start_index = Math.max(end_index - chart.setup.maxsize - config.trade_preload, 0);

                progress_bar.progressbar({value: 0});
                async.eachSeries(_.range(start_index, end_index + 1), (idx, next) => {
                    var istream = collection.input_streams[config.source_input];
                    istream.next();
                    istream.set(instr_state.inputs[config.source_input][idx]);
                    istream.emit('update', {timeframes: [config.timeframe]});
                    progress_bar.progressbar({
                        value: Math.round(100 * (idx - start_index) / (end_index - start_index))
                    });
                    setTimeout(next, 0);
                }, err => {
                    spinner.stop();
                    if (err) return cb(err);
                    chart.render();
                    // resize first price-based, non-tick-based comp in order to maintain pixels/pip ratio constant
                    var comp = _.find(chart.components, comp => comp.config.y_scale && comp.config.y_scale.price && comp.config.anchor !== 'tick');
                    var domain = comp.y_scale.domain();
                    comp.height = (domain[1] - domain[0]) / instruments[trade.instr].unit_size * config.pixels_per_pip;
                    comp.height = Math.max(Math.min(Math.round(comp.height), 900), 150);
                    if (comp.y_scale) comp.y_scale.range([comp.height, 0]);
                    chart.on_comp_resize(comp);

                    /* Show bar count for each indicator
                    console.log('collection', _.fromPairs(_.map(collection.indicators, function(ind, key) {
                        return [key, ind.output_stream.index];
                    })));
                    */

                    //console.log('collection', _.fromPairs(_.map(collection.indicators, (ind, key) => [key, ind.output_stream.buffer])));

                    cb();
                });
            });
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
        _.each(stat, (value, name) => {
            var th = $('<th>').addClass('key').text(name).css('font-family', 'monospace');
            var td = $('<td>').addClass('value').html(render_value(value));
            tbody.append($('<tr>').append(th).append(td));
        });
        table.append(tbody);
        return table;
    }

});
