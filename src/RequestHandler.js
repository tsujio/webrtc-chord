define(['underscore', 'ID', 'Response', 'Entry', 'Utils'], function(_, ID, Response, Entry, Utils) {
  var RequestHandler = function(localNode, nodeFactory) {
    this._localNode = localNode;
    this._nodeFactory = nodeFactory;
  }

  RequestHandler.prototype = {
    handle: function(request, callback) {
      var self = this;

      switch (request.method) {
      case 'FIND_SUCCESSOR':
        if (!Utils.isNonemptyString(request.params.key)) {
          this._sendFailureResponse(request, callback);
          return;
        }

        var key = ID.fromHexString(request.params.key);
        this._localNode.findSuccessor(key, function(successor) {
          if (_.isNull(successor)) {
            self._sendFailureResponse(request, callback);
            return;
          }

          self._sendSuccessResponse({
            successorNodeInfo: successor.toNodeInfo()
          }, request, callback);
        });
        break;

      case 'NOTIFY_AND_COPY':
        var potentialPredecessorNodeInfo = request.params.potentialPredecessorNodeInfo;
        this._nodeFactory.create(potentialPredecessorNodeInfo, function(node) {
          if (_.isNull(node)) {
            this._sendFailureResponse(request, callback);
            return;
          }

          self._localNode.notifyAndCopyEntries(node, function(references, entries) {
            if (_.isNull(references) || _.isNull(entries)) {
              self._sendFailureResponse(request, callback);
              return;
            }

            self._sendSuccessResponse({
              referencesNodeInfo: _.invoke(references, 'toNodeInfo'),
              entries: _.invoke(entries, 'toJson')
            }, request, callback);
          });
        });
        break;

      case 'NOTIFY':
        var potentialPredecessorNodeInfo = request.params.potentialPredecessorNodeInfo;
        this._nodeFactory.create(potentialPredecessorNodeInfo, function(node) {
          if (_.isNull(node)) {
            self._sendFailureResponse(request, callback);
            return;
          }

          self._localNode.notify(node, function(references) {
            if (_.isNull(references)) {
              self._sendFailureResponse(request, callback);
              return;
            }

            self._sendSuccessResponse({
              referencesNodeInfo: _.invoke(references, 'toNodeInfo')
            }, request, callback);
          });
        });
        break;

      case 'PING':
        self._sendSuccessResponse({}, request, callback);
        break;

      case 'INSERT_REPLICAS':
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
        self._localNode.insertReplicas(replicas);
        break;

      case 'REMOVE_REPLICAS':
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
        self._localNode.removeReplicas(sendingNodeId, replicas);
        break;

      case 'INSERT_ENTRY':
        var entry;
        try {
          entry = Entry.fromJson(request.params.entry);
        } catch (e) {
          self._sendFailureResponse(request, callback);;
          return;
        }
        self._localNode.insertEntry(entry, function(inserted) {
          if (!inserted) {
            self._sendFailureResponse(request, callback);
          } else {
            self._sendSuccessResponse({}, request, callback);
          }
        });
        break;

      case 'RETRIEVE_ENTRIES':
        var id;
        try {
          id = ID.fromHexString(request.params.id);
        } catch (e) {
          self._sendFailureResponse(request, callback);
          return;
        }
        self._localNode.retrieveEntries(id, function(entries) {
          if (_.isNull(entries)) {
            self._sendFailureResponse(request, callback);
          } else {
            self._sendSuccessResponse({
              entries: _.invoke(entries, 'toJson')
            }, request, callback);
          }
        });
        break;

      case 'REMOVE_ENTRY':
        var entry;
        try {
          entry = Entry.fromJson(request.params.entry);
        } catch (e) {
          self._sendFailureResponse(request, callback);
          return;
        }
        self._localNode.removeEntry(entry, function(removed) {
          if (!removed) {
            self._sendFailureResponse(request, callback);
          } else {
            self._sendSuccessResponse({}, request, callback);
          }
        });
        break;

      case 'SHUTDOWN':
        break;

      case 'LEAVES_NETWORK':
        var predecessorNodeInfo = request.params.predecessorNodeInfo;
        this._nodeFactory.create(predecessorNodeInfo, function(predecessor) {
          if (_.isNull(predecessor)) {
            return;
          }

          self._localNode.leavesNetwork(predecessor);
        });
        break;

      default:
        this._sendFailureResponse(request, callback);
        break;
      }
    },

    _sendSuccessResponse: function(result, request, callback) {
      var self = this;

      var response;
      try {
        response = Response.create('SUCCESS', result, request);
      } catch (e){
        this._sendFailureResponse(request, callback);
        return;
      }

      callback(response);
    },

    _sendFailureResponse: function(request, callback) {
      var response;
      try {
        response = Response.create('FAILED', {}, request);
      } catch (e) {
        callback(null);
        return;
      }

      callback(response);
    }
  };

  return RequestHandler;
});