(function() {
  var _ = require('lodash');
  var ConnectionFactory = require('connectionpool');
  var Node = require('./Node');
  var Request = require('./Request');
  var Response = require('./Response');
  var RequestHandler = require('./RequestHandler');
  var ID = require('./ID');
  var Utils = require('./Utils');

  var NodeFactory = function(localNode, config) {
    var self = this;

    if (_.isNull(localNode)) {
      throw new Error("Invalid arguments.");
    }

    this._localNode = localNode;
    this._config = config;
    this._connectionFactory = null;
    this._requestHandler = new RequestHandler(localNode, this);
    this._callbacks = {};
  };

  NodeFactory.create = function(localNode, config, callback) {
    if (_.isNull(localNode)) {
      callback(null, null);
    }

    var nodeFactory = new NodeFactory(localNode, config);

    var callbackOnce = _.once(callback);
    var connectionFactory = new ConnectionFactory(config);

    connectionFactory.onopen = function(peerId) {
      nodeFactory._connectionFactory = connectionFactory;
      callbackOnce(peerId, nodeFactory);
    };

    connectionFactory.onconnection = function(connection) {
      nodeFactory.setListenersToConnection(connection);
    };

    connectionFactory.onerror = function(error) {
      console.log(error);
      callbackOnce(null, null, error);
    };
  };

  NodeFactory.prototype = {
    create: function(nodeInfo, callback) {
      var self = this;

      if (!Node.isValidNodeInfo(nodeInfo)) {
        callback(null, new Error("Invalid node info."));
        return;
      }

      if (this._localNode.nodeId.equals(ID.create(nodeInfo.peerId))) {
        callback(this._localNode);
        return;
      }

      var node = new Node(nodeInfo, this, this._connectionFactory, this._requestHandler, this._config);

      callback(node);
    },

    createAll: function(nodesInfo, callback) {
      var self = this;

      if (_.isEmpty(nodesInfo)) {
        callback([]);
        return;
      }
      this.create(_.first(nodesInfo), function(node, error) {
        self.createAll(_.rest(nodesInfo), function(nodes) {
          if (!error) {
            callback([node].concat(nodes));
          } else {
            console.log(error);
            callback(nodes);
          }
        });
      });
    },

    setListenersToConnection: function(connection) {
      var self = this;

      connection.ondata = function(data) {
        if (Response.isResponse(data)) {
          var response;
          try {
            response = Response.fromJson(data);
          } catch (e) {
            console.log(e);
            return;
          }
          self._responseReceived(connection.getRemotePeerId(), response);
        } else if (Request.isRequest(data)) {
          var request;
          try {
            request = Request.fromJson(data);
          } catch (e) {
            console.log(e);
            return;
          }
          self._requestReceived(connection.getRemotePeerId(), request);
        }
      };

      connection.onerror = function(error) {
        console.log(error);
      };
    },

    _requestReceived: function(peerId, request) {
      this.create({peerId: peerId}, function(node, error) {
        if (error) {
          console.log(error);
          return;
        }
        node.onRequestReceived(request);
      });
    },

    _responseReceived: function(peerId, response) {
      this.create({peerId: peerId}, function(node, error) {
        if (error) {
          console.log(error);
          return;
        }
        node.onResponseReceived(response);
      });
    },

    registerCallback: function(key, callback) {
      this._callbacks[key] = callback;
    },

    deregisterCallback: function(key) {
      if (!_.has(this._callbacks, key)) {
        return null;
      }
      var callback = this._callbacks[key];
      delete this._callbacks[key];
      return callback;
    },

    destroy: function() {
      this._connectionFactory.destroy();
    }
  };

  module.exports = NodeFactory;
})();
