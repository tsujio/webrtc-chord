define(['underscore', 'FingerTable', 'SuccessorList'], function(_, FingerTable, SuccessorList) {
  var ReferenceList = function(localId, entries, config) {
    if (_.isNull(localId) || _.isNull(entries)) {
      throw new Error("Invalid arguments.");
    }

    this._localId = localId;
    this._fingerTable = new FingerTable(localId, this);
    this._successors = new SuccessorList(localId, entries, this, config);
    this._predecessor = null;
    this._entries = entries;
  };

  ReferenceList.prototype = {
    addReference: function(reference) {
      if (_.isNull(reference)) {
        throw new Error("Invalid argument.");
      }

      if (reference.nodeId.equals(this._localId)) {
        return;
      }

      this._fingerTable.addReference(reference);
      this._successors.addSuccessor(reference);
    },

    removeReference: function(reference) {
      if (_.isNull(reference)) {
        throw new Error("Invalid argument.");
      }

      this._fingerTable.removeReference(reference);
      this._successors.removeReference(reference);

      if (reference.equals(this.getPredecessor())) {
        this._predecessor = null;
      }

      this.disconnectIfUnreferenced(reference);
    },

    getSuccessor: function() {
      return this._successors.getDirectSuccessor();
    },

    getSuccessors: function() {
      return this._successors.getReferences();
    },

    getClosestPrecedingNode: function(key) {
      if (_.isNull(key)) {
        throw new Error("Invalid argument.");
      }

      var foundNodes = [];

      var closestNodeFT = this._fingerTable.getClosestPrecedingNode(key);
      if (!_.isNull(closestNodeFT)) {
        foundNodes.push(closestNodeFT);
      }
      var closestNodeSL = this._successors.getClosestPrecedingNode(key);
      if (!_.isNull(closestNodeSL)) {
        foundNodes.push(closestNodeSL);
      }
      if (!_.isNull(this._predecessor) &&
          key.isInInterval(this._predecessor.nodeId, this._localId)) {
        foundNodes.push(this._predecessor);
      }

      foundNodes.sort(function(a, b) {
          return a.nodeId.compareTo(b.nodeId);
      });
      var keyIndex = _.chain(foundNodes)
        .map(function(node) { return node.nodeId; })
        .sortedIndex(function(id) { return id.equals(key); })
        .value();
      var index = (_.size(foundNodes) + (keyIndex - 1)) % _.size(foundNodes);
      var closestNode = foundNodes[index];
      if (_.isNull(closestNode)) {
        throw new Error("Closest node must not be null.");
      }
      return closestNode;
    },

    getPredecessor: function() {
      return this._predecessor;
    },

    addReferenceAsPredecessor: function(potentialPredecessor) {
      if (_.isNull(potentialPredecessor)) {
        throw new Error("Invalid argument.");
      }

      if (potentialPredecessor.nodeId.equals(this._localId)) {
        return;
      }

      if (_.isNull(this._predecessor) ||
          potentialPredecessor.nodeId.isInInterval(this._predecessor.nodeId, this._localId)) {
        this.setPredecessor(potentialPredecessor);
      }

      this.addReference(potentialPredecessor);
    },

    setPredecessor: function(potentialPredecessor) {
      if (_.isNull(potentialPredecessor)) {
        throw new Error("Invalid argument.");
      }

      if (potentialPredecessor.nodeId.equals(this._localId)) {
        return;
      }

      if (potentialPredecessor.equals(this._predecessor)) {
        return;
      }

      var formerPredecessor = this._predecessor;
      this._predecessor = potentialPredecessor;
      if (!_.isNull(formerPredecessor)) {
        this.disconnectIfUnreferenced(formerPredecessor);

        var size = this._successors.getSize();
        if (this._successors.getCapacity() === size) {
          var lastSuccessor = _.last(this._successors.getReferences());
          lastSuccessor.removeReplicas(this._predecessor.nodeId, []);
        }
      } else {
        var entriesToRep = this._entries.getEntriesInInterval(this._predecessor.nodeId, this._localId);
        var successors = this._successors.getReferences();
        _.each(successors, function(successor) {
          successor.insertReplicas(entriesToRep);
        });
      }
    },

    disconnectIfUnreferenced: function(removedReference) {
      if (_.isNull(removedReference)) {
        throw new Error("Invalid argument.");
      }

      if (!this.containsReference(removedReference)) {
        removedReference.disconnect();
      }
    },

    getFirstFingerTableEntries: function(count) {
      return this._fingerTable.getFirstFingerTableEntries(count);
    },

    containsReference: function(reference) {
      if (_.isNull(reference)) {
        throw new Error("Invalid argurment.");
      }

      return (this._fingerTable.containsReference(reference) ||
              this._successors.containsReference(reference) ||
              reference.equals(this._predecessor));
    },

    getStatuses: function() {
      return {
        successors: this._successors.getStatus(),
        fingerTable: this._fingerTable.getStatus(),
        predecessor: _.isNull(this.getPredecessor()) ? null : this.getPredecessor().toNodeInfo()
      };
    },

    toString: function() {
      return [
        this._successors.toString(),
        "[Predecessor]\n" + (_.isNull(this.getPredecessor()) ? "" : this.getPredecessor().toString()) + "\n",
        this._fingerTable.toString()
      ].join("\n") + "\n";
    }
  };

  return ReferenceList;
});
