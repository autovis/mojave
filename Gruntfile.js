module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        bowerRequirejs: {
            client: {
                rjsConfig: 'remote/rjs-config.js',
                options: {
                    baseUrl: "remote/"    
                },
                dest: 'remote/bower.js'
            },
            server: {
                rjsConfig: 'local/rjs-config.js',
                dest: 'local/bower.js'
            }
        }
    });

    grunt.loadNpmTasks('grunt-bower-requirejs');

    grunt.registerTask('bower', ['bowerRequirejs'])
    grunt.registerTask('default', ['bower']);
};