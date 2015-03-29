var colvis;

requirejs(['socketio','underscore','async','d3','keypress','stream','indicator_collection', 'charting/colvis_chart'],
    function(io, _, async, d3, keypress, Stream, IndicatorCollection, ColvisChart) {

    var socket = io('http://localhost/');
    var listener = new keypress.Listener();
    var chart_config;

    // UI events
    var on_resize = function() {
        var vport = get_viewport();
        if (chart.svg) chart.svg
            .attr("width", vport[0]-3)
            .attr("height", vport[1]-3)
        chart.render();
    };

    async.auto({

        // Initialize input stream
        input_stream: function(cb) {
            cb();
        },

        // Create, initialize chart
        init_chart: ['input_stream', function(cb) {
            chart = new ColvisChart(d3.select("#chart"));
            chart.init(function(err) {
                if (err) return cb(err);
                chart.render();
                cb();
            });
            //d3.select(window).on('resize', on_resize);
        }],

        keypress: ['init_chart', function(cb) {
            cb();
        }],

        finish: ['keypress', function(cb) {
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
