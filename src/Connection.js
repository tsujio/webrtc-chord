define(['underscore', 'Request', 'Response'], function(_, Request, Response) {
  var Connection = function(conn, onClosedCallbacks) {
    var self = this;

    this._conn = conn;
    this._onClosedCallbacks = onClosedCallbacks;
    this.onRequestReceived = null;
    this.onResponseReceived = null;

    this._conn.on('data', function(data) {
      self._onDataReceived(data);
    });

    this._conn.on('close', function() {
      onClosedCallbacks.fromRemote();
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
        this.onResponseRecieved(response);
      } else if (Request.isRequest(data)) {
        var request;
        try {
          request = Request.fromJson(data);
        } catch (e) {
          return;
        }
        this.onRequestReceived(request);
      }
    },

    close: function() {
      this._onClosedCallbacks.fromLocal();
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
