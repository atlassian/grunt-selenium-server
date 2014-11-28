module.exports = function (grunt) {

  grunt.registerMultiTask('start-selenium-server', 'Start Selenium server.', function () {
    var done = this.async();

    var target = this.target;

    // Set default options.
    var options = this.options({
      serverOptions: {},
      systemProperties: {},
      standaloneSeleniumServerLocation: null
    });

    if (!options.standaloneSeleniumServerLocation) {
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

    var childProcess = grunt.util.spawn({
      cmd: 'java',
      args: args
    });
    grunt.config.set('start-selenium-server.options.child-process.' + target, childProcess);
    grunt.event.emit('selenium.start', target, childProcess);

    var pid = childProcess.pid;
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

    childProcess.stdout.on('data', processOutput);
    childProcess.stderr.on('data', processOutput);

    // Timeout case
    setTimeout(function () {
      if (!complete) {
        complete = true;
        // Try to clean up better after ourselves
        childProcess.kill('SIGTERM');
        done(new Error('Timeout waiting for selenium to start.  Check if an instance of selenium is already running.'));
      }
    }, 30000);
  });
};
