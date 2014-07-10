(function() {
  var _ = require('lodash');
  var Request = require('./Request');
  var Response = require('./Response');
  var Packet = require('./Packet');
  var Utils = require('./Utils');

  var Connection = function(conn, callbacks, config) {
    var self = this;

    if (!Utils.isZeroOrPositiveNumber(config.connectionCloseDelay)) {
      config.connectionCloseDelay = 30000;
    }

    this._conn = conn;
    this._callbacks = callbacks;
    this._config = config;
    this._shutdown = false;

    this._conn.on('data', function(data) {
      var packet;
      try {
        packet = Packet.fromJson(data);
      } catch (e) {
        console.error(e);
        return;
      }

      if (packet.flags.FIN) {
        self._shutdown = true;
        callbacks.receivedFin(self);
        return;
      }

      self._onDataReceived(packet.payload);
    });

    this._conn.on('close', function() {
      self._shutdown = true;
      callbacks.closedByRemote(self);
    });

    this._conn.on('error', function(error) {
      console.log(error);
    });
  };

  Connection.prototype = {
    send: function(requestOrResponse, callback) {
      var packet = Packet.create({}, requestOrResponse.toJson());

      if (this.isAvailable()) {
        this._conn.send(packet.toJson());
      } else {
        throw new Error("Connection is not available.");
      }
    },

    _onDataReceived: function(data) {
      var self = this;

      if (Response.isResponse(data)) {
        var response;
        try {
          response = Response.fromJson(data);
        } catch (e) {
          console.log(e);
          return;
        }
        this._callbacks.responseReceived(this, response);
      } else if (Request.isRequest(data)) {
        var request;
        try {
          request = Request.fromJson(data);
        } catch (e) {
          console.log(e);
          return;
        }
        this._callbacks.requestReceived(this, request);
      }
    },

    close: function() {
      this._callbacks.closedByLocal(this);
    },

    shutdown: function() {
      var self = this;

      if (this.isAvailable()) {
        var packet = Packet.create({FIN: true}, {});
        this._conn.send(packet.toJson());
      }

      this._shutdown = true;

      _.delay(function() {
        self._conn.close();
      }, this._config.connectionCloseDelay);
    },

    getPeerId: function() {
      return this._conn.peer;
    },

    isAvailable: function() {
      return !this._shutdown && this._conn.open;
    }
  };

  module.exports = Connection;
})();
