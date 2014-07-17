(function() {
  var _ = require('lodash');
  var ID = require('./ID');
  var Response = require('./Response');
  var Entry = require('./Entry');
  var Utils = require('./Utils');

  var RequestHandler = function(localNode, nodeFactory) {
    this._localNode = localNode;
    this._nodeFactory = nodeFactory;
    this._handlers = {
      'FIND_SUCCESSOR': this._onFindSuccessor,
      'NOTIFY_AND_COPY': this._onNotifyAndCopy,
      'NOTIFY': this._onNotify,
      'PING': this._onPing,
      'INSERT_REPLICAS': this._onInsertReplicas,
      'REMOVE_REPLICAS': this._onRemoveReplicas,
      'INSERT_ENTRY': this._onInsertEntry,
      'RETRIEVE_ENTRIES': this._onRetrieveEntries,
      'REMOVE_ENTRY': this._onRemoveEntry,
      'LEAVES_NETWORK': this._onLeavesNetwork,
    };
  }

  RequestHandler.prototype = {
    handle: function(request, callback) {
      var handler = this._handlers[request.method];
      if (!handler) {
        this._sendFailureResponse("Unknown request method type: " + request.method, request, callback);
        return;
      }

      handler.call(this, request, callback);
    },

    _onFindSuccessor: function(request, callback) {
      var self = this;

      if (!Utils.isNonemptyString(request.params.key)) {
        this._sendFailureResponse("Invalid params.", request, callback);
        return;
      }

      var key = ID.fromHexString(request.params.key);
      this._localNode.findSuccessorIterative(key, function(status, node, error) {
        if (error) {
          console.log(error);
          self._sendFailureResponse(e.message, request, callback);
          return;
        }

        if (status === 'SUCCESS') {
          self._sendSuccessResponse({
            successorNodeInfo: node.toNodeInfo()
          }, request, callback);
        } else if (status === 'REDIRECT') {
          self._sendRedirectResponse({
            redirectNodeInfo: node.toNodeInfo()
          }, request, callback);
        }
      });
    },

    _onNotifyAndCopy: function(request, callback) {
      var self = this;

      var potentialPredecessorNodeInfo = request.params.potentialPredecessorNodeInfo;
      this._nodeFactory.create(potentialPredecessorNodeInfo, function(node, error) {
        if (error) {
          console.log(error);
          this._sendFailureResponse(e.message, request, callback);
          return;
        }

        self._localNode.notifyAndCopyEntries(node, function(references, entries) {
          if (_.isNull(references) || _.isNull(entries)) {
            self._sendFailureResponse("Unknown error.", request, callback);
            return;
          }

          self._sendSuccessResponse({
            referencesNodeInfo: _.invoke(references, 'toNodeInfo'),
            entries: _.invoke(entries, 'toJson')
          }, request, callback);
        });
      });
    },

    _onNotify: function(request, callback) {
      var self = this;

      var potentialPredecessorNodeInfo = request.params.potentialPredecessorNodeInfo;
      this._nodeFactory.create(potentialPredecessorNodeInfo, function(node, error) {
        if (error) {
          console.log(error);
          self._sendFailureResponse(e.message, request, callback);
          return;
        }

        self._localNode.notify(node, function(references) {
          if (_.isNull(references)) {
            self._sendFailureResponse("Unknown error.", request, callback);
            return;
          }

          self._sendSuccessResponse({
            referencesNodeInfo: _.invoke(references, 'toNodeInfo')
          }, request, callback);
        });
      });
    },

    _onPing: function(request, callback) {
      this._sendSuccessResponse({}, request, callback);
    },

    _onInsertReplicas: function(request, callback) {
      if (!_.isArray(request.params.replicas)) {
        return;
      }
      var replicas = _.chain(request.params.replicas)
        .map(function(replica) {
          try {
            return Entry.fromJson(replica);
          } catch (e) {
            return null;
          }
        })
        .reject(function(replica) { return _.isNull(replica); })
        .value();
      this._localNode.insertReplicas(replicas);
    },

    _onRemoveReplicas: function(request, callback) {
      var sendingNodeId;
      try {
        sendingNodeId = ID.fromHexString(request.params.sendingNodeId);
      } catch (e) {
        return;
      }
      if (!_.isArray(request.params.replicas)) {
        return;
      }
      var replicas = _.chain(request.params.replicas)
        .map(function(replica) {
          try {
            return Entry.fromJson(replica);
          } catch (e) {
            return null;
          }
        })
        .reject(function(replica) { return _.isNull(replica); })
        .value();
      this._localNode.removeReplicas(sendingNodeId, replicas);
    },

    _onInsertEntry: function(request, callback) {
      var self = this;

      var entry;
      try {
        entry = Entry.fromJson(request.params.entry);
      } catch (e) {
        this._sendFailureResponse(e.message, request, callback);;
        return;
      }
      this._localNode.insertEntryIterative(entry, function(status, node, error) {
        if (error) {
          console.log("Failed to insert entry:", error);
          self._sendFailureResponse("Unknown error.", request, callback);
          return;
        }

        if (status === 'SUCCESS') {
          self._sendSuccessResponse({}, request, callback);
        } else if (status === 'REDIRECT') {
          self._sendRedirectResponse({
            redirectNodeInfo: node.toNodeInfo()
          }, request, callback);
        }
      });
    },

    _onRetrieveEntries: function(request, callback) {
      var self = this;

      var id;
      try {
        id = ID.fromHexString(request.params.id);
      } catch (e) {
        this._sendFailureResponse(e.message, request, callback);
        return;
      }
      this._localNode.retrieveEntriesIterative(id, function(status, entries, node, error) {
        if (error) {
          console.log("Failed to retrieve entries:", error);
          self._sendFailureResponse("Unknown error.", request, callback);
          return;
        }

        if (status === 'SUCCESS') {
          self._sendSuccessResponse({
            entries: _.invoke(entries, 'toJson')
          }, request, callback);
        } else if (status === 'REDIRECT') {
          self._sendRedirectResponse({
            redirectNodeInfo: node.toNodeInfo()
          }, request, callback);
        }
      });
    },

    _onRemoveEntry: function(request, callback) {
      var self = this;

      var entry;
      try {
        entry = Entry.fromJson(request.params.entry);
      } catch (e) {
        this._sendFailureResponse(e.message, request, callback);
        return;
      }
      this._localNode.removeEntryIterative(entry, function(status, node, error) {
        if (error) {
          console.log("Failed to remove entry:", error);
          self._sendFailureResponse("Unknown error.", request, callback);
          return;
        }

        if (status === 'SUCCESS') {
          self._sendSuccessResponse({}, request, callback);
        } else if (status === 'REDIRECT') {
          self._sendRedirectResponse({
            redirectNodeInfo: node.toNodeInfo()
          }, request, callback);
        }
      });
    },

    _onLeavesNetwork: function(request, callback) {
      var self = this;

      var predecessorNodeInfo = request.params.predecessorNodeInfo;
      this._nodeFactory.create(predecessorNodeInfo, function(predecessor, error) {
        if (error) {
          console.log(error);
          return;
        }

        self._localNode.leavesNetwork(predecessor);
      });
    },

    _sendSuccessResponse: function(result, request, callback) {
      this._sendResponse('SUCCESS', result, request, callback);
    },

    _sendRedirectResponse: function(result, request, callback) {
      this._sendResponse('REDIRECT', result, request, callback);
    },

    _sendResponse: function(status, result, request, callback) {
      var self = this;

      var response;
      try {
        response = Response.create(status, result, request);
      } catch (e) {
        this._sendFailureResponse(e.message, request, callback);
        return;
      }

      callback(response);
    },

    _sendFailureResponse: function(message, request, callback) {
      var response;
      try {
        response = Response.create('FAILED', {message: message}, request);
      } catch (e) {
        return;
      }

      callback(response);
    }
  };

  module.exports = RequestHandler;
})();
