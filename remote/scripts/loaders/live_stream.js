'use strict';

var chart;
var dpclient;
var stream = {};
var conns = [];
var paused = false;

var ds = datasource.split(':');
var dsmod = ds[0];
var instrument = ds[1];
var timeframe = ds[2] || 'm5';

var htf = 'm30';

requirejs(['dataprovider', 'lodash', 'async', 'd3', 'Keypress', 'stream', 'charting/chart'], function(dataprovider, _, async, d3, keypress, Stream, Chart) {

    var listener = new keypress.Listener();

    // Show loading msg
    d3.select('body').append('div')
        .attr('id', 'loading_msg')
        .style('padding', '10px')
        .style('font', '24px Tahoma bold')
        .style('font-style', 'italic')
        .text('Loading chart, please wait...');

    // UI events
    var on_viewport_resize = function() {
        var vport = get_viewport();
        if (chart.svg) {
            chart.svg
                .attr('width', vport[0] - 3)
                .attr('height', vport[1] - 3);
        }
    };

    async.series([

        // Initialize input streams
        function(cb) {
            stream.tick = new Stream(200, '<' + datasource + '>', {is_root: true, instrument: instrument, tf: 'T', type: 'object'});
            stream.ltf = new Stream(200, '<' + datasource + '>', {is_root: true, instrument: instrument, tf: timeframe, type: 'object'});
            stream.htf = new Stream(200, '<' + datasource + '>', {is_root: true, tf: htf, type: 'object'});
            cb();
        },

        // Create, initialize chart
        function(cb) {
            chart = new Chart(chart_setup, [stream.tick, stream.ltf, stream.htf], d3.select('#chart'));
            chart.init(function(err) {
                if (err) return cb(err);
                cb();
            });
            d3.select(window).on('resize', on_viewport_resize);
        },

        /////////////////////////////////////////////////////////////////////////////////
        // Subscribe to data

        function(cb) {
            dpclient = dataprovider.register();
            dpclient.on('error', function(err) {
                console.error(err);
            });
            cb();
        },

        /*
        function(cb) {
            var htf_conn = dpclient.connect('fetch', [dsmod, instrument, htf].join(':'));
            htf_conn.on('data', function(packet) {
                stream.htf.next();
                stream.htf.set(packet.data);
                stream.htf.emit('update', {timeframes: [htf]});
            });
            htf_conn.on('end', function() {
                cb();
            });
            conns.push(htf_conn);
        },
        */

        function(cb) {
            var ltf_conn = dpclient.connect('fetch', [dsmod, instrument, timeframe, 300].join(':'));
            ltf_conn.on('data', function(packet) {
                stream.ltf.next();
                stream.ltf.set(packet.data);
                stream.ltf.emit('update', {timeframes: [timeframe]});
            });
            ltf_conn.on('end', function() {
                cb();
            });
            conns.push(ltf_conn);
        },

        function(cb) {
            chart.render();
            on_viewport_resize();
            d3.select('#loading_msg').remove();

            var tick_conn = dpclient.connect('subscribe', [dsmod, instrument].join(':'));
            tick_conn.on('data', function(packet) {
                stream.tick.next();
                stream.tick.set(packet.data);
                stream.tick.emit('update', {timeframes: ['T']});
            });
            conns.push(tick_conn);

            cb();
        },

        /////////////////////////////////////////////////////////////////////////////////
        // Set up keyboard listeners

        function(cb) {
            var barwidth_inc = 3;
            listener.simple_combo(']', function() {
                if (chart.config.bar_width >= 50) return;
                chart.config.bar_width =  Math.floor(chart.config.bar_width / barwidth_inc) * barwidth_inc + barwidth_inc;
                chart.config.bar_padding = Math.ceil(Math.log(chart.config.bar_width) / Math.log(2));
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
                if (chart.config.bar_width <= barwidth_inc) return;
                chart.config.bar_width =  Math.floor(chart.config.bar_width / barwidth_inc) * barwidth_inc - barwidth_inc;
                chart.config.bar_padding = Math.ceil(Math.log(chart.config.bar_width) / Math.log(2));
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
                if (ss.attr('href') === '/css/chart-default.css')
                    ss.attr('href', '/css/chart-default-dark.css');
                else
                    ss.attr('href', '/css/chart-default.css');
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
