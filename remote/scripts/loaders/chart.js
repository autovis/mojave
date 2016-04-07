'use strict';

var chart;
var spinner;
var kb_listener;

requirejs(['lodash', 'async', 'jquery', 'd3', 'Keypress', 'moment-timezone', 'spin', 'stream', 'config/instruments', 'charting/chart'], function(_, async, $, d3, keypress, moment, Spinner, Stream, instruments, Chart) {

    var config = {
        barwidth_inc: 3
    };

    var chart_options = {
        source: 'oanda',
        instrument: instrument,
        timeframe: 'm5',
        range: [date + ' 01:00', date + ' 11:00'],
        vars: {
            ltf: 'm5',
            htf: 'H1'
        },
        setup: '2016-03_chart',
        container: d3.select('#chart'),
        subscribe: false,
        debug: false
    };

    async.series([

        // Initialization
        function(cb) {

            // Init spinner
            spinner = new Spinner({
                lines: 24, // The number of lines to draw
                length: 20, // The length of each line
                width: 5, // The line thickness
                radius: 50, // The radius of the inner circle
                scale: 1, // Scales overall size of the spinner
                corners: 0.3, // Corner roundness (0..1)
                color: '#000', // #rgb or #rrggbb or array of colors
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

            // Initialize dates using current timezone
            if (_.isArray(chart_options.range)) {
                chart_options.range = _.map(chart_options.range, date => moment.tz(date, moment.tz.guess()));
            }
            chart = new Chart(chart_options);
            chart.init(err => {
                // remove any tick-based components
                chart.components = _.filter(chart.components, comp => comp.config.anchor !== 'tick');
                // force geometry
                chart.setup.bar_width = 8;
                chart.setup.bar_padding = 2;
                if (err) throw err;
                cb();
            });
        },

        /////////////////////////////////////////////////////////////////////////////////
        // Subscribe to data

        function(cb) {
            chart.render();
            spinner.stop();
            cb();
        },

        /////////////////////////////////////////////////////////////////////////////////
        // Set up keyboard listeners

        function(cb) {

            kb_listener = new keypress.Listener();

            kb_listener.simple_combo(']', () => {
                if (chart.setup.bar_width >= 50) return;
                chart.setup.bar_width =  Math.floor(chart.setup.bar_width / config.barwidth_inc) * config.barwidth_inc + config.barwidth_inc;
                chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
                chart.resize();
                chart.save_transform();
                chart.render();
            });
            kb_listener.simple_combo('[', () => {
                if (chart.setup.bar_width <= config.barwidth_inc) return;
                chart.setup.bar_width =  Math.floor(chart.setup.bar_width / config.barwidth_inc) * config.barwidth_inc - config.barwidth_inc;
                chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
                chart.resize();
                chart.save_transform();
                chart.render();
            });
            kb_listener.simple_combo('.', () => {
                chart.selectedComp.height = Math.min(chart.selectedComp.height + 20, 2000);
                if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height, 0]);
                chart.on_comp_resize(chart.selectedComp);
            });
            kb_listener.simple_combo(',', () => {
                chart.selectedComp.height = Math.max(chart.selectedComp.height - 20, 20);
                if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height, 0]);
                chart.on_comp_resize(chart.selectedComp);
            });
            kb_listener.simple_combo('/', () => {
                var comp = _.find(chart.components, comp => comp.config.y_scale && comp.config.y_scale.price && comp.config.anchor !== 'tick');
                var domain = comp.y_scale.domain();
                comp.height = (domain[1] - domain[0]) / instruments[chart_options.instrument].unit_size * 10.25;
                comp.height = Math.max(Math.min(Math.round(comp.height), 900), 150);
                if (comp.y_scale) comp.y_scale.range([comp.height, 0]);
                chart.on_comp_resize(comp);
            });
            kb_listener.simple_combo('q', () => {
                var ss = d3.select('#theme-ss');
                if (ss.attr('href') === '/css/chart-default.css') {
                    ss.attr('href', '/css/chart-default-dark.css');
                } else {
                    ss.attr('href', '/css/chart-default.css');
                }
                chart.render();
            });

            chart.kb_listener = kb_listener;

            cb();
        }

    ], function(err) {
        if (err) return console.error(err);
    });

}); // requirejs
