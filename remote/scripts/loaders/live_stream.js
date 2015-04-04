var tick_stream;
var bar_stream;
var chart;

var paused = false;
var pause_cb = null;

// TODO: dynamic timeframe
var ds = datasource.split(":");
var instrument = ds[1];
var timeframe = ds[2];
if (!timeframe) throw new Error("Datasource must specify a timeframe");

requirejs(['socketio','underscore','async','d3','keypress','stream','indicator_collection','charting/chart'],
    function(io, _, async, d3, keypress, Stream, IndicatorCollection, Chart) {

    var socketio_url = window.location.href.match(/^(https?:\/\/[^\/]+\/?)/);
    var socket = io(socketio_url[0]);
    var listener = new keypress.Listener();
    var chart_config;

    // Show loading msg
    d3.select("body").append("div")
        .attr("id", "loading_msg")
        .style("padding", "10px")
        .style("font", "24px Tahoma bold")
        .style("font-style", "italic")
        .text("Loading chart, please wait...")

    // UI events
    var on_resize = function() {
        var vport = get_viewport();
        if (chart.svg) chart.svg
            .attr("width", vport[0]-3)
            .attr("height", vport[1]-3)
    };

    // data processing queue
    var task_queue = async.queue(function(packet, cb2) {
        /*
        if (packet.type === "tick") {
            tick_stream.next();
            tick_stream.set(packet.data);
            tick_stream.emit("update", {timeframes: ["T"]});
        } else
        */
        if (packet.type === "candle") {
            cndl_stream.next()
            cndl_stream.set(packet.data);
            cndl_stream.emit("update", {timeframes: [timeframe]});
            //console.log(packet);
        } else {
            console.log("Unknown packet type: " + packet.type);
        }

        //if (packet.type === "tick" && !chart.rendered) {
        if (!chart.rendered) {
            chart.render();
            on_resize();
            d3.select("#loading_msg").remove();
        }
        setTimeout(cb2, 0);
    });

    async.auto({

        // Initialize input stream
        input_stream: function(cb) {
            tick_stream = new Stream(1000, "<"+datasource+">", {is_root: true, instrument: instrument, tf: "T", type: "object"});
            cndl_stream = new Stream(1000, "<"+datasource+">", {is_root: true, instrument: instrument, tf: timeframe, type: "object"});
            d1_stream = new Stream(10, "<"+datasource+">", {is_root: true, tf: "D1", type: "object"});
            cb();
        },

        // Create, initialize chart
        init_chart: ['input_stream', function(cb) {
            chart = new Chart(chart_setup, [tick_stream, cndl_stream, d1_stream], d3.select("#chart"));
            chart.init(function(err) {
                if (err) return cb(err);
                cndl_stream.tf = chart.config.timeframe;
                cb();
            });
            d3.select(window).on('resize', on_resize);
        }],

        keypress: ['init_chart', function(cb) {
            var barwidth_inc = 3;
            listener.simple_combo("]", function() {
                if (chart.config.bar_width >= 50) return;
                chart.config.bar_width =  Math.floor(chart.config.bar_width/barwidth_inc)*barwidth_inc+barwidth_inc;
                chart.config.bar_padding = Math.ceil(Math.log(chart.config.bar_width)/Math.log(2));
                var comp_y = 0;
                _.each(chart.components, function(comp) {
                    comp.y = comp_y;
                    comp.resize();
                    comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
                });
                chart.save_transform();
                chart.render();
            });
            listener.simple_combo("[", function() {
                if (chart.config.bar_width <= barwidth_inc) return;
                chart.config.bar_width =  Math.floor(chart.config.bar_width/barwidth_inc)*barwidth_inc-barwidth_inc;
                chart.config.bar_padding = Math.ceil(Math.log(chart.config.bar_width)/Math.log(2));
                var comp_y = 0;
                _.each(chart.components, function(comp) {
                    comp.y = comp_y;
                    comp.resize();
                    comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
                });
                chart.save_transform();
                chart.render();
            });
            listener.simple_combo(".", function() {
                chart.selectedComp.height = Math.min(chart.selectedComp.height + 20, 1000)
                if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height,0]);
                chart.on_comp_resize(chart.selectedComp);
            });
            listener.simple_combo(",", function() {
                chart.selectedComp.height = Math.max(chart.selectedComp.height - 20, 20);
                if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height,0]);
                chart.on_comp_resize(chart.selectedComp);
            });
            listener.simple_combo("q", function() {
                var ss = d3.select("#theme-ss");
                if (ss.attr("href") == "/css/chart-default.css")
                    ss.attr("href", "/css/chart-default-dark.css");
                else
                    ss.attr("href", "/css/chart-default.css");
                chart.render();
            });
            listener.simple_combo("p", function() {
                if (paused) {
                    task_queue.resume();
                    d3.select("body").style("background", null);
                    paused = false;
                } else if (!paused) {
                    task_queue.pause();
                    d3.select("body").style("background", "#200");
                    paused = true;
                }
            });
            cb();
        }],

        // load data from datasource
        load_data: ['keypress', function(cb) {
            socket.emit('subscribe', datasource);
            socket.on('data', function(packet) {
                if (packet.datasource == datasource) {
                    task_queue.push(packet);
                }
            })
            socket.on('end', function(ds) {
                console.log("Received 'end' event for: "+ds);
            });
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

// http://stackoverflow.com/a/2035211/880891
function get_viewport() {

    var viewPortWidth;
    var viewPortHeight;

    // the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
    if (typeof window.innerWidth != 'undefined') {
        viewPortWidth = window.innerWidth,
        viewPortHeight = window.innerHeight
    }

    // IE6 in standards compliant mode (i.e. with a valid doctype as the first line in the document)
    else if (typeof document.documentElement != 'undefined'
        && typeof document.documentElement.clientWidth !=
        'undefined' && document.documentElement.clientWidth != 0) {
        viewPortWidth = document.documentElement.clientWidth,
        viewPortHeight = document.documentElement.clientHeight
    }

    // older versions of IE
    else {
        viewPortWidth = document.getElementsByTagName('body')[0].clientWidth,
        viewPortHeight = document.getElementsByTagName('body')[0].clientHeight
    }
    return [viewPortWidth, viewPortHeight];
}
