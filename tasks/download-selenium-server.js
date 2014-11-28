module.exports = function (grunt) {
  var os = require('os');
  var path = require('path');
  var fs = require('fs');
  var request = require('request');

  grunt.registerMultiTask('download-selenium-server', 'Downloads selenium server', function () {
      var done = this.async();

      var options = this.options({
        downloadFromURL: 'https://selenium-release.storage.googleapis.com/2.42/selenium-server-standalone-2.42.2.jar',
        downloadToPath: os.tmpdir(),
        forceDownload: false
      });
      grunt.verbose.writeflags(options, 'Options');

      // Where to save jar to.
      var destination = path.join(options.downloadToPath, path.basename(options.downloadFromURL));
      grunt.log.ok("File location", destination);

      // Set destination into option of start-selenium-server, so it knows where executable is.
      grunt.config.set('start-selenium-server.options.standaloneSeleniumServerLocation', destination);

      // If it's already there don't download it.
      try {
        var exists = fs.existsSync(destination);
      } catch (err) {
        return done(err);
      }

      if (exists) {
        var stat = fs.statSync(destination);
        if (stat.size > 0) {
          grunt.log.ok("Selenium server is already in place with size", stat.size);

          if (!options.forceDownload) {
            return done();

          } else {
            grunt.log.ok("But you requested to download it anyway. So, removing selenium server.");

            try {
              fs.unlinkSync(destination);
              grunt.log.ok("File removed");

            } catch (err) {
              return done(err);
            }
          }

        } else {
          grunt.log.ok("Selenium server is already in place but it's empty. Keeping with download");
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

      request(options.downloadFromURL)
          .on("error", function (err) {
            grunt.log.error("There was a problem with requesting a resource", err);
            done(err);
          })
          .pipe(writeStream);
    });
};