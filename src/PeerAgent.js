define(['underscore', 'peerjs', 'Utils'], function(_, Peer, Utils) {
  var PeerAgent = function(config, callbacks) {
    var self = this;

    if (!_.isObject(config.peer)) {
      config.peer = {id: undefined, options: {}};
    }
    if (!_.isObject(config.peer.options)) {
      config.peer.options = {};
    }
    if (!Utils.isValidNumber(config.connectRateLimit) ||
        config.connectRateLimit < 0) {
      config.connectRateLimit = 3000;
    }
    if (!Utils.isValidNumber(config.connectionOpenTimeout) ||
        config.connectionOpenTimeout < 0) {
      config.connectionOpenTimeout = 30000;
    }

    if (!_.isString(config.peer.id)) {
      this._peer = new Peer(config.peer.options);
    } else {
      this._peer = new Peer(config.peer.id, config.peer.options);
    }
    this._config = config;
    this._callbacks = callbacks;
    this._waitingTimer = null;
    this.connect = _.throttle(this.connect, config.connectRateLimit);

    var onPeerSetup = _.once(callbacks.onPeerSetup);

    this._peer.on('open', function(id) {
      self._peer.on('connection', function(conn) {
        callbacks.onConnection(conn);
      });

      self._peer.on('close', function() {
        callbacks.onPeerClosed();
      });

      onPeerSetup(id);
    });

    this._peer.on('error', function(error) {
      console.log(error);
      var match = error.message.match(/Could not connect to peer (\w+)/);
      if (match) {
        if (!self.isWaitingOpeningConnection()) {
          return;
        }

        clearTimeout(self._waitingTimer);
        self._waitingTimer = null;

        var peerId = match[1];
        callbacks.onConnectionOpened(peerId, null);
        return;
      }

      onPeerSetup(null);
    });
  };

  PeerAgent.prototype = {
    connect: function(peerId) {
      var self = this;

      var conn = this._peer.connect(peerId);

      this._waitingTimer = setTimeout(function() {
        if (!self.isWaitingOpeningConnection()) {
          return;
        }

        self._waitingTimer = null;

        self._callbacks.onConnectionOpened(peerId, null);
      }, this._config.connectionOpenTimeout);

      conn.on('open', function() {
        if (!self.isWaitingOpeningConnection()) {
          conn.close();
          return;
        }

        clearTimeout(self._waitingTimer);
        self._waitingTimer = null;

        self._callbacks.onConnectionOpened(peerId, conn);
      });
    },

    isWaitingOpeningConnection: function() {
      return !_.isNull(this._waitingTimer);
    },

    destroy: function() {
      this._peer.destroy();
    }
  };

  return PeerAgent;
});
