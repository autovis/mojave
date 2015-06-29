var path = require('path');
var requirejs = require('requirejs');

requirejs.config({
    baseUrl: '/home/ubuntu/workspace/common',
    shim: {
        jquery: {
            exports: '$'
        },
        underscore: {
            exports: '_'
        },
        socketio: {
            exports: 'io'
        },
        keypress: {
            exports: 'keypress'
        },
        simple_statistics: {
            exports: 'ss'
        },
        sylvester: {
            exports: 'Matrix',
            init: function () {
return {
Matrix: Matrix,
Vector: Vector
}
}
        },
        jsep: {
            exports: 'jsep'
        }
    },
    paths: {
        Keypress: 'bower_components/Keypress/keypress-2.1.0.min',
        async: 'bower_components/async/lib/async',
        convnet: 'bower_components/convnet/index',
        d3: 'bower_components/d3/d3',
        eventemitter2: 'bower_components/eventemitter2/lib/eventemitter2',
        jsep: 'bower_components/jsep/build/jsep',
        lodash: 'bower_components/lodash/lodash',
        machina: 'bower_components/machina/lib/machina',
        moment: 'bower_components/moment/moment',
        requirejs: 'bower_components/requirejs/require',
        'simple-statistics': 'bower_components/simple-statistics/src/simple_statistics',
        sylvester: 'bower_components/sylvester/sylvester',
        'node-uuid': 'bower_components/node-uuid/uuid',
        jquery: 'bower_components/jquery/dist/jquery',
        'jquery-ui-layout-min': 'bower_components/jquery-ui-layout-min/jquery.layout.min',
        'jquery-ui': 'bower_components/jquery-ui/jquery-ui',
        spin: 'bower_components/spin.js/spin'
    },
    packages: [

    ]
});
