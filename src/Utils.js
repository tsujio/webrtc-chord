(function() {
  var _ = require('lodash');

  var Utils = {
    version: [1, 0, 0],

    isNonemptyString: function(value) {
      return _.isString(value) && !_.isEmpty(value);
    },

    isValidNumber: function(number) {
      return !_.isNaN(number) && _.isNumber(number);
    },

    isPositiveNumber: function(number) {
      return Utils.isValidNumber(number) && number > 0;
    },

    isZeroOrPositiveNumber: function(number) {
      return number === 0 || Utils.isPositiveNumber(number);
    },

    insert: function(list, index, item) {
      list.splice(index, 0, item);
    },

    generateRandomId: function(length) {
      var id = "";
      while (id.length < length) {
        id += Math.random().toString(36).substr(2);
      }
      return id.substr(0, length);
    },

    enableDebugLog: function(enabled) {
      Utils.debug = function() {
        if (enabled) {
          var args = Array.prototype.slice.call(arguments);
          var d = new Date()
          var timeStr = [d.getHours(), d.getMinutes(), d.getSeconds()].join(':') + ':';
          args.unshift(timeStr);
          console.log.apply(console, args);
        }
      };
    },

    debug: function() {
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

  module.exports = Utils;
})();
