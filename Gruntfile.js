// Task configurations
module.exports = function(grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('manifest.json'),
        bumpup: {
            options: {
                updateProps: {
                    pkg: 'manifest.json'
                }
            },
            files: ['manifest.json', 'package.json']
        },
        release: {
            options: {
                bump: false,
                file: 'manifest.json',
                additionalFiles: ['package.json'],
                push: false,
                pushTags: false,
                npm: false,
                tagName: 'v-<%= version %>',
                commitMessage: 'Release <%= version %>',
                tagMessage: 'Release <%= version %>'
            }
        },

        zip: {
            'long-format': {
                src: ['css/**', 'img/**', '*.js*', '*.css', '*.md', '*.html', 'LICENSE', '!Gruntfile.js', '!package.json'],
                dest: 'builds/<%= pkg.name + "-" + pkg.version %>.zip'
            }
        },
        exec: {
            fork_release: 'git checkout -b release/<%= pkg.version %>',
            push_release: 'git push origin release/<%= pkg.version %>'
        },
        webstore_upload: {
            "accounts": {
                "default": {
                    publish: true,
                    client_id: process.env.ChromeAPI_clientId,
                    client_secret: process.env.ChromeAPI_clientSecret,
                    refresh_token: process.env.ChromeAPI_refreshToken
                },
                "defaultNoPublish": {
                    publish: false,
                    client_id: process.env.ChromeAPI_clientId,
                    client_secret: process.env.ChromeAPI_clientSecret,
                    refresh_token: process.env.ChromeAPI_refreshToken
                },
            },
            "extensions": {
                "StoPlay": {
                    appID: process.env.extensionId,
                    zip: 'builds/<%= pkg.name + "-" + pkg.version %>.zip'      
                }
            },
            onComplete: function(result) {
                console.log('webstore_upload result', result);
                var firstResult = result[0];
                if (firstResult.success !== true) {
                    grunt.fail.fatal(firstResult.errorMsg);
                }
            }
        }
    });

    // Loading the plugins
    grunt.loadNpmTasks('grunt-exec');
    grunt.loadNpmTasks('grunt-bumpup');
    grunt.loadNpmTasks('grunt-release');
    grunt.loadNpmTasks('grunt-zip');
    grunt.loadNpmTasks('grunt-webstore-upload');

    // Alias task for release
    grunt.registerTask('makeRelease', function (type) {
        type = type ? type : 'patch';     // Default release type
        grunt.task.run('bumpup:' + type);
        grunt.task.run('exec:fork_release');
        grunt.task.run('release');
        grunt.task.run('exec:push_release');
    });

    grunt.registerTask('default', []);
    grunt.registerTask('build', ['makeRelease']);
    grunt.registerTask('pack', ['zip']);
    grunt.registerTask('deploy', ['pack', 'webstore_upload']);
}
