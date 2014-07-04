define([
  'lodash', 'NodeFactory', 'EntryList', 'Entry', 'ReferenceList', 'ID', 'StabilizeTask',
  'FixFingerTask', 'CheckPredecessorTask', 'Utils'
], function(
  _, NodeFactory, EntryList, Entry, ReferenceList, ID, StabilizeTask, FixFingerTask, CheckPredecessorTask, Utils
) {
  var LocalNode = function(chord, config) {
    if (!Utils.isPositiveNumber(config.maximumNumberOfAttemptsOfNotifyAndCopyOnJoin)) {
      config.maximumNumberOfAttemptsOfNotifyAndCopyOnJoin = 5;
    }

    this._chord = chord;
    this._config = config;
    this.nodeId = null;
    this._peerId = null;
    this._nodeFactory = null;
    this._tasks = {};
    this._entries = null;
    this._references = null;
  };

  LocalNode.create = function(chord, config, callback) {
    var localNode = new LocalNode(chord, config);
    NodeFactory.create(localNode, config, function(peerId, factory, error) {
      if (error) {
        callback(null, error);
        return;
      }

      localNode.setup(peerId, factory);

      callback(localNode);
    });
  };

  LocalNode.prototype = {
    setup: function(peerId, nodeFactory) {
      this._peerId = peerId;
      this.nodeId = ID.create(peerId);
      this._nodeFactory = nodeFactory;
      this._entries = new EntryList();
      this._references = new ReferenceList(this.nodeId, this._entries, this._config);
    },

    _createTasks: function() {
      this._tasks = {
        stabilizeTask: StabilizeTask.create(this, this._references, this._entries, this._config),
        fixFingerTask: FixFingerTask.create(this, this._references, this._config),
        checkPredecessorTask: CheckPredecessorTask.create(this._references, this._config)
      };

      Utils.debug("Created tasks.");
    },

    _shutdownTasks: function() {
      _.invoke(this._tasks, 'shutdown');

      Utils.debug("Shutdown tasks.");
    },

    create: function(callback) {
      this._createTasks();

      Utils.debug("Created network (peer ID:", this._peerId, ").");

      callback(this._peerId);
    },

    join: function(bootstrapId, callback) {
      var self = this;

      Utils.debug("Trying to join network.");

      this._nodeFactory.create({peerId: bootstrapId}, function(bootstrapNode, error) {
        if (error) {
          callback(null, error);
          return;
        }

        self._references.addReference(bootstrapNode);

        bootstrapNode.findSuccessor(self.nodeId, function(successor, error) {
          if (error) {
            Utils.debug("[join] Failed to find successor:", error);
            self._references.removeReference(bootstrapNode);
            callback(null, error);
            return;
          }

          Utils.debug("[join] Found successor:", successor.getPeerId());

          self._references.addReference(successor);

          var _notifyAndCopyEntries = function(node, attempts, callback) {
            Utils.debug("[join] Trying to notify and copy entries "+ 
                        "(remote peer ID:", node.getPeerId(), ", attempts:", attempts, ").");

            if (attempts === 0) {
              console.log("Reached maximum number of attempts of NOTIFY_AND_COPY.");
              callback([], []);
              return;
            }

            node.notifyAndCopyEntries(self, function(refs, entries, error) {
              if (error) {
                Utils.debug("[join] Failed to notify and copy entries (remote peer ID:", node.getPeerId(), ").");
                callback(null, null, error);
                return;
              }

              if (_.size(refs) === 1) {
                Utils.debug("[join]", successor.getPeerId(), "is successor and also predecessor.");
                self._references.addReferenceAsPredecessor(successor);
                callback(refs, entries);
                return;
              }

              if (refs[0].equals(self)) {
                Utils.debug("[join] Left predecessor as null.");
                callback(refs, entries);
                return;
              }

              if (self.nodeId.isInInterval(refs[0].nodeId, successor.nodeId)) {
                Utils.debug("[join]", refs[0].getPeerId(), "is predecessor.");
                self._references.addReferenceAsPredecessor(refs[0]);
                callback(refs, entries);
                return;
              }

              Utils.debug("[join] Failed to find predecessor. Retry to notify and copy entries.");

              self._references.addReference(refs[0]);
              _notifyAndCopyEntries(refs[0], attempts - 1, callback);
            });
          };
          var maximumNumberOfAttempts = self._config.maximumNumberOfAttemptsOfNotifyAndCopyOnJoin;
          _notifyAndCopyEntries(successor, maximumNumberOfAttempts, function(refs, entries, error) {
            if (error) {
              console.log("Failed to notify and copy entries:", error);
              self._createTasks();
              callback(self._peerId);
              return;
            }

            _.each(refs, function(ref) {
              if (!_.isNull(ref) && !ref.equals(self) &&
                  !self._references.containsReference(ref)) {
                self._references.addReference(ref);
              }
            });

            self._entries.addAll(entries);

            _.defer(function() {
              self._chord.onentriesinserted(_.invoke(entries, 'toJson'));
            });

            self._createTasks();

            Utils.debug("Joining network succeeded.");

            callback(self._peerId);
          });
        });
      });
    },

    leave: function(callback) {
      var self = this;

      this._shutdownTasks();

      var successor = this._references.getSuccessor();
      if (!_.isNull(successor) && !_.isNull(this._references.getPredecessor())) {
        successor.leavesNetwork(this._references.getPredecessor());
      }

      this._nodeFactory.destroy();

      Utils.debug("Left network.");

      callback();
    },

    insert: function(key, value, callback) {
      var id = ID.create(key);
      var entry;
      try {
        entry = new Entry(id, value);
      } catch (e) {
        callback(e);
        return;
      }

      this.findSuccessor(entry.id, function(successor, error) {
        if (error) {
          callback(error);
          return;
        }

        successor.insertEntry(entry, callback);
      });
    },

    retrieve: function(key, callback) {
      var id = ID.create(key);

      this.findSuccessor(id, function(successor, error) {
        if (error) {
          callback(null, error);
          return;
        }

        successor.retrieveEntries(id, function(entries, error) {
          if (error) {
            callback(null, error);
            return;
          }

          callback(_.map(entries, function(entry) { return entry.value; }));
        });
      });
    },

    remove: function(key, value, callback) {
      var id = ID.create(key);
      var entry;
      try {
        entry = new Entry(id, value);
      } catch (e) {
        callback(e);
        return;
      }

      this.findSuccessor(entry.id, function(successor, error) {
        if (error) {
          callback(error);
          return;
        }

        successor.removeEntry(entry, callback);
      });
    },

    
    getEntries: function() {
      return this._entries.dump();
    },

    setEntries: function(entries) {
      this._entries.addAll(_.map(entries, function(entry) {
        return Entry.fromJson(entry);
      }));
    },

    findSuccessor: function(key, callback) {
      var self = this;

      if (_.isNull(key)) {
        callback(null, new Error("Invalid argument."));
        return;
      }

      if (!this._references.getPredecessor() ||
          key.isInInterval(this._references.getPredecessor().nodeId, this.nodeId) ||
          key.equals(this.nodeId)) {
        callback(this);
        return;
      }

      var nextNode = this._references.getClosestPrecedingNode(key);
      if (!nextNode) {
        var successor = this._references.getSuccessor();
        if (!successor) {
          callback(this);
          return;
        }

        nextNode = successor;
      }

      nextNode.findSuccessor(key, function(successor, error) {
        if (error) {
          console.log(error);
          self._references.removeReference(nextNode);
          self.findSuccessor(key, callback);
          return;
        }

        callback(successor);
      });
    },

    findSuccessorIterative: function(key, callback) {
      var self = this;

      if (_.isNull(key)) {
        callback('FAILED', null, new Error("Invalid argument."));
        return;
      }

      if (!this._references.getPredecessor() ||
          key.isInInterval(this._references.getPredecessor().nodeId, this.nodeId) ||
          key.equals(this.nodeId)) {
        callback('SUCCESS', this);
        return;
      }

      var nextNode = this._references.getClosestPrecedingNode(key);
      if (!nextNode) {
        var successor = this._references.getSuccessor();
        if (!successor) {
          callback('SUCCESS', this);
          return;
        }

        nextNode = successor;
      }

      callback('REDIRECT', nextNode);
    },

    notifyAndCopyEntries: function(potentialPredecessor, callback) {
      var self = this;

      var references = this.notify(potentialPredecessor, function(references) {
        var entries = self._entries.getEntriesInInterval(self.nodeId, potentialPredecessor.nodeId);

        callback(references, entries);
      });
    },

    notify: function(potentialPredecessor, callback) {
      var references = [];
      if (!_.isNull(this._references.getPredecessor())) {
        references.push(this._references.getPredecessor());
      } else {
        references.push(potentialPredecessor);
      }
      references = references.concat(this._references.getSuccessors());

      this._references.addReferenceAsPredecessor(potentialPredecessor);

      callback(references);
    },

    leavesNetwork: function(predecessor) {
      this._references.removeReference(this._references.getPredecessor());
      this._references.addReferenceAsPredecessor(predecessor);
    },

    insertReplicas: function(replicas) {
      var self = this;

      this._entries.addAll(replicas);

      _.defer(function() {
        self._chord.onentriesinserted(_.invoke(replicas, 'toJson'));
      });
    },

    removeReplicas: function(sendingNodeId, replicas) {
      var self = this;

      if (_.size(replicas) !== 0) {
        this._entries.removeAll(replicas);

        _.defer(function() {
          self._chord.onentriesremoved(_.invoke(replicas, 'toJson'));
        });

        return;
      }

      var allReplicasToRemove = this._entries.getEntriesInInterval(this.nodeId, sendingNodeId);
      this._entries.removeAll(allReplicasToRemove);

      _.defer(function() {
        self._chord.onentriesremoved(_.invoke(allReplicasToRemove, 'toJson'));
      });
    },

    insertEntry: function(entry, callback) {
      this.insertEntryIterative(entry, function(status, node) {
        if (status === 'SUCCESS') {
          callback();
        } else if (status === 'REDIRECT') {
          node.insertEntry(entry, callback);
        } else {
          callback(new Error("Got unknown status:", status));
        }
      });
    },

    insertEntryIterative: function(entry, callback) {
      var self = this;

      if (this._references.getPredecessor() &&
          !entry.id.isInInterval(this._references.getPredecessor().nodeId, this.nodeId) &&
          !entry.id.equals(this.nodeId)) {
        callback('REDIRECT', this._references.getPredecessor());
        return;
      }

      this._entries.add(entry);

      _.defer(function() {
        self._chord.onentriesinserted([entry.toJson()]);
      });

      _.each(this._references.getSuccessors(), function(successor) {
        successor.insertReplicas([entry]);
      });

      callback('SUCCESS');
    },

    retrieveEntries: function(id, callback) {
      this.retrieveEntriesIterative(id, function(status, entries, node) {
        if (status === 'SUCCESS') {
          callback(entries);
        } else if (status === 'REDIRECT') {
          node.retrieveEntries(id, callback);
        } else {
          callback(null, new Error("Got unknown status:", status));
        }
      });
    },

    retrieveEntriesIterative: function(id, callback) {
      if (this._entries.has(id)) {
        callback('SUCCESS', this._entries.getEntries(id));
        return;
      }

      if (this._references.getPredecessor() &&
          !id.isInInterval(this._references.getPredecessor().nodeId, this.nodeId) &&
          !id.equals(this.nodeId)) {
        callback('REDIRECT', null, this._references.getPredecessor());
        return;
      }

      callback('SUCCESS', this._entries.getEntries(id));
    },

    removeEntry: function(entry, callback) {
       this.removeEntryIterative(entry, function(status, node) {
        if (status === 'SUCCESS') {
          callback();
        } else if (status === 'REDIRECT') {
          node.removeEntry(entry, callback);
        } else {
          callback(new Error("Got unknown status:", status));
        }
      });
    },

    removeEntryIterative: function(entry, callback) {
      var self = this;

      if (this._references.getPredecessor() &&
          !entry.id.isInInterval(this._references.getPredecessor().nodeId, this.nodeId) &&
          !entry.id.equals(this.nodeId)) {
        callback('REDIRECT', this._references.getPredecessor());
        return;
      }

      this._entries.remove(entry);

      _.defer(function() {
        self._chord.onentriesremoved([entry.toJson()]);
      });

      _.each(this._references.getSuccessors(), function(successor) {
        successor.removeReplicas(self.nodeId, [entry]);
      });

      callback('SUCCESS');
    },

    getStatuses: function() {
      var ret = this._references.getStatuses();
      ret['entries'] = this._entries.getStatus();
      return ret;
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
    },

    toDisplayString: function() {
      return [
        this._references.toString(),
        this._entries.toString()
      ].join("\n") + "\n";
    }
  };

  return LocalNode;
});
