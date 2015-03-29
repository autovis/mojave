var path = require('path');
var async = require('async');
var _ = require('lodash');
var bowerRequireJS = require('bower-requirejs');
var requirejs = require("requirejs");

var rjs_config = {
    baseUrl: "common",

    out: 'remote/bower-pkg.js',

    shim: {
        'simple-statistics': {
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
        }
    },
    nodeRequire: require
};

async.waterfall([

    // add `paths` for Bower modules to RequireJS config
    function(cb) {
        console.log(1);
        bowerRequireJS(rjs_config, function(bower_config) {
            rjs_config = _.extend(rjs_config, bower_config);
            process.stdout.write(JSON.stringify(rjs_config,null,4)+"\n");
            cb();
        });
    },
    function(cb) {
        console.log(2);
        requirejs.optimize(rjs_config, function(build_output) {
            console.log("build_output:", build_output);
            cb();
        });
    }

], function(err) {
    if (err) {
        console.error(err);
        process.exit(err.code || 1);
    } else {
        process.exit();
    }
})

/*
http://bower.io/docs/api/#programmatic-api
https://github.com/yeoman/bower-requirejs
http://stackoverflow.com/questions/26295693/deploy-with-r-js-and-bower
http://requirejs.org/docs/optimization.html
*/
