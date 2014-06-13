define(['underscore', 'PeerAgent', 'Connection', 'Utils'], function(_, PeerAgent, Connection, Utils) {
  var ConnectionFactory = function(config, nodeFactory, callback) {
    var self = this;

    var requestReceived = function(connection, request) {
      connection.close();
      nodeFactory.onRequestReceived(connection.getPeerId(), request);
    };
    var responseReceived = function(connection, response) {
      connection.close();
      nodeFactory.onResponseReceived(connection.getPeerId(), response);
    };
    var closedByRemote = function(connection) {
      self.removeConnection(connection.getPeerId());
    };
    var closedByLocal = function(connection) {
      self._connectionPool.set(connection.getPeerId(), connection);
    };
    this._peerAgent = new PeerAgent(config, {
      onPeerSetup: function(peerId, error) {
        if (error) {
          callback(null, error);
          return;
        }
        callback(self);
      },

      onConnectionOpened: function(peerId, conn, error) {
        if (error) {
          self._invokeNextCallback(peerId, null, error);
          return;
        }

        var connection = new Connection(conn, {
          requestReceived: requestReceived,
          responseReceived: responseReceived,
          closedByRemote: closedByRemote,
          closedByLocal: closedByLocal
        });

        self._invokeNextCallback(peerId, connection);
      },

      onConnection: function(peerId, conn) {
        if (self._connectionPool.has(peerId)) {
          self.removeConnection(peerId);
        }

        var connection;
        var timer = setTimeout(function() {
          connection.close();
        }, config.silentConnectionCloseTimeout);

        var clearTimerOnce = _.once(function() { clearTimeout(timer); });

        connection = new Connection(conn, {
          requestReceived: function(connection, request) {
            clearTimerOnce();
            requestReceived(connection, request);
          },
          responseReceived: function(connection, response) {
            clearTimerOnce();
            responseReceived(connection, response);
          },
          closedByRemote: closedByRemote,
          closedByLocal: closedByLocal
        });
      },

      onPeerClosed: function() {
        _.each(self._connectionPool.keys(), function(peerId) {
          self.removeConnection(peerId);
        });
      }
    });

    if (!Utils.isZeroOrPositiveNumber(config.connectionPoolSize)) {
      config.connectionPoolSize = 10;
    }
    if (!Utils.isZeroOrPositiveNumber(config.connectionCloseDelay)) {
      config.connectionCloseDelay = 5000;
    }
    if (!Utils.isZeroOrPositiveNumber(config.silentConnectionCloseTimeout)) {
      config.silentConnectionCloseTimeout = 30000;
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

      if (this._peerAgent.isWaitingOpeningConnection()) {
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

      this._peerAgent.connect(callbackInfo.peerId);
    },

    _invokeNextCallback: function(peerId, connection, error) {
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
        callbackInfo.callback(null, new Error("Unknown situation."));
        return;
      }
      callbackInfo.callback(connection, error);
    },

    removeConnection: function(remotePeerId) {
      var connection = this._connectionPool.get(remotePeerId);
      if (_.isNull(connection)) {
        return;
      }
      connection.destroy();
      this._connectionPool.remove(remotePeerId);
    },

    destroy: function() {
      this._peerAgent.destroy();
    },

    getPeerId: function() {
      return this._peerAgent.getPeerId();
    },

    listAllPeers: function(callback) {
      this._peerAgent.listAllPeers(callback);
    }
  };

  return ConnectionFactory;
});
