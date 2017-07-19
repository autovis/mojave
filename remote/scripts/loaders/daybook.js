'use strict';

var tick_stream;
var bar_stream;
var charts;

var paused = false;
var pause_cb = null;

// TODO: dynamic timeframe
var ds = datasource.split(':');
var instrument = ds[1];
var timeframe = ds[2] || 'm5';

requirejs(['socketio', 'underscore', 'async', 'd3', 'keypress', 'stream', 'config/stream_types', 'indicator_collection', 'charting/chart'],
    function(io, _, async, d3, keypress, Stream, stream_types, IndicatorCollection, Chart) {

    var socket = io('http://localhost/');
    var listener = new keypress.Listener();
    var chart_config;

    // Show loading msg
    d3.select('body').append('div')
        .attr('id', 'loading_msg')
        .style('padding', '10px')
        .style('font', '24px Tahoma bold')
        .style('font-style', 'italic')
        .text('Loading chart, hold on...')

    async.auto({

        // Initialize input stream
        input_stream: function(cb) {
            tick_stream = new Stream(1000, '<' + datasource + '>', {is_root: true, instrument: instrument, tf: 'T', type: 'object'});
            cndl_stream = new Stream(1000, '<' + datasource + '>', {is_root: true, instrument: instrument, tf: timeframe, type: 'object'});
            d1_stream = new Stream(10, '<' + datasource + '>', {is_root: true, tf: 'D1', type: 'object'});
            cb();
        },

        // Create, initialize chart
        init_chart: ['input_stream', function(cb) {
            chart = new Chart(chart_template, [tick_stream, cndl_stream, d1_stream], d3.select('#chart'));
            chart.init(function(err) {
                if (err) return cb(err);
                cndl_stream.tf = chart.config.timeframe;
                d1_stream.tf =
                cb();
            });
        }],

        keypress: ['init_chart', function(cb) {
            var barwidth_inc = 3;
            listener.simple_combo(']', function() {
                if (chart.config.bar_width >= 50) return;
                chart.config.bar_width =  Math.floor(chart.config.bar_width / barwidth_inc) * barwidth_inc + barwidth_inc;
                chart.config.bar_padding = Math.ceil(Math.log(chart.config.bar_width) / Math.log(2));
                chart.render();
            });
            listener.simple_combo('[', function() {
                if (chart.config.bar_width <= barwidth_inc) return;
                chart.config.bar_width =  Math.floor(chart.config.bar_width / barwidth_inc) * barwidth_inc - barwidth_inc;
                chart.config.bar_padding = Math.ceil(Math.log(chart.config.bar_width) / Math.log(2));
                chart.render();
            });
            listener.simple_combo('q', function() {
                var ss = d3.select('#theme-ss');
                if (ss.attr('href') == '/css/chart-default.css')
                    ss.attr('href', '/css/chart-default-dark.css');
                else
                    ss.attr('href', '/css/chart-default.css');
                chart.render();
            });
            listener.simple_combo('p', function() {
                var cb = pause_cb;
                if (paused && pause_cb) {
                    paused = false;
                    pause_cb = null;
                    cb();
                } else if (!paused) {
                    paused = true;
                }
            });
            cb();
        }],

        // load data from datasource
        load_data: ['keypress', function(cb) {
            var task_queue = async.queue(function(packet, cb2) {
                if (packet.type === 'tick') {
                    tick_stream.next();
                    tick_stream.set(packet.data);
                    tick_stream.emit('update', {timeframes: ['T']});
                } else if (packet.type === 'candle') {
                    cndl_stream.next();
                    cndl_stream.set(packet.data);
                    cndl_stream.emit('update', {timeframes: [timeframe]});
                    //console.log(packet);
                } else {
                    console.log('Unknown packet type: ' + packet.type);
                }
                /*
                if (paused) {
                    pause_cb = cb2;
                    cb2 = function() {}
                }
                */
                //if (packet.type === 'tick' && !chart.rendered) {
                if (!chart.rendered) {
                    chart.render();
                    d3.select('#loading_msg').remove();
                }
                setTimeout(cb2, 0);
            });
            socket.emit('subscribe', datasource);
            socket.on('data', function(packet) {
                if (packet.datasource === datasource) {
                    task_queue.push(packet);
                }
            });
            socket.on('end', function(ds) {
                console.log("Received 'end' event for: " + ds);
            });
        }],

        finish: ['load_data', function(cb) {
            console.log('Finished.');
            cb();
        }]

    }, function(err, results) {
        if (err) {
            console.error(err);
        }
    });

});
