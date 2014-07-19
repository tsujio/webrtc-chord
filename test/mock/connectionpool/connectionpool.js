function MockConnectionFactory(config) {
  var self = this;

  this.onopen = function() {};
  this.onconnection = function() {};
  this.onerror = function() {};
  this._connections = {};
  this._peerId = Object.keys(MockConnectionFactory._factories).length.toString();

  MockConnectionFactory._factories[this._peerId] = this;

  setTimeout(function() {
    self.onopen(self._peerId);
  }, 0);
};

MockConnectionFactory._factories = {};

MockConnectionFactory.initialize = function() {
  MockConnectionFactory._factories = {};
};

MockConnectionFactory.prototype = {
  create: function(peerId, callback) {
    if (!MockConnectionFactory._factories[peerId]) {
      callback(null, new Error("Could not connect to " + peerId));
      return;
    }

    var dest = MockConnectionFactory._factories[peerId];
    dest._connections[this.getPeerId()] = new MockConnection(peerId, this.getPeerId());
    dest.onconnection(dest._connections[this.getPeerId()]);

    this._connections[peerId] = new MockConnection(this.getPeerId(), peerId);
    callback(this._connections[peerId]);
  },

  addConnection: function() {
  },

  removeConnection: function(peerId) {
  },

  destroy: function() {
    delete MockConnectionFactory._factories[this.getPeerId()];
  },

  getPeerId: function() {
    return this._peerId;
  },
};

function MockConnection(peerId, remotePeerId) {
  this.ondata = function() {};
  this.onerror = function() {};

  this._peerId = peerId;
  this._remotePeerId = remotePeerId;
};

MockConnection.prototype = {
  send: function(data) {
    var self = this;

    setTimeout(function() {
      MockConnectionFactory._factories[self.getRemotePeerId()]._connections[self._peerId].ondata(data);
    }, 0);
  },

  destroy: function() {
  },

  isAvailable: function() {
    return true;
  },

  getRemotePeerId: function() {
    return this._remotePeerId;
  },
};

module.exports = MockConnectionFactory;
