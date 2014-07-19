(function() {
  var _ = require('lodash');
  var ID = require('./ID');
  var Request = require('./Request');
  var Entry = require('./Entry');
  var Utils = require('./Utils');

  var Node = function(nodeInfo, localId, nodeFactory, connectionFactory, requestHandler, config) {
    if (!Node.isValidNodeInfo(nodeInfo)) {
      throw new Error("Invalid arguments.");
    }

    if (!Utils.isZeroOrPositiveNumber(config.requestTimeout)) {
      config.requestTimeout = 180000;
    }
    if (!Utils.isZeroOrPositiveNumber(config.maxRoundCount)) {
      config.maxRoundCount = 1;
    }

    this._peerId = nodeInfo.peerId;
    this.nodeId = ID.create(nodeInfo.peerId);
    this._localId = localId;
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

      var roundCount = 0;
      (function _findSuccessor(node) {
        node.findSuccessorIterative(key, function(status, successor, error) {
          if (status === 'SUCCESS') {
            callback(successor);
          } else if (status === 'REDIRECT') {
            if (self.nodeId.isInInterval(node.nodeId, successor.nodeId)) {
              roundCount++;
              if (roundCount > self._config.maxRoundCount) {
                callback(null, new Error("FIND_SUCCESSOR request circulates in the network."));
                return;
              }
            }

            Utils.debug("[findSuccessor] redirected to " + successor.getPeerId());

            _findSuccessor(successor);
          } else if (status === 'FAILED') {
            callback(null, error);
          } else {
            callback(null, new Error("Got unknown status:", status));
          }
        });
      })(this);
    },

    findSuccessorIterative: function(key, callback) {
      var self = this;

      this._sendRequest('FIND_SUCCESSOR', {
        key: key.toHexString()
      }, {
        success: function(result) {
          var nodeInfo = result.successorNodeInfo;
          self._nodeFactory.create(nodeInfo, function(successor, error) {
            if (error) {
              callback('FAILED', null, error);
              return;
            }
            callback('SUCCESS', successor);
          });
        },

        redirect: function(result) {
          self._nodeFactory.create(result.redirectNodeInfo, function(nextNode, error) {
            if (error) {
              callback('FAILED', null, error);
              return;
            }

            callback('REDIRECT', nextNode);
          });
        },

        error: function(error) {
          callback('FAILED', null, error);
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

    notifyAsSuccessor: function(potentialSuccessor, callback) {
      var self = this;

      this._sendRequest('NOTIFY_AS_SUCCESSOR', {
        potentialSuccessorNodeInfo: potentialSuccessor.toNodeInfo()
      }, {
        success: function(result) {
          self._nodeFactory.create(result.successorNodeInfo, function(successor, error) {
            if (error) {
              callback(null, error);
              return;
            }

            callback(successor);
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
          callback();
        },

        error: function(error) {
          callback(error);
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
      var self = this;

      this._sendRequest('INSERT_ENTRY', {
        entry: entry.toJson()
      }, {
        success: function(result) {
          callback();
        },

        redirect: function(result) {
          self._nodeFactory.create(result.redirectNodeInfo, function(node, error) {
            if (error) {
              callback(error);
              return;
            }

            Utils.debug("[insertEntry] redirected to " + node.getPeerId());

            node.insertEntry(entry, callback);
          });
        },

        error: function(error) {
          callback(error);
        }
      });
    },

    retrieveEntries: function(id, callback) {
      var self = this;

      this._sendRequest('RETRIEVE_ENTRIES', {
        id: id.toHexString()
      }, {
        success: function(result) {
          if (!_.isArray(result.entries)) {
            callback(null, new Error("Received invalid data from " + self._peerId));
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

        redirect: function(result) {
          self._nodeFactory.create(result.redirectNodeInfo, function(node, error) {
            if (error) {
              callback(null, error);
              return;
            }

            Utils.debug("[retrieveEntries] redirected to " + node.getPeerId());

            node.retrieveEntries(id, callback);
          });
        },

        error: function(error) {
          callback(null, error);
        }
      });
    },

    removeEntry: function(entry, callback) {
      var self = this;

      this._sendRequest('REMOVE_ENTRY', {
        entry: entry.toJson()
      }, {
        success: function(result) {
          callback();
        },

        redirect: function(result) {
          self._nodeFactory.create(result.redirectNodeInfo, function(node, error) {
            if (error) {
              callback(error);
              return;
            }

            Utils.debug("[removeEntry] redirected to " + node.getPeerId());

            node.removeEntry(entry, callback);
          });
        },

        error: function(error) {
          callback(error);
        }
      });
    },

    _sendRequest: function(method, params, callbacks) {
      var self = this;

      this._connectionFactory.create(this._peerId, function(connection, error) {
        if (error) {
          if (callbacks && callbacks.error) {
            callbacks.error(error);
          }
          return;
        }

        self._nodeFactory.setListenersToConnection(connection);

        var request = Request.create(method, params);

        if (callbacks) {
          callbacks = _.defaults(callbacks, {
            success: function() {}, redirect: function() {}, error: function() {}
          });

          var timer = setTimeout(function() {
            self._nodeFactory.deregisterCallback(request.requestId);
            callbacks.error(new Error(method + " request to " + self._peerId + " timed out."));
          }, self._config.requestTimeout);

          self._nodeFactory.registerCallback(request.requestId, _.once(function(response) {
            clearTimeout(timer);

            switch (response.status) {
            case 'SUCCESS': callbacks.success(response.result); break;
            case 'REDIRECT': callbacks.redirect(response.result); break;
            case 'FAILED':
              callbacks.error(new Error(
                "Request to " + self._peerId + " failed: " + response.result.message));
              break;

            default:
              callback.error(new Error("Received unknown status response:", response.status));
            }
          }));
        }

        Utils.debug("Sending request to", self._peerId, ":", request.method);

        connection.send(request);
      });
    },

    onRequestReceived: function(request) {
      var self = this;

      Utils.debug("Received request from", this._peerId, ":", request.method);

      this._requestHandler.handle(request, function(response) {
        self._connectionFactory.create(self._peerId, function(connection, error) {
          if (error) {
            console.log(error);
            return;
          }

          self._nodeFactory.setListenersToConnection(connection);

          Utils.debug("Sending response to", self._peerId, ":", response.method);

          connection.send(response);
        });
      });
    },

    onResponseReceived: function(response) {
      Utils.debug("Received response from", this._peerId, ":", response.method, "(", response.status, ")");

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

  module.exports = Node;
})();
