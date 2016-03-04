'use strict';

var chart;
var dpclient;
var conns = [];
var paused = false;

var ds = datasource.split(':');
var dsmod = ds[0];
var instrument = ds[1];
var timeframe = ds[2] || 'm5';

var htf = 'm30';

requirejs(['lodash', 'async', 'd3', 'Keypress', 'stream', 'charting/chart'], function(_, async, d3, keypress, Stream, Chart) {

    var chart_options = {
        source: ds[0],
        instrument: ds[1],
        timeframe: ds[2],
        count: 150,
        //range: ['2016-02-24 18:50', '2016-02-24 20:00'],
        vars: {
            ltf: ds[2],
            htf: 'H1'
        },
        setup: chart_setup,
        container: d3.select('#chart'),
        subscribe: true
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
            var vport = get_viewport();
            if (chart.svg) {
                chart.svg
                    .attr('width', chart.width)
                    .attr('height', chart.height);
            }
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
                var comp_y = 0;
                _.each(chart.components, function(comp) {
                    comp.y = comp_y;
                    comp.resize();
                    comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
                });
                chart.save_transform();
                chart.render();
            });
            listener.simple_combo('[', function() {
                if (chart.setup.bar_width <= barwidth_inc) return;
                chart.setup.bar_width =  Math.floor(chart.setup.bar_width / barwidth_inc) * barwidth_inc - barwidth_inc;
                chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
                var comp_y = 0;
                _.each(chart.components, function(comp) {
                    comp.y = comp_y;
                    comp.resize();
                    comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
                });
                chart.save_transform();
                chart.render();
            });
            listener.simple_combo('.', function() {
                chart.selectedComp.height = Math.min(chart.selectedComp.height + 20, 1000);
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
            listener.simple_combo('p', function() {
                if (paused) {
                    _.each(conns, function(conn) {
                       if (!conn.closed) conn.resume();
                    });
                    d3.select('body').style('background', null);
                    paused = false;
                } else if (!paused) {
                    _.each(conns, function(conn) {
                       if (!conn.closed) conn.pause();
                    });
                    d3.select('body').style('background', '#200');
                    paused = true;
                }
            });
            cb();
        }

    ], function(err) {
        if (err) return console.error(err);
    });

}); // requirejs

// http://stackoverflow.com/a/2035211/880891
function get_viewport() {
    var viewPortWidth;
    var viewPortHeight;
    if (typeof window.innerWidth != 'undefined') {
        // the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
        viewPortWidth = window.innerWidth;
        viewPortHeight = window.innerHeight;
    } else if (typeof document.documentElement != 'undefined'
        && typeof document.documentElement.clientWidth !=
        'undefined' && document.documentElement.clientWidth !== 0) {
        // IE6 in standards compliant mode (i.e. with a valid doctype as the first line in the document)
        viewPortWidth = document.documentElement.clientWidth;
        viewPortHeight = document.documentElement.clientHeight;
    } else { // older versions of IE
        viewPortWidth = document.getElementsByTagName('body')[0].clientWidth;
        viewPortHeight = document.getElementsByTagName('body')[0].clientHeight;
    }
    return [viewPortWidth, viewPortHeight];
}
