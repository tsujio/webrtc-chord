define(['underscore'], function(_) {
  var Utils = {
    isNonemptyString: function(value) {
      return _.isString(value) && !_.isEmpty(value);
    },

    isValidNumber: function(number) {
      return !_.isNaN(number) && _.isNumber(number);
    },

    insert: function(list, index, item) {
      list.splice(index, 0, item);
    }
  };

  var Set = function(items, comparator) {
    var self = this;

    this._items = [];
    this._comparator = comparator;

    _.each(items, function(item) {
      self.put(item);
    });
  };

  Set.prototype = {
    put: function(item) {
      if (this.size() === 0 || !this.has(item)) {
        this._items.push(item);
      }
    },

    remove: function(item) {
      var self = this;
      this._items = _.reject(this._items, function(_item) {
        return self._comparator(_item, item);
      });
    },

    size: function() {
      return _.size(this._items);
    },

    has: function(item) {
      var self = this;
      return _.some(this._items, function(_item) {
        return self._comparator(_item, item);
      });
    },

    items: function() {
      return this._items;
    }
  };

  Utils.Set = Set;

  var Queue = function() {
    this._items = [];
  };

  Queue.prototype = {
    enqueue: function(item) {
      this._items.push(item);
    },

    dequeue: function() {
      if (_.isEmpty(this._items)) {
        return null;
      }
      return this._items.shift();
    },

    first: function() {
      if (_.isEmpty(this._items)) {
        return null;
      }
      return _.first(this._items);
    },

    last: function() {
      if (_.isEmpty(this._items)) {
        return null;
      }
      return _.last(this._items);
    },

    size: function() {
      return _.size(this._items);
    },
  };

  Utils.Queue = Queue;

  var Cache = function(capacity, cacheOutCallback) {
    this._cache = {};
    this._useHistory = [];
    this._capacity = capacity;
    this._cacheOutCallback = cacheOutCallback;
  };

  Cache.prototype = {
    get: function(key) {
      if (!_.has(this._cache, key)) {
        return null;
      }
      this._updateUseHistory(key);
      return this._cache[key];
    },

    set: function(key, item) {
      var self = this;

      this._cache[key] = item;
      this._updateUseHistory(key);
      if (_.size(this._cache) > this._capacity) {
        var keysToRemove = _.rest(this._useHistory, this._capacity);
        this._useHistory = _.first(this._useHistory, this._capacity);
        _.each(keysToRemove, function(key) {
          var item = self._cache[key];
          delete self._cache[key];
          self._cacheOutCallback(item);
        });
      }
    },

    remove: function(key) {
      if (!this.has(key)) {
        return;
      }
      this._useHistory = _.reject(this._useHistory, function(k) {
        return k === key;
      });
      delete this._cache[key];
    },

    has: function(key) {
      return _.has(this._cache, key);
    },

    keys: function() {
      return _.keys(this._cache);
    },

    _updateUseHistory: function(key) {
      this._useHistory = _.reject(this._useHistory, function(k) {
        return k === key;
      });
      this._useHistory.unshift(key);
    }
  };

  Utils.Cache = Cache;

  return Utils;
});
