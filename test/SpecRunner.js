(function() {
  'use strict';

  // Configure RequireJS to shim Jasmine
  require.config({
    baseUrl: '../src',
    paths: {
      'jasmine': '../test/lib/jasmine-2.0.0/jasmine',
      'jasmine-html': '../test/lib/jasmine-2.0.0/jasmine-html',
      'boot': '../test/lib/jasmine-2.0.0/boot',

      underscore: 'http://cdnjs.cloudflare.com/ajax/libs/underscore.js/1.6.0/underscore-min',
      cryptojs: 'http://crypto-js.googlecode.com/svn/tags/3.1.2/build/rollups/sha256'
    },

    shim: {
      'jasmine': {
        exports: 'window.jasmineRequire'
      },
      'jasmine-html': {
        deps: ['jasmine'],
        exports: 'window.jasmineRequire'
      },
      'boot': {
        deps: ['jasmine', 'jasmine-html'],
        exports: 'window.jasmineRequire'
      },

      cryptojs: {
        exports: 'CryptoJS'
      }
    }
  });

  // Define all of your specs here. These are RequireJS modules.
  var specs = [
    '../test/spec/SpecHelper',
    '../test/spec/IDSpec',
    '../test/spec/FingerTableSpec',
    '../test/spec/SuccessorListSpec',
    '../test/spec/ReferenceListSpec',
  ];

  // Load Jasmine - This will still create all of the normal Jasmine browser globals unless `boot.js` is re-written to use the
  // AMD or UMD specs. `boot.js` will do a bunch of configuration and attach it's initializers to `window.onload()`. Because
  // we are using RequireJS `window.onload()` has already been triggered so we have to manually call it again. This will
  // initialize the HTML Reporter and execute the environment.
  require(['boot'], function () {

    // Load the specs
    require(specs, function () {

      // Initialize the HTML Reporter and execute the environment (setup by `boot.js`)
      window.onload();
    });
  });
})();
