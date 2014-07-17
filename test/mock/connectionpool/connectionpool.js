function MockConnectionFactory(config) {
};

MockConnectionFactory.prototype = {
  create: function(peerId, callback) {
  },

  removeConnection: function(peerId) {
  },

  destroy: function() {
  }
};

module.exports = MockConnectionFactory;
