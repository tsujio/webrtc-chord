define(['underscore', 'PeerAgent', 'Connection', 'Utils'], function(_, PeerAgent, Connection, Utils) {
  var ConnectionFactory = function(config, nodeFactory, callback) {
    var self = this;

    var makeConnection = function(conn) {
      var connection = new Connection(conn, {
        fromRemote: function() {
          self.removeConnection(connection.getPeerId());
        },

        fromLocal: function() {
          self._connectionPool.set(connection.getPeerId(), connection);
        }
      });
      return connection;
    };

    this._peerAgent = new PeerAgent(config, {
      onPeerSetup: function(peerId) {
        callback(peerId, self);
      },

      onConnectionOpened: function(peerId, conn) {
        if (_.isNull(conn)) {
          self._invokeNextCallback(peerId, null);
          return;
        }

        var connection = makeConnection(conn);
        self._invokeNextCallback(peerId, connection);
      },

      onConnection: function(conn) {
        if (self._connectionPool.has(conn.peer)) {
          self.removeConnection(conn.peer);
        }

        var connection = makeConnection(conn);
        nodeFactory.create({peerId: conn.peer}, function(node) {
          node.onConnection(connection);
        });
      },

      onPeerClosed: function() {
        _.each(self._connectionPool.keys(), function(peerId) {
          self.removeConnection(peerId);
        });
      }
    });

    if (!Utils.isValidNumber(config.connectionPoolSize) ||
        config.connectionPoolSize < 0) {
      config.connectionPoolSize = 10;
    }
    if (!Utils.isValidNumber(config.connectionCloseDelay) ||
        config.connectionCloseDelay < 0) {
      config.connectionCloseDelay = 5000;
    }
    this._connectionPool = new Utils.Cache(config.connectionPoolSize, function(connection) {
      _.delay(function() { connection.destroy(); }, config.connectionCloseDelay);
    });
    this._callbackQueue = new Utils.Queue();
  };

  ConnectionFactory.create = function(config, nodeFactory, callback) {
    var factory = new ConnectionFactory(config, nodeFactory, callback);
  };

  ConnectionFactory.prototype = {
    create: function(remotePeerId, callback) {
      var self = this;

      if (!Utils.isNonemptyString(remotePeerId)) {
        callback(null);
        return;
      }

      this._callbackQueue.enqueue({
        peerId: remotePeerId,
        callback: callback
      });

      this._createConnectionAndInvokeNextCallback();
    },

    _createConnectionAndInvokeNextCallback: function() {
      var self = this;

      var callbackInfo = this._callbackQueue.first();
      if (_.isNull(callbackInfo)) {
        return;
      }

      if (this._connectionPool.has(callbackInfo.peerId)) {
        var connection = this._connectionPool.get(callbackInfo.peerId);
        if (connection.isAvailable()) {
          this._invokeNextCallback(connection.getPeerId(), connection);
          return;
        }

        this.removeConnection(connection.getPeerId());
      }

      if (this._peerAgent.isWaitingOpeningConnection()) {
        return;
      }

      this._peerAgent.connect(callbackInfo.peerId);
    },

    _invokeNextCallback: function(peerId, connection) {
      var self = this;

      _.defer(function() {
        self._createConnectionAndInvokeNextCallback();
      });

      var callbackInfo = this._callbackQueue.dequeue();
      if (_.isNull(callbackInfo)) {
        console.log("Unknown situation.");
        return;
      }
      if (callbackInfo.peerId !== peerId) {
        console.log("Unknown situation.");
        callbackInfo.callback(null);
        return;
      }
      callbackInfo.callback(connection);
    },

    removeConnection: function(remotePeerId) {
      var connection = this._connectionPool.get(remotePeerId);
      if (_.isNull(connection)) {
        return;
      }
      connection.destroy();
      this._connectionPool.remove(remotePeerId);
    },

    isConnectionCached: function(peerId) {
      return this._connectionPool.has(peerId);
    },

    destroy: function() {
      this._peerAgent.destroy();
    },
  };

  return ConnectionFactory;
});
