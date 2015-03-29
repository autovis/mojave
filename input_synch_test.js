var _ = require("underscore");
var path = require("path");
var requirejs = require("requirejs").config({
    baseUrl: path.join(__dirname, "common"),
    nodeRequire: require,
    paths: {
        'underscore': 'lib/underscore',
        'async': 'lib/async',
        'd3': 'lib/d3_stripped',
        'machina': 'lib/machina',
        'moment': 'lib/moment.min',
        'simple-statistics': 'lib/simple-statistics',
        'convnetjs': 'lib/convnet.js',
        'eventemitter2': 'lib/eventemitter2'
    }
});

var stream_types = requirejs("config/stream_types");
var Stream = requirejs("stream");
var EventEmitter2 = requirejs("eventemitter2");

// -------------------------------------------------------------

var ind = {};
ind.input_streams = [
    new Stream("1", {type: "tick",            instrument: "eurusd", tf: "m5"}),
    new Stream("2", {type: "dual_candle_bar", instrument: "eurusd", tf: "m5"}),
    new Stream("3", {type: "dual_candle_bar", instrument: "eurusd", tf: "m30"}),
    new Stream("4", {type: "tick",            instrument: "gbpusd", tf: "m5"}),
    new Stream("5", {type: "dual_candle_bar", instrument: "gbpusd", tf: "m5"}),
    new Stream("6", {type: "dual_candle_bar", instrument: "gbpusd", tf: "m30"}),
    {}
];
//ind.input = ['tick', 'bar', 'bar?'];
ind.synch = ['a', 's0', 's0'];
/*

Default:
All streams whose instrument/timeframe match the first input stream are synchronized,
the rest are passive.

a     -  active; trigger update unconditionally
s<id> -  synchronized; synchronize stream with other in group <id>, defaults to "0"
p     -  passive; never triggers update

*/

(function() {
        ///
        if (ind.synch === undefined) { // set a default if stream event synchronization is not defined
            ind.synch = _.map(ind.input_streams, function(str, idx) {
                // first stream is synchronized with all others of same instrument and tf, rest are passive
                return (idx === 0 || (str instanceof Stream && _.isObject(ind.input_streams[0].instrument) && _.isObject(str.instrument) &&
                    ind.input_streams[0].instrument.id === str.instrument.id && ind.input_streams[0].tf === str.tf)) ? "s0" : "p";
            });
        }

        var synch_groups = {};
        _.each(ind.input_streams, function(stream, idx) {
            var key;
            if (!(stream instanceof Stream) || _.first(ind.synch[idx]) === "p" || ind.synch[idx] === undefined) {
                return; // passive
            } else if (_.first(ind.synch[idx]) === "s") {
                key = ind.synch[idx]; // synchronized
            } else if (_.first(ind.synch[idx]) === "a") {
                key = ind.synch[idx] + "_" + idx; // active
            } else {
                throw new Error("Unrecognized synchronization token: "+ind.synch[idx]);
            }
            //var key = (stream.instrument ? stream.instrument.id : "[null]") + "/" + (stream.tf ? stream.tf : "[null]");
            if (!_.has(synch_groups, key)) synch_groups[key] = {};
            synch_groups[key][idx] = null;

            stream.on("update", function(event) {
                console.log("STR: "+idx+" - "+stream.type+" - "+stream.instrument.id+" - "+stream.tf+" EVENT TFs: "+event.timeframes);
                synch_groups[key][idx] = event && event.timeframes || [];
                if (_.all(_.values(synch_groups[key]))) {
                    //ind.update(_.unique(_.flatten(_.values(synch_groups[key]))), idx);
                    console.log("UPDATE>", _.unique(_.flatten(_.values(synch_groups[key]))), idx);
                    _.each(synch_groups[key], function(val, idx) {synch_groups[key][idx] = null});
                }
            });
        });
        ///
})();

// Fire test events


var str = ind.input_streams;

str[0].emit("update", {timeframes: ["m5"]});
str[0].emit("update", {timeframes: ["m5"]});
str[1].emit("update", {timeframes: ["m30"]});
str[2].emit("update", {timeframes: ["m5", "H1"]});
str[2].emit("update", {timeframes: ["m5", "H1"]});
str[1].emit("update", {timeframes: ["m5", "H1"]});
str[0].emit("update", {timeframes: ["m5"]});

console.log("finished.");
