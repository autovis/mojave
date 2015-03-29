var input_stream;
var chart;

// overriding URL param datasource
var datasource = "csv:chart_test.csv";

var timeframe = "m5";

var paused = false;
var pause_cb = null;

requirejs(['socketio','underscore','async','d3','keypress','stream','indicator_collection','charting/chart'],
    function(io, _, async, d3, keypress, Stream, IndicatorCollection, Chart) {

    var socket = io('http://localhost');
    var listener = new keypress.Listener();
    var chart_config;

    // Show loading msg
    d3.select("body").append("div")
        .attr("id", "loading_msg")
        .style("padding", "10px")
        .style("font", "24px Tahoma bold")
        .style("font-style", "italic")
        .text("Loading chart, hold on...")

    async.auto({

        // Initialize input stream
        input_stream: function(cb) {
            tick_stream = new Stream(1000, "<"+datasource+">", {is_root: true, tf: "T", type: "object"});
            bar_stream = new Stream(1000, "<"+datasource+">", {is_root: true, tf: "m5", type: "object"});
            cb();
        },

        // Create, initialize chart
        init_chart: ['input_stream', function(cb) {
            chart = new Chart(chart_setup, [tick_stream, bar_stream], d3.select("#tail-chart"));
            chart.init(cb);
        }],

        keypress: ['init_chart', function(cb) {
            var barwidth_inc = 3;
            listener.simple_combo("]", function() {
                if (chart.config.bar_width >= 50) return;
                chart.config.bar_width =  Math.floor(chart.config.bar_width/barwidth_inc)*barwidth_inc+barwidth_inc;
                chart.config.bar_padding = Math.ceil(Math.log(chart.config.bar_width)/Math.log(2));
                chart.render();
            });
            listener.simple_combo("[", function() {
                if (chart.config.bar_width <= barwidth_inc) return;
                chart.config.bar_width =  Math.floor(chart.config.bar_width/barwidth_inc)*barwidth_inc-barwidth_inc;
                chart.config.bar_padding = Math.ceil(Math.log(chart.config.bar_width)/Math.log(2));
                chart.render();
            });
            listener.simple_combo("q", function() {
                var ss = d3.select("#theme-ss");
                if (ss.attr("href") == "/css/chart-default.css")
                    ss.attr("href", "/css/chart-default-dark.css");
                else
                    ss.attr("href", "/css/chart-default.css");
            });
            listener.simple_combo("p", function() {
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
            var count = 0;
            var task_queue = async.queue(function(packet, cb2) {
                tick_stream.next();
                tick_stream.set(packet.data);
                tick_stream.emit("update", {timeframes: [timeframe]});
                count++;
                /*
                if (paused) {
                    pause_cb = cb2;
                    cb2 = function() {}
                }
                */
                if (count > 0) {
                    if (!chart.rendered) {
                        chart.render();
                        d3.select("#loading_msg").remove();
                    } else {
                        //chart.update();
                    }
                    setTimeout(cb2, 0);
                } else {
                    cb2();
                }
            });
            socket.emit('play', datasource);
            socket.on('data', function(packet) {
                if (packet.datasource == datasource) {
                    task_queue.push(packet);
                }
            })
        }],

        finish: ['load_data', function(cb) {
            console.log("Finished.");
            cb();
        }]

    }, function(err, results) {
        if (err) {
            console.error(err);
        }
    });

}) // requirejs
