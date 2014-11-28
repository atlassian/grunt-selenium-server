module.exports = function (grunt) {
  grunt.registerMultiTask('stop-selenium-server', 'Stop Selenium server.', function () {
    var childProcess = grunt.config.set('start-selenium-server.options.child-process.' + this.target);

    // Make sure we have a reference to the running server process.
    if (!childProcess) {
      grunt.fail.warn('No process stored. Has start-selenium-server task ran properly?');
    }
    else {
      grunt.log.ok('Sending kill signal to child process.');
      childProcess.kill('SIGTERM');
    }
  });
};