(function() {
  var _ = require('lodash');
  var LocalNode = require('./LocalNode');
  var Utils = require('./Utils');

  var Chord = function(config) {
    if (!_.isObject(config)) {
      throw new Error("Invalid argument.");
    }
    Utils.enableDebugLog(config.debug);

    this.version = Utils.version.join('.');
    this._config = config;
    this._localNode = null;
    this.onentriesinserted = function(entries) { ; };
    this.onentriesremoved = function(entries) { ; };
  };

  Chord.prototype = {
    create: function(callback) {
      var self = this;

      if (this._localNode) {
        throw new Error("Local node is already created.");
      }
      if (!callback) {
        callback = function() {};
      }

      LocalNode.create(this, this._config, function(localNode, error) {
        if (error) {
          callback(null, error);
          return;
        }

        self._localNode = localNode;
        self._localNode.create(function(peerId, error) {
          if (error) {
            self.leave();
            self._localNode = null;
          }

          callback(peerId, error);
        });
      });
    },

    join: function(bootstrapId, callback) {
      var self = this;

      if (!Utils.isNonemptyString(bootstrapId)) {
        throw new Error("Invalid argument.");
      }
      if (this._localNode) {
        throw new Error("Local node is already created.");
      }
      if (!callback) {
        callback = function() {};
      }

      LocalNode.create(this, this._config, function(localNode, error) {
        if (error) {
          callback(null, error);
          return;
        }

        self._localNode = localNode;
        self._localNode.join(bootstrapId, function(peerId, error) {
          if (error) {
            self.leave();
            self._localNode = null;
          }

          callback(peerId, error);
        });
      });
    },

    leave: function() {
      var self = this;

      if (!this._localNode) {
        return;
      }

      this._localNode.leave(function() {
        self._localNode = null;
      });
    },

    insert: function(key, value, callback) {
      if (!callback) {
        callback = function() {};
      }
      if (!this._localNode) {
        callback(null, new Error("Create or join network at first."));
        return;
      }
      if (!Utils.isNonemptyString(key) || _.isUndefined(value)) {
        callback(null, new Error("Invalid arguments."));
        return;
      }

      this._localNode.insert(key, value, callback);
    },

    retrieve: function(key, callback) {
      if (!callback) {
        callback = function() {};
      }
      if (!this._localNode) {
        callback(null, new Error("Create or join network at first."));
        return;
      }
      if (!Utils.isNonemptyString(key)) {
        callback(null, new Error("Invalid argument."));
        return;
      }

      this._localNode.retrieve(key, callback);
    },

    remove: function(key, value, callback) {
      if (!callback) {
        callback = function() {};
      }
      if (!this._localNode) {
        callback(new Error("Create or join network at first."));
        return;
      }
      if (!Utils.isNonemptyString(key) || _.isUndefined(value)) {
        callback(new Error("Invalid arguments."));
        return;
      }

      this._localNode.remove(key, value, callback);
    },

    getEntries: function() {
      if (!this._localNode) {
        throw new Error("Create or join network at first.");
      }
      return this._localNode.getEntries();
    },

    setEntries: function(entries) {
      if (!this._localNode) {
        throw new Error("Create or join network at first.");
      }
      return this._localNode.setEntries(entries);
    },

    getStatuses: function() {
      if (!this._localNode) {
        throw new Error("Create or join network at first.");
      }
      return this._localNode.getStatuses();
    },

    getPeerId: function() {
      if (!this._localNode) {
        throw new Error("Create or join network at first.");
      }
      return this._localNode.getPeerId();
    },

    getNodeId: function() {
      if (!this._localNode) {
        throw new Error("Create or join network at first.");
      }
      return this._localNode.nodeId.toHexString();
    },

    toString: function() {
      if (!this._localNode) {
        return "";
      }

      return this._localNode.toDisplayString();
    }
  };

  module.exports = Chord;
})();
