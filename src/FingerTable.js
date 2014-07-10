(function() {
  var _ = require('lodash');

  var FingerTable = function(localId, references) {
    if (!localId || !references) {
      throw new Error("Invalid arguments.");
    }

    this._localId = localId;
    this._references = references;
    this._table = _(this._localId.getLength()).times(function() { return null; }).value();
    this._powerOfTwos = _(this._localId.getLength()).times(function(i) {
      return localId.addPowerOfTwo(i);
    }).value();
  };

  FingerTable.prototype = {
    addReference: function(node) {
      if (!node) {
        throw new Error("Invalid argument.");
      }

      if (node.nodeId.equals(this._localId)) {
        return;
      }

      var index = node.nodeId.getIntervalInPowerOfTwoFrom(this._localId);
      for (var i = index + 1; i < this._table.length; i++) {
        if (!this._table[i]) {
          this._table[i] = node;
        } else if (node.nodeId.isInInterval(this._table[i].nodeId, this._powerOfTwos[i])) {
          var oldEntry = this._table[i];
          this._table[i] = node;
          this._references.disconnectIfUnreferenced(oldEntry);
        } else {
          break;
        }
      }
    },

    getClosestPrecedingNode: function(key) {
      if (!key) {
        throw new Error("Invalid argument.");
      }

      if (key.equals(this._localId)) {
        return null;
      }

      var index = key.getIntervalInPowerOfTwoFrom(this._localId);
      return this._table[index];
    },

    removeReference: function(node) {
      var self = this;

      if (!node) {
        throw new Error("Invalid argument.");
      }

      if (node.nodeId.equals(this._localId)) {
        return;
      }

      var index = node.nodeId.getIntervalInPowerOfTwoFrom(this._localId);
      var replacingNode = this._table[index];
      for (var i = index + 1; i < this._table.length; i++) {
        if (!node.equals(this._table[i])) {
          break;
        }

        this._table[i] = replacingNode;
      }

      this._references.disconnectIfUnreferenced(node);
    },

    getFirstFingerTableEntries: function(count) {
      var result = [];
      for (var i = 0; i < this._table.length; i++) {
        if (this._table[i]) {
          if (result.length === 0 || !_.last(result).equals(this._table[i])) {
            result.push(this._table[i]);
          }
        }
        if (result.length >= count) {
          break;
        }
      }
      return result;
    },

    containsReference: function(reference) {
      if (!reference) {
        throw new Error("Invalid argument.");
      }

      if (reference.nodeId.equals(this._localId)) {
        return false;
      }

      var index = reference.nodeId.getIntervalInPowerOfTwoFrom(this._localId);
      if (index === this._table.length - 1) {
        return false;
      }
      return reference.equals(this._table[index + 1]);
    },

    getStatus: function() {
      var self = this;
      return _.map(this._table, function(node) {
        return !node ? null : node.toNodeInfo();
      });
    },

    toString: function() {
      var self = this;

      return "[FingerTable]\n" + _.chain(this._table)
        .map(function(node, i) {
          if (!node) {
            return "";
          }

          if (i === 0 || (i > 0 && !node.equals(self._table[i - 1]))) {
            return "[" + i + "] " + node.toString();
          }

          if (i === self._table.length - 1 ||
              !node.equals(self._table[i + 1])) {
            return "[" + i + "]";
          }

          if ((i > 1 &&
               node.equals(self._table[i - 1]) &&
               !node.equals(self._table[i - 2])) ||
              (i === 1 && node.equals(self._table[i - 1]))) {
            return "..."
          }

          if (i > 1 &&
              node.equals(self._table[i - 1]) &&
              node.equals(self._table[i - 2])) {
            return "";
          }

          throw new Error("Unknown situation.");
        })
        .reject(function(str) { return str === ""; })
        .value()
        .join("\n") + "\n";
    }
  };

  module.exports = FingerTable;
})();
