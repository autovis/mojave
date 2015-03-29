var fs = require("fs");
var path = require("path");

var requirejs = require("requirejs").config({

    baseUrl: path.join(__dirname, "common"),

    shim: {
        'cbuffer': {
            exports: 'CBuffer'
        },
        'simple-statistics': {
            exports: 'ss'
        }
    },

    paths: {
        'underscore': 'lib/underscore',
        'async': 'lib/async',
        'cbuffer': 'lib/cbuffer',
        'd3': 'lib/d3_stripped',
        'machina': 'lib/machina',
        'moment': 'lib/moment.min',
        'simple-statistics': 'lib/simple-statistics',
        'eventemitter2': 'lib/eventemitter2'
    },

    nodeRequire: require
});

var _ = requirejs("underscore");
var Stream = requirejs("stream");
var stream_types = requirejs("config/stream_types");

var stream = Stream("test", {type:[["subtest","uint"],["wasabi", ["a", "b"]]]});

var substream = stream.substream("subtest");
var b = stream.substream("wasabi").substream("b")

for (var i=0;i<=100;i++) {
    stream.next();
    substream.set(1000+i);
    b.set("xxx")

    console.log(stream.get(0));
}

console.log("End.");
