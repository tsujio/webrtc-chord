(function() {
  var _ = require('lodash');
  var CryptoJS = require('crypto-js');
  var Utils = require('./Utils');

  var ID = function(bytes) {
    _.each(bytes, function(b) {
      if (_.isNaN(b) || !_.isNumber(b) || b < 0x00 || 0xff < b) {
        throw new Error("Invalid argument.");
      }
    });
    if (bytes.length !== ID._BYTE_SIZE) {
      throw new Error("Invalid argument.");
    }

    this._bytes = _.last(bytes, ID._BYTE_SIZE);
    this._hexString = _.map(this._bytes, function(b) {
      var str = b.toString(16);
      return b < 0x10 ? "0" + str : str;
    }).join("");
  };

  ID._BYTE_SIZE = 32;
  ID._BIT_LENGTH = ID._BYTE_SIZE * 8;

  ID.create = function(str) {
    if (!Utils.isNonemptyString(str)) {
      throw new Error("Invalid argument.");
    }

    return new ID(ID._createBytes(str));
  };

  ID._createBytes = function(str) {
    var hash = CryptoJS.SHA256(str).toString(CryptoJS.enc.Hex);
    return ID._createBytesFromHexString(hash);
  };

  ID._createBytesFromHexString = function(str) {
    if (!Utils.isNonemptyString(str) || str.length < ID._BYTE_SIZE * 2) {
      throw new Error("Invalid argument.");
    }

    return _(ID._BYTE_SIZE).times(function(i) {
      return parseInt(str.substr(i * 2, 2), 16);
    }).value();
  };

  ID.fromHexString = function(str) {
    return new ID(ID._createBytesFromHexString(str));
  };

  ID._addInBytes = function(bytes1, bytes2) {
    var copy = _.clone(bytes1);
    var carry = 0;
    for (var i = bytes1.length - 1; i >= 0; i--) {
      copy[i] += (bytes2[i] + carry);
      if (copy[i] < 0) {
        carry = -1;
        copy[i] += 0x100;
      } else {
        carry = copy[i] >> 8;
      }
      copy[i] &= 0xff;
    }
    return copy;
  };

  ID.prototype = {
    isInInterval: function(fromId, toId) {
      if (!fromId || !toId) {
        throw new Error("Invalid arguments.");
      }

      if (fromId.equals(toId)) {
        return !this.equals(fromId);
      }

      if (fromId.compareTo(toId) < 0) {
        return (this.compareTo(fromId) > 0 && this.compareTo(toId) < 0);
      } else {
        return (this.compareTo(fromId) > 0 || this.compareTo(toId) < 0);
      }
    },

    addPowerOfTwo: function(powerOfTwo) {
      if (powerOfTwo < 0 || powerOfTwo >= ID._BIT_LENGTH) {
        throw new Error("Power of two out of index.");
      }

      var copy = _.clone(this._bytes);
      var indexOfBytes = this._bytes.length - 1 - Math.floor(powerOfTwo / 8);
      var valueToAdd = [1, 2, 4, 8, 16, 32, 64, 128][powerOfTwo % 8];
      for (var i = indexOfBytes; i >= 0; i--) {
        copy[i] += valueToAdd;
        valueToAdd = copy[i] >> 8;
        copy[i] &= 0xff;
        if (valueToAdd === 0) {
          break;
        }
      }

      return new ID(copy);
    },

    add: function(id) {
      return new ID(ID._addInBytes(this._bytes, id._bytes));
    },

    sub: function(id) {
      return new ID(ID._addInBytes(this._bytes, _.map(id._bytes, function(b) { return -b; })));
    },

    getIntervalInPowerOfTwoFrom: function(id) {
      if (this.equals(id)) {
        return -Infinity;
      }

      var diff = this.sub(id);
      for (var i = 0; i < ID._BIT_LENGTH; i++) {
        if (ID._powerOfTwos[i].compareTo(diff) > 0) {
          if (i === 0) {
            return -Infinity;
          }
          break;
        }
      }
      return i - 1;
    },

    compareTo: function(id) {
      for (var i = 0; i < ID._BYTE_SIZE; i++) {
        if (this._bytes[i] < id._bytes[i]) {
          return -1;
        } else if (this._bytes[i] > id._bytes[i]) {
          return 1;
        }
      }
      return 0;
    },

    equals: function(id) {
      return this.compareTo(id) === 0;
    },

    getLength: function() {
      return ID._BIT_LENGTH;
    },

    toHexString: function() {
      return this._hexString;
    }
  };

  ID.minId = new ID(_(ID._BYTE_SIZE).times(function() {
    return 0x00;
  }).value());

  ID.maxId = new ID(_(ID._BYTE_SIZE).times(function() {
    return 0xff;
  }).value());

  ID._powerOfTwos = _(ID.minId.getLength()).times(function(i) {
    return ID.minId.addPowerOfTwo(i);
  }).value();

  module.exports = ID;
})();
