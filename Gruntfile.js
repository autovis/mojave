'use strict';

module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        bowerRequirejs: {
            client: {
                rjsConfig: 'remote/rjs-config.js',
                options: {
                    baseUrl: 'common/'
                },
                dest: 'remote/bower.js'
            },
            server: {
                rjsConfig: 'local/rjs-config.js',
                options: {
                    baseUrl: 'common/'
                },
                dest: 'local/bower.js'
            }
        }
    });

    grunt.loadNpmTasks('grunt-bower-requirejs');

    grunt.registerTask('bower', ['bowerRequirejs']);
    grunt.registerTask('default', ['bower']);
};
