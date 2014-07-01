define(['lodash', 'PeerAgent', 'Connection', 'Utils'], function(_, PeerAgent, Connection, Utils) {
  var ConnectionFactory = function(config, nodeFactory, callback) {
    var self = this;

    var callbacks = {
      requestReceived: function(connection, request) {
        if (connection.isAvailable()) {
          self._connectionPool.set(connection.getPeerId(), connection);
        } else {
          connection.shutdown();
        }

        nodeFactory.onRequestReceived(connection.getPeerId(), request);
      },
      responseReceived: function(connection, response) {
        if (connection.isAvailable()) {
          self._connectionPool.set(connection.getPeerId(), connection);
        } else {
          connection.shutdown();
        }

        nodeFactory.onResponseReceived(connection.getPeerId(), response);
      },
      closedByRemote: function(connection) {
        self.removeConnection(connection.getPeerId());
      },
      closedByLocal: function(connection) {
        if (connection.isAvailable()) {
          self._connectionPool.set(connection.getPeerId(), connection);
        } else {
          connection.shutdown();
        }
      },
      receivedFin: function(connection) {
        callbacks.closedByRemote(connection);
      },
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

        var connection = new Connection(conn, callbacks, config);

        self._invokeNextCallback(peerId, connection);
      },

      onConnection: function(peerId, conn) {
        if (self._connectionPool.has(peerId)) {
          self.removeConnection(peerId);
        }

        var connection;
        var timer = setTimeout(function() {
          connection.shutdown();
        }, config.silentConnectionCloseTimeout);

        var clearTimerOnce = _.once(function() { clearTimeout(timer); });

        connection = new Connection(conn, _.defaults({
          requestReceived: function(connection, request) {
            clearTimerOnce();
            callbacks.requestReceived(connection, request);
          },
          responseReceived: function(connection, response) {
            clearTimerOnce();
            callbacks.responseReceived(connection, response);
          }
        }, callbacks), config);
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
    if (!Utils.isZeroOrPositiveNumber(config.silentConnectionCloseTimeout)) {
      config.silentConnectionCloseTimeout = 30000;
    }
    this._connectionPool = new Utils.Cache(config.connectionPoolSize, function(connection) {
      connection.shutdown();
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
      this._connectionPool.remove(remotePeerId);
      connection.shutdown();
    },

    destroy: function() {
      this._peerAgent.destroy();
    },

    getPeerId: function() {
      return this._peerAgent.getPeerId();
    }
  };

  return ConnectionFactory;
});
