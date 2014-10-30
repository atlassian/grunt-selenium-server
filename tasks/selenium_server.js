module.exports = function (grunt) {

  var fs = require('fs');
  var os = require('os');
  var util = require('util');
  var path = require('path');
  var url = require('url');
  var request = require('request');
  var ProgressBar = require('progress');

  /**
   * References running server processes.
   *
   * @type {Object}
   */
  var childProcesses = {};

  /**
   * Download the Selenium Server jar file.
   *
   * @param  {Object}   options Grunt task options.
   * @param  {Function} cb
   */
  function downloadJar(options, cb) {
    // Where to save jar to.
    var destination = path.join(options.downloadLocation, path.basename(options.downloadUrl));

    // If it's already there don't download it.
    if (fs.existsSync(destination)) {
      var stat = fs.statSync(destination);
      var size = util.inspect(stat).size;
      if (size > 0) {
        grunt.log.ok("File is there with size ", size);
        return cb(destination, null);
      } else {
        grunt.log.ok("File is there but it's zero size. Keeping with downloading");
      }
    }

    grunt.log.ok('Saving jar to: ' + destination);

    var writeStream = fs.createWriteStream(destination);

    grunt.log.ok('Write stream is opened', !!writeStream);

    writeStream.on('close', function(){
      grunt.log.ok("Write stream is closed now");
      cb(destination, null);
    });

    writeStream.on('write', function(chunk){
      grunt.log.ok("Chunk");
    });

    writeStream.on('error', function(error){
      grunt.log.error("There was an error writing to a file", error);
      cb(null, error);
    });

    // Start downloading and showing progress.
    try {
      request(options.downloadUrl)
          .on('error', function (error) {
            grunt.log.error("Error happened while requesting resource", error);
            cb(null, error);
          })
          .on('response', function (res) {
            grunt.log.ok("We have a response");
            if (res.statusCode < 200 || res.statusCode >= 400) {
              grunt.fail.fatal(options.downloadUrl + " returns " + res.statusCode);
            }
            // Full length of file.
            var len = parseInt(res.headers['content-length'], 10);
            grunt.log.ok("Response length is", len, "bytes");

            // Super nifty progress bar.
            var bar = new ProgressBar(' downloading [:bar] :percent :etas', {
              complete: '=',
              incomplete: ' ',
              width: 20,
              total: len
            });

            // Write new data to file.
            res.on('data', function (chunk) {
              bar.tick(chunk.length);
            });

            // Download error.
            res.on('error', function (err) {
              grunt.log.error("Something happened with response");
              cb(null, err);
            });
          })
          .pipe(writeStream);
      grunt.log.ok("Request done without an exception");
    } catch (error) {
      grunt.log.error("There was an error making a request", error);
      cb(null, error);
    }
  }

  /**
   * Start a selenium server.
   *
   * @param  {String}   target  Grunt task target.
   * @param  {String}   jar     Full path to server jar.
   * @param  {Object}   options Grunt task options.
   * @param  {Function} cb
   */
  function startServer(target, jar, options, cb) {
    var args = ['-jar', jar];

    // Add additional options to command.
    Object.keys(options.serverOptions).forEach(function (key) {
      args.push('-' + key);
      args.push(options.serverOptions[key]);
    });

    Object.keys(options.systemProperties).forEach(function (key) {
      args.push('-D' + key + '=' + options.systemProperties[key]);
    });

    grunt.log.ok('Starting Selenium server...');
    grunt.verbose.writeflags(args, "java arguments");

    // Spawn server process.
    grunt.log.ok('Using (roughly) command: java ' + args.join(' '));
    var spawn = require('child_process').spawn;
    childProcesses[target] = spawn('java', args);

    grunt.event.emit('selenium.start', target, childProcesses[target]);

    var pid = childProcesses[target].pid;
    grunt.log.ok('Boom, got it. pid is ' + pid);

    var complete = false;

    childProcesses[target].stdout.on('data', function (data) {
      grunt.log.ok("Selenium Sever output:", data);
      if (data.toString().match(/Started SocketListener on .+:\d+/)) {
        if (complete) return;
        grunt.log.ok('Selenium server SocketListener started.');

        // Wait a tiny bit more time just because it's java and I'm worried.
        setTimeout(function () {
          grunt.log.ok("After two seconds from selenium start");
          complete = true;
          cb(null);
        }, 2000);
      }
    });

    if (options.showErrors || options.showErrors == undefined) {
      childProcesses[target].stderr.on('data', function (data) {
        grunt.log.error(data.toString());
        cb(new Error(data));
      });
    }

    // Timeout case
    setTimeout(function () {
      if (!complete) {
        complete = true;
        // Try to clean up better after ourselves
        childProcesses[target].kill('SIGTERM');
        cb(new Error('Timeout waiting for selenium to start.  Check if an instance of selenium is already running.'));
      }
    }, 30000);
  }

  /**
   * Start a Selenium server.
   */
  grunt.registerMultiTask('start-selenium-server', 'Start Selenium server.', function () {
    var done = this.async();
    var loggedDone = function () {
      grunt.log.ok("Task is done.");
      done();
    };
    var target = this.target;

    // Set default options.
    var options = this.options({
      downloadUrl: 'https://selenium-release.storage.googleapis.com/2.42/selenium-server-standalone-2.42.2.jar',
      downloadLocation: os.tmpdir(),
      serverOptions: {},
      systemProperties: {}
    });

    grunt.verbose.writeflags(options, 'Options');

    // Download jar file. Doesn't do anything if the file's already been downloaded.
    downloadJar(options, function (jar, err) {
      grunt.log.ok("Inside download callack");
      if (err) {
        grunt.log.error(err);
        return loggedDone(false);
      }

      // Start the selenium server in a child process.
      startServer(target, jar, options, function (err) {
        grunt.log.ok("Inside start server callback");
        if (err) {
          grunt.log.error(err);
          return loggedDone(false);
        }

        loggedDone(true);
      });
    });
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
