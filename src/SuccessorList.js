define(['underscore', 'Utils'], function(_, Utils) {
  var SuccessorList = function(localId, entries, references, config) {
    if (_.isNull(localId) || _.isNull(entries) || _.isNull(references)) {
      throw new Error("Invalid argument.");
    }

    if (!Utils.isPositiveNumber(config.numberOfEntriesInSuccessorList)) {
      config.numberOfEntriesInSuccessorList = 3;
    }

    this._localId = localId;
    this._capacity = config.numberOfEntriesInSuccessorList;
    this._entries = entries;
    this._references = references;
    this._successors = [];
  };

  SuccessorList.prototype = {
    addSuccessor: function(node) {
      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      if (this.containsReference(node)) {
        return;
      }

      if (_.size(this._successors) >= this._capacity &&
          node.nodeId.isInInterval(_.last(this._successors).nodeId, this._localId)) {
        return;
      }

      var inserted = false;
      for (var i = 0; i < _.size(this._successors); i++) {
        if (node.nodeId.isInInterval(this._localId, this._successors[i].nodeId)) {
          Utils.insert(this._successors, i, node);
          inserted = true;
          break;
        }
      }
      if (!inserted) {
        this._successors.push(node);
        inserted = true;
      }

      var fromId;
      var predecessor = this._references.getPredecessor();
      if (!_.isNull(predecessor)) {
        fromId = predecessor.nodeId;
      } else {
        var precedingNode = this._references.getClosestPrecedingNode(this._localId);
        if (!_.isNull(precedingNode)) {
          fromId = precedingNode.nodeId;
        } else {
          fromId = this._localId;
        }
      }
      var toId = this._localId;
      var entriesToReplicate = this._entries.getEntriesInInterval(fromId, toId);
      node.insertReplicas(entriesToReplicate);

      if (_.size(this._successors) > this._capacity) {
        var nodeToDelete = this._successors.pop();

        nodeToDelete.removeReplicas(this._localId, []);

        this._references.disconnectIfUnreferenced(nodeToDelete);
      }
    },

    getDirectSuccessor: function() {
      if (_.isEmpty(this._successors)) {
	return null;
      }
      return this._successors[0];
    },

    getClosestPrecedingNode: function(idToLookup) {
      if (_.isNull(idToLookup)) {
        throw new Error("Invalid argument.");
      }

      for (var i = _.size(this._successors) - 1; i >= 0; i--) {
        if (this._successors[i].nodeId.isInInterval(this._localId, idToLookup)) {
          return this._successors[i];
        }
      }
      return null;
    },

    getReferences: function() {
      return this._successors;
    },

    removeReference: function(node) {
      var self = this;

      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      this._successors = _.reject(this._successors, function(s) {
        return s.equals(node);
      });

      var referencesOfFingerTable = this._references.getFirstFingerTableEntries(this._capacity);
      referencesOfFingerTable = _.reject(referencesOfFingerTable, function(r) {
        return r.equals(node);
      });
      _.each(referencesOfFingerTable, function(reference) {
        self.addSuccessor(reference);
      });
    },

    getSize: function() {
      return _.size(this._successors);
    },

    getCapacity: function() {
      return this._capacity;
    },

    containsReference: function(node) {
      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      return !_.isUndefined(_.find(this._successors, function(n) {
        return n.equals(node);
      }));
    },

    getStatus: function() {
      return _.invoke(this._successors, 'toNodeInfo');
    },

    toString: function() {
      return "[Successors]\n" + _.map(this._successors, function(node, index) {
        return "[" + index + "] " + node.toString();
      }).join("\n") + "\n";
    }
  };

  return SuccessorList;
});
