var _ = require("underscore");
var path = require("path");
var requirejs = require("requirejs").config({
    baseUrl: path.join(__dirname, "../common"),
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

// -------------------------------------------------------------

var ind = {};
// tup[0]
ind.input_streams = [
    new Stream("1", {type: "tick"}),
    new Stream("1", {type: "bar"})
];
// tup[1]
ind.input = ['tick', 'bar?'];
// tup[2]
ind.synch = ['a'];
/*

[tick, bar]
[tick, bar*]
[tick, bar?]
[tick, bar?, bar?]

*/

(function() {
    ///
    var repeat = null;
    var zipped = _.zip(ind.input_streams, _.isArray(ind.input) ? ind.input : [ind.input], _.isArray(ind.synch) ? ind.synch : []);
    _.each(zipped, function(tup, idx) {
        var optional = false;
        if (_.last(tup[1]) === "*" || _.last(tup[1]) === "+") {
            if (_.last(tup[1]) === "*") optional = true;
            tup[1] = _.initial(tup[1]).join("");
            repeat = {type: tup[1], synch: tup[2]};
        } else if (_.last(tup[1]) === "?") {
            tup[1] = _.initial(tup[1]).join("");
            optional = true;
        } else if (tup[1] === undefined && repeat !== null) {
            tup[1] = repeat.type;
            tup[2] = repeat.synch;
        }

        // do checks
        if (tup[0] !== undefined) { // if stream is provided
            if (tup[1] === undefined) throw new Error(ind.name + ": Found unexpected input #"+(idx+1)+" of type '"+tup[0].type+"'");
            else { // if indicator enforces type-checking for this input
                if (!tup[0].hasOwnProperty("type")) throw new Error(ind.name + ": No type is defined for input #"+(idx+1)+" to match '"+tup[1]+"'");
                if (!stream_types.isSubtypeOf(tup[0].type, tup[1])) throw new Error(ind.name + ": Input #"+(idx+1)+" type '"+tup[0].type+"' is not a subtype of '"+tup[1]+"'");
            }
        } else {
            if (!optional) throw new Error(ind.name + ": No stream provided for required input #"+(idx+1)+" of type '"+tup[1]+"'");
        }
    });
    // if input stream synchronization is defined, replace with one expanded with respect to wildcards
    if (ind.synch) ind.synch = _.pluck(zipped, 2);
    ///
})();


console.log("======================================================");
console.log(ind.synch);
console.log("finished.");
