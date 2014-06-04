define(['underscore', 'ID', 'Request', 'Entry', 'Utils'], function(_, ID, Request, Entry, Utils) {
  var Node = function(nodeInfo, nodeFactory, connectionFactory, requestHandler, config) {
    if (!Node.isValidNodeInfo(nodeInfo)) {
      throw new Error("Invalid arguments.");
    }

    if (!Utils.isValidNumber(config.requestTimeout) ||
        config.requestTimeout < 0) {
      config.requestTimeout = 180000;
    }

    this._peerId = nodeInfo.peerId;
    this.nodeId = ID.create(nodeInfo.peerId);
    this._nodeFactory = nodeFactory;
    this._connectionFactory = connectionFactory;
    this._requestHandler = requestHandler;
    this._config = config;
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

        error: function(error) {
          callback(null, error);
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

        error: function(error) {
          callback(null, null, error);
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

        error: function(error) {
          callback(null, error);
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

        error: function(error) {
          callback(false, error);
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

        error: function(error) {
          callback(false, error);
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

        error: function(error) {
          callback(null, error);
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

        error: function(error) {
          callback(false, error);
        }
      });
    },

    _sendRequest: function(method, params, callbacks) {
      var self = this;

      this._connectionFactory.create(this._peerId, function(connection, error) {
        if (error) {
          if (!_.isUndefined(callbacks)) {
            callbacks.error(error);
          }
          return;
        }

        var request = Request.create(method, params);

        if (!_.isUndefined(callbacks)) {
          var timer = setTimeout(function() {
            var callback = self._nodeFactory.deregisterCallback(request.requestId);
            if (!_.isNull(callback)) {
              callbacks.error(new Error(method + " request to " + self._peerId + " timed out."));
            }
          }, self._config.requestTimeout);

          self._nodeFactory.registerCallback(request.requestId, _.once(function(response) {
            clearTimeout(timer);

            if (response.status !== 'SUCCESS') {
              callbacks.error(new Error(response.result.message));
              return;
            }

            callbacks.success(response.result);
          }));
        }

        try {
          connection.send(request);
        } finally {
          connection.close();
        }
      });
    },

    onRequestReceived: function(request) {
      var self = this;

      this._requestHandler.handle(request, function(response) {
        self._connectionFactory.create(self._peerId, function(connection, error) {
          if (error) {
            return;
          }

          try {
            connection.send(response);
          } finally {
            connection.close();
          }
        });
      });
    },

    onResponseReceived: function(response) {
      var callback = this._nodeFactory.deregisterCallback(response.requestId);
      if (!_.isNull(callback)) {
        callback(response);
      }
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
