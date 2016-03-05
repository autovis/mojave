'use strict';

var chart;

requirejs(['lodash', 'async', 'd3', 'Keypress', 'moment-timezone', 'stream', 'charting/chart'], function(_, async, d3, keypress, moment, Stream, Chart) {

    var chart_options = {
        source: 'oanda',
        instrument: instrument,
        timeframe: 'm5',
        range: [date + ' 03:00', date + ' 11:00'],
        vars: {
            ltf: 'm5',
            htf: 'H1'
        },
        setup: '2016-02_chart',
        container: d3.select('#chart'),
        subscribe: false
    };

    var listener = new keypress.Listener();

    // Show loading msg
    d3.select('body').append('div')
        .attr('id', 'loading_msg')
        .style('padding', '10px')
        .style('font', '24px Tahoma bold')
        .style('font-style', 'italic')
        .text('Loading chart, please wait...');

    async.series([

        // Create, initialize chart
        function(cb) {
            if (_.isArray(chart_options.range)) {
                chart_options.range = _.map(chart_options.range, date => moment(date).format());
            }
            console.log(chart_options);
            chart = new Chart(chart_options);
            chart.init(function(err) {
                if (err) return cb(err);
                cb();
            });
        },

        /////////////////////////////////////////////////////////////////////////////////
        // Subscribe to data

        function(cb) {
            chart.render();
            d3.select('#loading_msg').remove();
            cb();
        },

        /////////////////////////////////////////////////////////////////////////////////
        // Set up keyboard listeners

        function(cb) {
            var barwidth_inc = 3;
            listener.simple_combo(']', function() {
                if (chart.setup.bar_width >= 50) return;
                chart.setup.bar_width =  Math.floor(chart.setup.bar_width / barwidth_inc) * barwidth_inc + barwidth_inc;
                chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
                chart.resize();
                chart.save_transform();
                chart.render();
            });
            listener.simple_combo('[', function() {
                if (chart.setup.bar_width <= barwidth_inc) return;
                chart.setup.bar_width =  Math.floor(chart.setup.bar_width / barwidth_inc) * barwidth_inc - barwidth_inc;
                chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
                chart.resize();
                chart.save_transform();
                chart.render();
            });
            listener.simple_combo('.', function() {
                chart.selectedComp.height = Math.min(chart.selectedComp.height + 20, 2000);
                if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height, 0]);
                chart.on_comp_resize(chart.selectedComp);
            });
            listener.simple_combo(',', function() {
                chart.selectedComp.height = Math.max(chart.selectedComp.height - 20, 20);
                if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height, 0]);
                chart.on_comp_resize(chart.selectedComp);
            });
            listener.simple_combo('q', function() {
                var ss = d3.select('#theme-ss');
                if (ss.attr('href') === '/css/chart-default.css') {
                    ss.attr('href', '/css/chart-default-dark.css');
                } else {
                    ss.attr('href', '/css/chart-default.css');
                }
                chart.render();
            });
            cb();
        }

    ], function(err) {
        if (err) return console.error(err);
    });

}); // requirejs
