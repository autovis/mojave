'use strict';

requirejs.config({

    baseUrl: '/scripts',

    shim: {
        'jquery': {
            exports: '$'
        },
        'underscore': {
            exports: '_'
        },
        'socketio': {
            exports: 'io'
        },
        'keypress': {
            exports: 'keypress'
        },
        'simple-statistics': {
            exports: 'ss'
        },
        'sylvester': {
            exports: 'Matrix',
            init: function() {
                return {
                    Matrix: Matrix,
                    Vector: Vector
                };
            }
        },
        'jsep': {
            exports: 'jsep'
        },
        'uuid': {
            exports: 'uuid'
        }
    },

    paths: {
        'socketio': '/socket.io/socket.io',
        /*
        'jquery': '/scripts/lib/jquery',
        'async': '/scripts/lib/async',
        'd3': '/scripts/lib/d3',
        'machina': '/scripts/lib/machina',
        'jsep': '/scripts/lib/jsep.min',
        'eventemitter2': '/scripts/lib/eventemitter2',
        'keypress': '/scripts/lib/keypress.min',
        'moment': '/scripts/lib/moment.min',
        'simple_statistics': '/scripts/lib/simple_statistics',
        'convnetjs': '/scripts/lib/convnet',
        'sylvester': '/scripts/lib/sylvester.src',
        'node-uuid': 'bower_components/node-uuid/uuid',
        'lodash': 'bower_components/lodash/lodash'
        */
        underscore: '/scripts/lib/underscore',

        Keypress: 'bower_components/Keypress/keypress-2.1.0.min',
        async: 'bower_components/async/lib/async',
        convnet: 'bower_components/convnet/index',
        d3: 'bower_components/d3/d3',
        eventemitter2: 'bower_components/eventemitter2/lib/eventemitter2',
        jsep: 'bower_components/jsep/build/jsep',
        lodash: 'bower_components/lodash/lodash',
        lokijs: 'bower_components/lokijs/build/lokijs.min',
        machina: 'bower_components/machina/lib/machina',
        moment: 'bower_components/moment/moment',
        requirejs: 'bower_components/requirejs/require',
        'simple-statistics': 'bower_components/simple-statistics/src/simple_statistics',
        sylvester: 'bower_components/sylvester/sylvester',
        'node-uuid': 'bower_components/node-uuid/uuid',
        jquery: 'bower_components/jquery/dist/jquery',
        'jquery-ui-layout-min': 'bower_components/jquery-ui-layout-min/jquery.layout.min',
        'jquery-ui': 'bower_components/jquery-ui/jquery-ui'
    }
});
