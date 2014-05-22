define(['underscore'], function(_) {
  var FingerTable = function(localId, references) {
    if (_.isNull(localId) || _.isNull(references)) {
      throw new Error("Invalid arguments.");
    }

    this._localId = localId;
    this._references = references;
    this._remoteNodes = {};
  };

  FingerTable.prototype = {
    _setEntry: function(index, node) {
      if (!_.isNumber(index) || _.isNull(node)) {
        throw new Error("Invalid arguments.");
      }
      if (index < 0 || index >= this._localId.getLength()) {
        throw new Error("Invalid index.");
      }

      this._remoteNodes[index] = node;
    },

    _getEntry: function(index) {
      if (!_.isNumber(index)) {
        throw new Error("Invalid argument.");
      }
      if (index < 0 || index >= this._localId.getLength()) {
        throw new Error("Invalid index.");
      }

      if (!_.has(this._remoteNodes, index)) {
        return null;
      }
      return this._remoteNodes[index];
    },

    _unsetEntry: function(index) {
      if (!_.isNumber(index)) {
        throw new Error("Invalid argument.");
      }
      if (index < 0 || index >= this._localId.getLength()) {
        throw new Error("Invalid index.");
      }

      var overwrittenNode = this._getEntry(index);

      delete this._remoteNodes[index];

      if (!_.isNull(overwrittenNode)) {
        this._references.disconnectIfUnreferenced(overwrittenNode);
      }
    },

    addReference: function(node) {
      if (_.isNull(node)) {
        throw new Error("Invalid argument.");
      }

      for (var i = 0; i < this._localId.getLength(); i++) {
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

      var sortedKeys = _.chain(this._remoteNodes)
        .keys()
        .map(function(key) { return parseInt(key); })
        .sortBy()
        .value();
      for (var i = _.size(sortedKeys) - 1; i >= 0; i--) {
        var k = sortedKeys[i]
        if (!_.isNull(this._getEntry(k)) &&
            this._getEntry(k).nodeId.isInInterval(this._localId, key)) {
          return this._getEntry(k);
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
      var sortedKeys = _.chain(this._remoteNodes)
        .keys()
        .map(function (key) { return parseInt(key); })
        .sortBy()
        .value();
      for (var i = _.size(sortedKeys) - 1; i >= 0; i--) {
        var k = sortedKeys[i];
        var n = this._getEntry(k);
        if (node.equals(n)) {
          break;
        }
        if (!_.isNull(n)) {
          referenceForReplacement = n;
        }
      }

      _.each(sortedKeys, function(key) {
        if (node.equals(self._getEntry(key))) {
          if (_.isNull(referenceForReplacement)) {
            self._unsetEntry(key);
          } else {
            self._setEntry(key, referenceForReplacement);
          }
        }
      });

      _.chain(this._references.getSuccessors())
        .reject(function(s) { return s.equals(node); })
        .each(function(s) { self.addReference(s); });
    },

    getFirstFingerTableEntries: function(count) {
      var result = [];
      var sortedKeys = _.chain(this._remoteNodes)
        .keys()
        .map(function (key) { return parseInt(key); })
        .sortBy()
        .value();
      for (var i = 0; i < _.size(sortedKeys); i++) {
        var k = sortedKeys[i];
        if (!_.isNull(this._getEntry(k))) {
          if (_.isEmpty(result) || !_.last(result).equals(this._getEntry(k))) {
            result.push(this._getEntry(k));
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
        return node.equals(reference);
      });
    },

    toString: function() {
      var self = this;

      return _.chain(this._remoteNodes)
        .keys()
        .map(function(key) { return parseInt(key); })
        .sortBy()
        .map(function(key, i, keys) {
          if (i === 0 || (i > 0 && !self._getEntry(keys[i]).equals(self._getEntry(keys[i - 1])))) {
            return "[" + key + "] " + self._getEntry(key).toString();
          }

          if (i === _.size(keys) - 1 ||
              (i < _.size(keys) - 1 && !self._getEntry(keys[i]).equals(self._getEntry(keys[i + 1])))) {
            return "[" + key + "]";
          }

          if ((i > 1 &&
               self._getEntry(keys[i]).equals(self._getEntry(keys[i - 1])) &&
               !self._getEntry(keys[i]).equals(self._getEntry(keys[i - 2]))) ||
              (i === 1 && self._getEntry(keys[i]).equals(self._getEntry(keys[i - 1])))) {
            return "..."
          }

          if (i > 1 &&
              self._getEntry(keys[i]).equals(self._getEntry(keys[i - 1])) &&
              self._getEntry(keys[i]).equals(self._getEntry(keys[i - 2]))) {
            return "";
          }

          throw new Error("Unknown situation.");
        })
        .reject(function(str) { return str === ""; })
        .value()
        .join("\n");
    }
  };

  return FingerTable;
});
