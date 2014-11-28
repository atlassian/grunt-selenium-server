module.exports = function (grunt) {

  grunt.registerTask('kill-selenium-on-fail', function(){
    var seleniumChildProcesses = {};
    grunt.event.on('selenium.start', function(target, process){
      grunt.log.ok('Saw process for target: ' +  target);
      seleniumChildProcesses[target] = process;
    });

    grunt.util.hooker.hook(grunt.fail, function(){
      // Clean up selenium if we left it running after a failure.
      grunt.log.writeln('Attempting to clean up running selenium server.');
      for(var target in seleniumChildProcesses) {
        grunt.log.ok('Killing selenium target: ' + target);
        try {
          seleniumChildProcesses[target].kill('SIGTERM');
        }
        catch(e) {
          grunt.log.warn('Unable to stop selenium target: ' + target);
        }
      }
    });
  });
};
