var input_stream;
var chart;

var timeframe = "m5";

requirejs(['underscore','async','d3','stream','indicator_collection','charting/chart'],
    function(_, async, d3, Stream, IndicatorCollection, Chart) {

    if (theme=="dark")
        d3.select("body").style("background-image", "url(/img/blackorchid.png)")
    else
        d3.select("body").style("background-image", "url(/img/sandy2.png)")

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
            input_stream = new Stream(1000, "<"+datasource+">", {is_root: true, tf: timeframe, type: "object"});
            cb();
        },

        // Create, initialize chart
        init_chart: ['input_stream', function(cb) {
            chart = new Chart(chart_setup, input_stream, d3.select("#fixed-chart"));
            chart.init(cb);
        }],

        // load data from datasource
        load_data: ['init_chart', function(cb) {
            d3.csv("/data/csv/"+datasource, function(m5data) {
                m5data.forEach(function(rec) {
                    input_stream.next();
                    input_stream.set(rec);
                    input_stream.emit("update", {timeframes: [timeframe]});
                    //chart.update();
                });
                cb();
            });
        }],

        // display chart
        render_chart: ['load_data', function(cb) {
            d3.select("#loading_msg").remove();
            chart.render();
            cb();
        }]

    }, function(err, results) {
        if (err) {
            console.error(err);
        }
    });

}) // requirejs
