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

      if (node.nodeId.equals(this._localId)) {
        return;
      }

      var index = node.nodeId.getIntervalInPowerOfTwoFrom(this._localId);
      for (var i = index + 1; i < this._localId.getLength(); i++) {
        if (_.isNull(this._getEntry(i))) {
          this._setEntry(i, node);
        } else if (node.nodeId.isInInterval(this._getEntry(i).nodeId, this._localId.addPowerOfTwo(i))) {
          var oldEntry = this._getEntry(i);
          this._setEntry(i, node);
          this._references.disconnectIfUnreferenced(oldEntry);
        } else {
          break;
        }
      }
    },

    getClosestPrecedingNode: function(key) {
      if (_.isNull(key)) {
        throw new Error("Invalid argument.");
      }

      if (key.equals(this._localId)) {
        return null;
      }

      var index = key.getIntervalInPowerOfTwoFrom(this._localId);
      return this._getEntry(index);
    },

    removeReference: function(node) {
      var self = this;

      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      if (node.nodeId.equals(this._localId)) {
        return;
      }

      var index = node.nodeId.getIntervalInPowerOfTwoFrom(this._localId);
      var replacingNode = this._getEntry(index);
      for (var i = index + 1; i < this._localId.getLength(); i++) {
        if (!node.equals(this._getEntry(i))) {
          break;
        }

        if (_.isNull(replacingNode)) {
          this._unsetEntry(i);
        } else {
          this._setEntry(i, replacingNode);
        }
      }
    },

    getFirstFingerTableEntries: function(count) {
      var result = [];
      for (var i = 0; i < this._localId.getLength(); i++) {
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

      if (reference.nodeId.equals(this._localId)) {
        return false;
      }

      var index = reference.nodeId.getIntervalInPowerOfTwoFrom(this._localId);
      if (index === this._localId.getLength() - 1) {
        return false;
      }
      return reference.equals(this._getEntry(index + 1));
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
