define(['underscore', 'Request', 'Response'], function(_, Request, Response) {
  var Connection = function(conn, callbacks) {
    var self = this;

    this._conn = conn;
    this._callbacks = callbacks;

    this._conn.on('data', function(data) {
      self._onDataReceived(data);
    });

    this._conn.on('close', function() {
      callbacks.closedByRemote(self);
    });

    this._conn.on('error', function(error) {
      console.log(error);
    });
  };

  Connection.prototype = {
    send: function(requestOrResponse, callback) {
      this._conn.send(requestOrResponse.toJson());
    },

    _onDataReceived: function(data) {
      var self = this;

      if (Response.isResponse(data)) {
        var response;
        try {
          response = Response.fromJson(data);
        } catch (e) {
          return;
        }
        this._callbacks.responseReceived(this, response);
      } else if (Request.isRequest(data)) {
        var request;
        try {
          request = Request.fromJson(data);
        } catch (e) {
          return;
        }
        this._callbacks.requestReceived(this, request);
      }
    },

    close: function() {
      this._callbacks.closedByLocal(this);
    },

    destroy: function() {
      this._conn.close();
    },

    getPeerId: function() {
      return this._conn.peer;
    },

    isAvailable: function() {
      return this._conn.open;
    }
  };

  return Connection;
});
