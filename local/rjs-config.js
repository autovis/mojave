require.config({
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
    Keypress: '../common/bower_components/Keypress/keypress-2.1.0.min',
    async: '../common/bower_components/async/lib/async',
    convnet: '../common/bower_components/convnet/index',
    d3: '../common/bower_components/d3/d3',
    eventemitter2: '../common/bower_components/eventemitter2/lib/eventemitter2',
    jsep: '../common/bower_components/jsep/build/jsep',
    lodash: '../common/bower_components/lodash/lodash',
    machina: '../common/bower_components/machina/lib/machina',
    moment: '../common/bower_components/moment/moment',
    requirejs: '../common/bower_components/requirejs/require',
    'simple-statistics': '../common/bower_components/simple-statistics/src/simple_statistics',
    sylvester: '../common/bower_components/sylvester/sylvester'
  },
  packages: [

  ]
});
