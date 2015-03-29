"use strict";

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
        'simple_statistics': {
            exports: 'ss'
        },
        'sylvester': {
            exports: 'Matrix',
            init: function() {
                return {
                    Matrix: Matrix,
                    Vector: Vector
                }
            }
        },
        'jsep': {
            exports: 'jsep'
        }
    },

    paths: {
        'socketio': '/socket.io/socket.io',
        'jquery': '/scripts/lib/jquery',
        'underscore': '/scripts/lib/underscore',
        'async': '/scripts/lib/async',
        'd3': '/scripts/lib/d3',
        'machina': '/scripts/lib/machina',
        'jsep': '/scripts/lib/jsep.min',
        'eventemitter2': '/scripts/lib/eventemitter2',
        'keypress': '/scripts/lib/keypress.min',
        'moment': '/scripts/lib/moment.min',
        'simple_statistics': '/scripts/lib/simple_statistics',
        'convnetjs': '/scripts/lib/convnet',
        'sylvester': '/scripts/lib/sylvester.src'
    }
})
