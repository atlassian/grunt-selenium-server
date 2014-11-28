module.exports = function (grunt) {

  var fs = require('fs');
  var os = require('os');
  var util = require('util');
  var path = require('path');
  var url = require('url');
  var request = require('request');

  /**
   * References running server processes.
   *
   * @type {Object}
   */
  var childProcesses = {};

  grunt.registerMultiTask('download-selenium-server', 'Downloads selenium server', function () {
    var done = this.async();

    var options = this.options({
      downloadUrl: 'https://selenium-release.storage.googleapis.com/2.42/selenium-server-standalone-2.42.2.jar',
      downloadLocation: os.tmpdir()
    });
    grunt.verbose.writeflags(options, 'Options');

    // Where to save jar to.
    var destination = path.join(options.downloadLocation, path.basename(options.downloadUrl));
    grunt.config.set('start-selenium-server.options.standaloneSeleniumServerLocation', destination);
    grunt.log.ok("File location", destination);

    // If it's already there don't download it.
    try {
      var exists = fs.existsSync(destination);
    } catch (err) {
      return done(err);
    }

    if (exists) {
      var stat = fs.statSync(destination);
      if (stat.size > 0) {
        var override = options.override || false;
        if (!override) {
          grunt.log.ok("File is there with size", stat.size);
          return done();
        } else {
          grunt.log.ok("File is there with size", stat.size);
          grunt.log.ok("But override requested, so removing and downloading.");
          try {
            fs.unlinkSync(destination);
            grunt.log.ok("File removed");
          } catch (err) {
            return done(err);
          }
        }
      } else {
        grunt.log.ok("File is there but it's zero size. Keeping with downloading");
      }
    }

    grunt.log.ok('Starting downloading');

    try {
      var writeStream = fs.createWriteStream(destination);
    } catch (err) {
      return done(err);
    }

    writeStream.on('close', function () {
      grunt.log.ok("Saving is complete");
      done();
    });

    writeStream.on('error', function (error) {
      grunt.log.error("There was an error writing to a file", error);
      done(error);
    });

    // Start downloading and showing progress.
    request(options.downloadUrl)
        .on("error", function (err) {
          grunt.log.error("There was a problem with requesting a resource", err);
          done(err);
        })
        .pipe(writeStream);
  });

  /**
   * Start a Selenium server.
   */
  grunt.registerMultiTask('start-selenium-server', 'Start Selenium server.', function () {
    var done = this.async();

    var target = this.target;

    // Set default options.
    var options = this.options({
      serverOptions: {},
      systemProperties: {},
      standaloneSeleniumServerLocation: null
    });

    if(!options.standaloneSeleniumServerLocation){
      done(new Error("standaloneSeleniumServerLocation option is not defined"));
    }

    var args = ['-jar', options.standaloneSeleniumServerLocation];

    // Add additional options to command.
    Object.keys(options.serverOptions).forEach(function (key) {
      args.push('-' + key);
      args.push(options.serverOptions[key]);
    });

    Object.keys(options.systemProperties).forEach(function (key) {
      args.push('-D' + key + '=' + options.systemProperties[key]);
    });

    grunt.verbose.writeflags(options, 'options');
    grunt.verbose.writeflags(args, 'java arguments');

    grunt.log.ok('Starting Selenium server...');

    // Spawn server process.
    grunt.log.ok('Using command: java ' + args.join(' '));

    childProcesses[target] = grunt.util.spawn({
      cmd: 'java',
      args: args
    });
    grunt.event.emit('selenium.start', target, childProcesses[target]);

    var pid = childProcesses[target].pid;
    grunt.log.ok('Selenium server pid is ' + pid);

    var complete = false;

    var processOutput = function (data) {
      var dataStr = data.toString();
      if (!complete) {
        grunt.log.ok(dataStr);
      }

      if (dataStr.match(/Started SocketListener on .+:\d+/)) {
        if (complete) return;
        grunt.log.ok('Selenium server SocketListener started.');

        complete = true;
        done();
      } else if (dataStr.match(/Selenium is already running on port \d+/)) {
        grunt.log.error("Selenium is already running");
        done(new Error("Selenium is already running"));
      }
    };

    childProcesses[target].stdout.on('data', processOutput);
    childProcesses[target].stderr.on('data', processOutput);

    // Timeout case
    setTimeout(function () {
      if (!complete) {
        complete = true;
        // Try to clean up better after ourselves
        childProcesses[target].kill('SIGTERM');
        done(new Error('Timeout waiting for selenium to start.  Check if an instance of selenium is already running.'));
      }
    }, 30000);
  });

  /**
   * Stop a Selenium server.
   */
  grunt.registerMultiTask('stop-selenium-server', 'Stop Selenium server.', function () {
    var target = this.target;

    // Make sure we have a reference to the running server process.
    if (!childProcesses[target]) {
      grunt.log.error('Server not running.');
    }
    else {
      grunt.log.ok('Sending kill signal to child process.');
      childProcesses[target].kill('SIGTERM');
    }
  });
};
