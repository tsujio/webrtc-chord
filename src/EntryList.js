define(['underscore', 'ID', 'Utils'], function(_, ID, Utils) {
  var EntryList = function() {
    this._entries = {};
  };

  EntryList.prototype = {
    addAll: function(entries) {
      var self = this;

      if (_.isNull(entries)) {
        throw new Error("Invalid argument.");
      }

      _.each(entries, function(entry) {
        self.add(entry);
      });
    },

    add: function(entry) {
      if (_.isNull(entry)) {
        throw new Error("Invalid argument.");
      }

      if (_.has(this._entries, entry.id.toHexString())) {
        this._entries[entry.id.toHexString()].put(entry);
      } else {
        this._entries[entry.id.toHexString()] = new Utils.Set([entry], function(a, b) {
          return a.equals(b);
        });
      }
    },

    remove: function(entry) {
      if (_.isNull(entry)) {
        throw new Error("Invalid argument.");
      }

      if (!_.has(this._entries, entry.id.toHexString())) {
        return;
      }

      this._entries[entry.id.toHexString()].remove(entry);
      if (this._entries[entry.id.toHexString()].size() === 0) {
        delete this._entries[entry.id.toHexString()];
      }
    },

    getEntries: function(id) {
      if (_.isNull(id)) {
        throw new Error("Invalid argument.");
      }

      if (_.isUndefined(id)) {
        return this._entries;
      }

      if (_.has(this._entries, id.toHexString())) {
        return this._entries[id.toHexString()].items();
      } else {
        return [];
      }
    },

    getEntriesInInterval: function(fromId, toId) {
      if (_.isNull(fromId) || _.isNull(toId)) {
        throw new Error("Invalid argument.");
      }

      var result = [];
      _.each(this._entries, function(entries, key) {
        if (ID.fromHexString(key).isInInterval(fromId, toId)) {
          result = result.concat(entries.items());
        }
      });

      result = result.concat(this.getEntries(toId));

      return result;
    },

    removeAll: function(entries) {
      var self = this;

      if (_.isNull(entries)) {
        throw new Error("Invalid argument.");
      }

      _.each(entries, function(entry) {
        self.remove(entry);
      });
    },

    getNumberOfStoredEntries: function() {
      return _.size(this._entries);
    },

    getStatus: function() {
      return _.chain(this._entries)
        .map(function(entries, key) {
          return [
            key,
            _.map(entries, function(entry) {
              return entry.value;
            })
          ];
        })
        .object()
        .value();
    },

    toString: function() {
      var self = this;

      return "[Entries]\n" + _.chain(this._entries)
        .keys()
        .map(function(key) { return ID.fromHexString(key); })
        .sort(function(a, b) { return a.compareTo(b); })
        .map(function(id) {
          return "[" + id.toHexString() + "]\n" +
            _.map(self.getEntries(id), function(entry) {
              return JSON.stringify(entry.value);
            }).join("\n") + "\n";
        })
        .value()
        .join("\n") + "\n";
    }
  };

  return EntryList;
});
