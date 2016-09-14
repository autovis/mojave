'use strict';

requirejs(['lodash', 'async', 'moment-timezone', 'd3', 'jquery', 'Keypress', 'spin', 'stream', 'dataprovider', 'collection_factory', 'charting/chart'], function(_, async, moment, d3, $, keypress, Spinner, Stream, dataprovider, CollectionFactory, Chart) {

    CollectionFactory.set_dataprovider(dataprovider);

    var chart_options = {

        // chart template name
        /*
        collection: 'basic_mtf_strategy',
        setup: 'basic_mtf_strategy_chart',
        */
        collection: 'geom',
        setup: 'geom_chart',

        // data source

        /*
        source: 'oanda',
        instrument: 'eurusd',
        inputs: {
            'm1.input': {
                range: [
                    '2016-09-08 00:00',
                    '2016-09-08 12:00'
                ]
            }
        },
        */

        source: 'csv/test_A_eurusd.csv',
        header: ['date', 'ask', 'bid'],
        instrument: 'eurusd',
        type: 'tick',
        inputs: {
            'tick': {
                //range: ['2016-02-24 16:00', '2016-02-24 20:00'],
                //count: 40
            }
        },

        // collection/chart vars
        vars: {
            ltf: 'm5',
            htf: 'H1'
        },

        // replay settings
        //paused: false, // initial state
        paused_bar: 20, // bar on which to pause
        step_timer: 0, // wait in ms between bars when unpaused
        debug: true, // debug mode

        // internal
        container: d3.select('#chart'),
    };

    var chart;
    var data_queue;
    var listener = new keypress.Listener();
    var spinner;

    chart_options.advance_callback = () => null;

    // apply theme
    var theme = localStorage.getItem('theme') || 'light';
    var ss = d3.select('#theme-ss');
    if (theme === 'dark') {
        ss.attr('href', '/css/chart-default-dark.css');
    } else {
        ss.attr('href', '/css/chart-default.css');
    }

    // show spinner
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

    spinner.spin(document.getElementById('chart'));

    async.series([ // async tasks

        // set up jquery-layout
        function(cb) {
            requirejs(['jquery-ui-layout-min'], () => {
                $('body').layout({
                    defaults: {
                        closable: true,
                        resizable: true,
                        slideable: true
                    },
                    north: {
                        closable: true,
                        resizable: false,
                        slidable: false,
                        size: 10
                    }
                });
                cb();
            });
        },

        // create and initialize collection
        function(cb) {
            CollectionFactory.create(chart_options.collection, chart_options, (err, collection) => {
                if (err) return cb(err);
                chart_options.collection = collection;
                cb();
            });
        },

        // create and initialize chart
        function(cb) {
            // initialize dates using current timezone
            if (_.isArray(chart_options.range)) {
                chart_options.range = _.map(chart_options.range, date => moment.tz(date, moment.tz.guess()));
            }
            chart = new Chart(chart_options);
            chart.init(err => {
                if (err) return cb(err);
                cb();
            });
        },

        // process inputs and render chart on <start_bar>
        function(cb) {

            var bar_count = -1;
            var timer = 0;
            data_queue = async.queue((task, cb) => {
                if (_.isObject(task) && _.isString(task.event)) {
                    switch (task.event) {
                        case 'data':
                            bar_count += 1;
                            task.stream.emit('next', task.stream.get(), task.stream.current_index());
                            task.stream.next();
                            task.stream.set(task.data);
                            if (chart_options.debug && console.groupCollapsed) console.groupCollapsed(task.stream.current_index(), task.stream.id, task.stream.get().date);
                            task.stream.emit('update', {modified: [task.stream.current_index()], tstep_set: new Set([task.stream.tstep])});
                            if (chart_options.debug && console.groupEnd) console.groupEnd();
                            break;
                        case 'conn_end':
                            task.stream.conn = null;
                            break;
                        case 'end':
                            chart_options.advance_callback = () => null;
                            return;
                        default:
                    }
                }
                if (bar_count === chart_options.paused_bar) {
                    timer = chart_options.step_timer;
                    chart_options.paused = true;
                    spinner.stop();
                    chart.render();
                    $('#chart').scrollLeft(chart.width); // scroll to far right
                }
                if (chart_options.paused) {
                    chart_options.advance_callback = cb;
                } else {
                    setTimeout(cb, timer);
                }
            });

            var dpclient = dataprovider.register('chart_replay:' + chart_options.setup);
            async.eachSeries(_.toPairs(chart_options.inputs), ([inp, inp_params], cb) => {
                let istream = chart.collection.input_streams[inp];
                let inp_jsnc = _.get(chart.collection.config.inputs, inp);
                if (istream) {
                    let conn;
                    let conn_config = _.assign({}, chart_options, inp_jsnc.options, inp_params, {tstep: istream.tstep});
                    if (_.isArray(conn_config.range)) {
                        conn = dpclient.connect('get_range', conn_config);
                    } else if (_.isNumber(conn_config.count)) {
                        if (conn_config.count === 0) return cb();
                        conn = dpclient.connect('get_last_period', conn_config);
                    } else {
                        conn = dpclient.connect('get', conn_config);
                    }
                    istream.conn = conn;
                    conn.on('data', pkt => {
                        data_queue.push({
                            event: 'data',
                            stream: istream,
                            data: pkt.data
                        });
                    });
                    conn.on('error', err => {
                        chart_options.collection.emit('error', err);
                    });
                    conn.on('end', () => {
                        data_queue.push({
                            event: 'conn_end',
                            stream: istream
                        });
                        cb();
                    });

                } else {
                    cb();
                }
            }, err => {
                if (err) return cb(err);
                data_queue.push({
                    event: 'end'
                });
                cb();
            });
        },

        // set up keyboard listeners
        function(cb) {
            var barwidth_inc = 3;
            listener.simple_combo(']', () => {
                if (chart.setup.bar_width >= 50) return;
                chart.setup.bar_width =  Math.floor(chart.setup.bar_width / barwidth_inc) * barwidth_inc + barwidth_inc;
                chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
                chart.resize();
                chart.save_transform();
                chart.render();
            });
            listener.simple_combo('[', () => {
                if (chart.setup.bar_width <= barwidth_inc) return;
                chart.setup.bar_width =  Math.floor(chart.setup.bar_width / barwidth_inc) * barwidth_inc - barwidth_inc;
                chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
                chart.resize();
                chart.save_transform();
                chart.render();
            });
            listener.simple_combo('.', () => {
                chart.selectedComp.height = Math.min(chart.selectedComp.height + 20, 2000);
                if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height, 0]);
                chart.on_comp_resize(chart.selectedComp);
            });
            listener.simple_combo(',', () => {
                chart.selectedComp.height = Math.max(chart.selectedComp.height - 20, 20);
                if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height, 0]);
                chart.on_comp_resize(chart.selectedComp);
            });
            listener.simple_combo('q', () => {
                var ss = d3.select('#theme-ss');
                if (ss.attr('href') === '/css/chart-default.css') {
                    ss.attr('href', '/css/chart-default-dark.css');
                } else {
                    ss.attr('href', '/css/chart-default.css');
                }
                chart.render();
            });
            listener.simple_combo('p', () => {
                if (chart_options.paused) {
                    chart_options.paused = false;
                    chart_options.advance_callback();
                } else {
                    chart_options.paused = true;
                    chart_options.advance_callback();
                }
            });
            listener.simple_combo('space', () => {
                chart_options.advance_callback();
            });

            cb();
        }

    ], err => {
        if (err) return console.error(err);
    });

}); // requirejs
