var fse = require('fs-extra');
var path = require('path');
var _ = require('lodash');
var ID = require('../src/ID');

beforeEach(function () {
  this.addMatchers({
    toEqualId: function() {
      return  {
        compare: function(actual, expected) {
          return {
            pass: actual.equals(expected)
          };
        }
      };
    },

    toEqualNode: function() {
      return  {
        compare: function(actual, expected) {
          return {
            pass: actual.equals(expected)
          };
        }
      };
    }
  });
});

var helpers = {
  replaceConnectionPool: function(callback) {
    // Replace connectionpool module with mock module
    // Please tell me a smarter method
    fse.removeSync(path.join(__dirname, '../node_modules/connectionpool'));
    fse.copySync(path.join(__dirname, 'mock/connectionpool'),
                 path.join(__dirname, '../node_modules/connectionpool'));
    try {
      callback();
    } finally {
      fse.removeSync(path.join(__dirname, '../node_modules/connectionpool'));
    }
  },

  orderedNodesInfo: (function() {
    var nodesInfo = _.times(256, function(i) {
      var peerId = 'localid' + (i === 0 ? '' : ('+' + i));
      return {peerId: peerId, nodeId: ID.create(peerId)};
    });
    nodesInfo.sort(function(a, b) { return a.nodeId.compareTo(b.nodeId); });
    return nodesInfo;
  })()
};

module.exports = helpers;
