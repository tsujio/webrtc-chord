define(['underscore', 'ID', 'Request', 'Entry', 'Utils'], function(_, ID, Request, Entry, Utils) {
  var Node = function(nodeInfo, nodeFactory, callbacks, connectionFactory, requestHandler, config) {
    if (!Node.isValidNodeInfo(nodeInfo)) {
      throw new Error("Invalid arguments.");
    }

    if (!Utils.isValidNumber(config.requestTimeout) ||
        config.requestTimeout < 0) {
      config.requestTimeout = 180000;
    }
    if (!Utils.isValidNumber(config.silentConnectionCloseTimeout) ||
        config.silentConnectionCloseTimeout < 0) {
      config.silentConnectionCloseTimeout = 30000;
    }

    this._peerId = nodeInfo.peerId;
    this.nodeId = ID.create(nodeInfo.peerId);
    this._nodeFactory = nodeFactory;
    this._connectionFactory = connectionFactory;
    this._requestHandler = requestHandler;
    this._config = config;
    this._callbacks = callbacks;
  };

  Node.isValidNodeInfo = function(nodeInfo) {
    if (!_.isObject(nodeInfo)) {
      return false;
    }
    if (!Utils.isNonemptyString(nodeInfo.peerId)) {
      return false;
    }
    return true;
  };

  Node.prototype = {
    findSuccessor: function(key, callback) {
      var self = this;

      if (!(key instanceof ID)) {
        callback(null);
        return;
      }

      this._sendRequest('FIND_SUCCESSOR', {
        key: key.toHexString()
      }, {
        success: function(result) {
          var nodeInfo = result.successorNodeInfo;
          self._nodeFactory.create(nodeInfo, callback);
        },

        error: function() {
          callback(null);
        }
      });
    },

    notifyAndCopyEntries: function(potentialPredecessor, callback) {
      var self = this;

      this._sendRequest('NOTIFY_AND_COPY', {
        potentialPredecessorNodeInfo: potentialPredecessor.toNodeInfo()
      }, {
        success: function(result) {
          if (!_.isArray(result.referencesNodeInfo) || !_.isArray(result.entries)) {
            callback(null, null);
            return;
          }

          self._nodeFactory.createAll(result.referencesNodeInfo, function(references) {
            var entries = _.chain(result.entries)
              .map(function(entry) {
                try {
                  return Entry.fromJson(entry);
                } catch (e) {
                  return null;
                }
              })
              .reject(function(entry) { return _.isNull(entry); })
              .value();

            callback(references, entries);
          });
        },

        error: function() {
          callback(null, null);
        }
      });
    },

    notify: function(potentialPredecessor, callback) {
      var self = this;

      this._sendRequest('NOTIFY', {
        potentialPredecessorNodeInfo: potentialPredecessor.toNodeInfo()
      }, {
        success: function(result) {
          if (!_.isArray(result.referencesNodeInfo)) {
            callback(null);
            return;
          }

          self._nodeFactory.createAll(result.referencesNodeInfo, function(references) {
            callback(references);
          });
        },

        error: function() {
          callback(null);
        }
      });
    },

    leavesNetwork: function(predecessor) {
      var self = this;

      if (_.isNull(predecessor)) {
        throw new Error("Invalid argument.");
      }

      this._sendRequest('LEAVES_NETWORK', {
        predecessorNodeInfo: predecessor.toNodeInfo()
      });
    },

    ping: function(callback) {
      this._sendRequest('PING', {}, {
        success: function(result) {
          callback(true);
        },

        error: function() {
          callback(false);
        }
      });
    },

    insertReplicas: function(replicas) {
      this._sendRequest('INSERT_REPLICAS', {replicas: _.invoke(replicas, 'toJson')});
    },

    removeReplicas: function(sendingNodeId, replicas) {
      this._sendRequest('REMOVE_REPLICAS', {
        sendingNodeId: sendingNodeId.toHexString(),
        replicas: _.invoke(replicas, 'toJson')
      });
    },

    insertEntry: function(entry, callback) {
      this._sendRequest('INSERT_ENTRY', {
        entry: entry.toJson()
      }, {
        success: function(result) {
          callback(true);
        },

        error: function() {
          callback(false);
        }
      });
    },

    retrieveEntries: function(id, callback) {
      this._sendRequest('RETRIEVE_ENTRIES', {
        id: id.toHexString()
      }, {
        success: function(result) {
          if (!_.isArray(result.entries)) {
            callback(null);
            return;
          }

          var entries = _.chain(result.entries)
            .map(function(entry) {
              try {
                return Entry.fromJson(entry);
              } catch (e) {
                return null;
              }
            })
            .reject(function(entry) { return _.isNull(entry); })
            .value();
          callback(entries);
        },

        error: function() {
          callback(null);
        }
      });
    },

    removeEntry: function(entry, callback) {
      this._sendRequest('REMOVE_ENTRY', {
        entry: entry.toJson()
      }, {
        success: function(result) {
          callback(true);
        },

        error: function() {
          callback(false);
        }
      });
    },

    _sendRequest: function(method, params, callbacks) {
      var self = this;

      this._connectionFactory.create(this._peerId, function(connection) {
        if (_.isNull(connection)) {
          if (!_.isUndefined(callbacks)) {
            callbacks.error();
          }
          return;
        }

        var request = Request.create(method, params);

        if (!_.isUndefined(callbacks)) {
          var timer = setTimeout(function() {
            if (_.has(self._callbacks, request.requestId)) {
              var callback = self._callbacks[request.requestId];
              delete self._callbacks[request.requestId];
              callback(null);
            }
          }, self._config.requestTimeout);

          self._callbacks[request.requestId] = _.once(function(response) {
            clearTimeout(timer);

            if (_.isNull(response)) {
              callbacks.error();
              return;
            }

            if (response.status !== 'SUCCESS') {
              callbacks.error();
              return;
            }

            callbacks.success(response.result);
          });
        }

        connection.onRequestReceived = self._makeOnRequestReceivedListener(connection);
        connection.onResponseRecieved = self._makeOnResponseReceivedListener(connection);

        try {
          connection.send(request);
        } finally {
          connection.close();
        }
      });
    },

    onConnection: function(connection) {
      var self = this;

      var timer = setTimeout(function() {
        connection.close();
      }, this._config.silentConnectionCloseTimeout);

      connection.onRequestReceived = function(request) {
        clearTimeout(timer);

        self._makeOnRequestReceivedListener(connection)(request);
      };

      connection.onResponseRecieved = connection.onResponseReceived = function(response) {
        clearTimeout(timer);

        self._makeOnResponseReceivedListener(connection)(response);
      };
    },

    _makeOnRequestReceivedListener: function(connection) {
      var self = this;

      return function(request) {
        connection.close();

        self._requestHandler.handle(request, function(response) {
          self._connectionFactory.create(self._peerId, function(connection) {
            if (_.isNull(connection)) {
              return;
            }

            try {
              connection.send(response);
            } finally {
              connection.close();
            }
          });
        });
      };
    },

    _makeOnResponseReceivedListener: function(connection) {
      var self = this;

      return function(response) {
        connection.close();

        if (_.has(self._callbacks, response.requestId)) {
          var callback = self._callbacks[response.requestId];
          delete self._callbacks[response.requestId];
          callback(response);
        }
      };
    },

    isUnused: function() {
      return (!_.isEmpty(this._callbacks) ||
              this._connectionFactory.isConnectionCached(this._peerId));
    },

    disconnect: function() {
      this._connectionFactory.removeConnection(this._peerId);
    },

    getPeerId: function() {
      return this._peerId;
    },

    toNodeInfo: function() {
      return {
        nodeId: this.nodeId.toHexString(),
        peerId: this._peerId
      };
    },

    equals: function(node) {
      if (_.isNull(node)) {
        return false;
      }
      return this.nodeId.equals(node.nodeId);
    },

    toString: function() {
      return this.nodeId.toHexString() + " (" + this._peerId + ")";
    }
  };

  return Node;
});
