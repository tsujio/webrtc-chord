define(['underscore'], function(_) {
  var FingerTable = function(localId, references) {
    if (_.isNull(localId) || _.isNull(references)) {
      throw new Error("Invalid arguments.");
    }

    this._localId = localId;
    this._references = references;
    this._remoteNodes = _(this._localId.getLength()).times(function() { return null; });
  };

  FingerTable.prototype = {
    _setEntry: function(index, node) {
      if (!_.isNumber(index) || _.isNull(node)) {
        throw new Error("Invalid arguments.");
      }
      if (index < 0 || index >= _.size(this._remoteNodes)) {
        throw new Error("Invalid index.");
      }

      this._remoteNodes[index] = node;
    },

    _getEntry: function(index) {
      if (!_.isNumber(index)) {
        throw new Error("Invalid argument.");
      }
      if (index < 0 || index >= _.size(this._remoteNodes)) {
        throw new Error("Invalid index.");
      }

      return this._remoteNodes[index];
    },

    _unsetEntry: function(index) {
      if (!_.isNumber(index)) {
        throw new Error("Invalid argument.");
      }
      if (index < 0 || index >= _.size(this._remoteNodes)) {
        throw new Error("Invalid index.");
      }

      var overwrittenNode = this._getEntry(index);

      this._remoteNodes[index] = null;

      if (!_.isNull(overwrittenNode)) {
        this._references.disconnectIfUnreferenced(overwrittenNode);
      }
    },

    addReference: function(node) {
      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      for (var i = 0; i < _.size(this._remoteNodes); i++) {
        var startOfInterval = this._localId.addPowerOfTwo(i);
        if (!startOfInterval.isInInterval(this._localId, node.nodeId)) {
          break;
        }

        if (_.isNull(this._getEntry(i))) {
          this._setEntry(i, node);
        } else if (node.nodeId.isInInterval(this._localId, this._getEntry(i).nodeId)) {
          var oldEntry = this._getEntry(i);
          this._setEntry(i, node);
          this._references.disconnectIfUnreferenced(oldEntry);
        }
      }
    },

    getClosestPrecedingNode: function(key) {
      if (_.isNull(key)) {
        throw new Error("Invalid argument.");
      }

      for (var i = _.size(this._remoteNodes) - 1; i >= 0; i--) {
        if (!_.isNull(this._getEntry(i)) &&
            this._getEntry(i).nodeId.isInInterval(this._localId, key)) {
          return this._getEntry(i);
        }
      }
      return null;
    },

    removeReference: function(node) {
      var self = this;

      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      var referenceForReplacement = null;
      for (var i = _.size(this._remoteNodes) - 1; i >= 0; i--) {
        var n = this._getEntry(i);
        if (node.equals(n)) {
          break;
        }
        if (!_.isNull(n)) {
          referenceForReplacement = n;
        }
      }

      _.each(this._remoteNodes, function(n, i) {
        if (node.equals(self._getEntry(i))) {
          if (_.isNull(referenceForReplacement)) {
            self._unsetEntry(i);
          } else {
            self._setEntry(i, referenceForReplacement);
          }
        }
      });

      _.chain(this._references.getSuccessors())
        .reject(function(s) { return s.equals(node); })
        .each(function(s) { self.addReference(s); });
    },

    getFirstFingerTableEntries: function(count) {
      var result = [];
      for (var i = 0; i < _.size(this._remoteNodes); i++) {
        if (!_.isNull(this._getEntry(i))) {
          if (_.isEmpty(result) || !_.last(result).equals(this._getEntry(i))) {
            result.push(this._getEntry(i));
          }
        }
        if (_.size(result) >= count) {
          break;
        }
      }
      return result;
    },

    containsReference: function(reference) {
      if (_.isNull(reference)) {
        throw new Error("Invalid argument.");
      }

      return _.some(this._remoteNodes, function(node) {
        return reference.equals(node);
      });
    },

    getStatus: function() {
      var self = this;
      return _.map(this._remoteNodes, function(node) {
        return _.isNull(node) ? null : node.toNodeInfo();
      });
    },

    toString: function() {
      var self = this;

      return "[FingerTable]\n" + _.chain(this._remoteNodes)
        .map(function(node, i) {
          if (_.isNull(node)) {
            return "";
          }

          if (i === 0 || (i > 0 && !node.equals(self._getEntry(i - 1)))) {
            return "[" + i + "] " + node.toString();
          }

          if (i === _.size(self._remoteNodes) - 1 ||
              !node.equals(self._getEntry(i + 1))) {
            return "[" + i + "]";
          }

          if ((i > 1 &&
               node.equals(self._getEntry(i - 1)) &&
               !node.equals(self._getEntry(i - 2))) ||
              (i === 1 && node.equals(self._getEntry(i - 1)))) {
            return "..."
          }

          if (i > 1 &&
              node.equals(self._getEntry(i - 1)) &&
              node.equals(self._getEntry(i - 2))) {
            return "";
          }

          throw new Error("Unknown situation.");
        })
        .reject(function(str) { return str === ""; })
        .value()
        .join("\n") + "\n";
    }
  };

  return FingerTable;
});
