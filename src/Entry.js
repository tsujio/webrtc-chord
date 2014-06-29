define(['lodash', 'ID'], function(_, ID) {
  var Entry = function(id, value) {
    if (_.isNull(id) || _.isUndefined(value)) {
      throw new Error("Invalid argument.");
    }

    this.id = id;
    this.value = value;
  };

  Entry.fromJson = function(json) {
    if (!_.isObject(json)) {
      throw new Error("invalid argument.");
    }
    return new Entry(ID.fromHexString(json.id), json.value);
  };

  Entry.prototype = {
    equals: function(entry) {
      if (!(entry instanceof Entry)) {
        return false;
      }

      return this.id.equals(entry.id) && _.isEqual(this.value, entry.value);
    },

    toJson: function() {
      return {
        id: this.id.toHexString(),
        value: this.value
      };
    }
  };

  return Entry;
});
