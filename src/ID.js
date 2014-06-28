define(['underscore', 'cryptojs', 'Utils'], function(_, CryptoJS, Utils) {
  var ID = function(bytes) {
    _.each(bytes, function(b) {
      if (_.isNaN(b) || !_.isNumber(b) || b < 0x00 || 0xff < b) {
        throw new Error("Invalid argument.");
      }
    });
    if (_.size(bytes) !== ID._BYTE_SIZE) {
      throw new Error("Invalid argument.");
    }

    this._bytes = _.last(bytes, ID._BYTE_SIZE);
    this._hexString = _.map(this._bytes, function(b) {
      var str = b.toString(16);
      return b < 0x10 ? "0" + str : str;
    }).join("");
    this._bitLength = _.size(this._bytes) * 8;
  };

  ID._BYTE_SIZE = 32;

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
    if (!Utils.isNonemptyString(str)) {
      throw new Error("Invalid argument.");
    }

    return _(Math.floor(_.size(str) / 2)).times(function(i) {
      return parseInt(str.substr(i * 2, 2), 16);
    });
  };

  ID.fromHexString = function(str) {
    return new ID(ID._createBytesFromHexString(str));
  };

  ID.prototype = {
    isInInterval: function(fromId, toId) {
      if (_.isNull(fromId) || _.isNull(toId)) {
        throw new Error("Invalid arguments.");
      }

      if (fromId.equals(toId)) {
        return !this.equals(fromId);
      }

      if (fromId.compareTo(toId) < 0) {
        return (this.compareTo(fromId) > 0 && this.compareTo(toId) < 0);
      }

      return ((this.compareTo(fromId) > 0 && this.compareTo(ID.maxId) <= 0 && !fromId.equals(ID.maxId)) ||
              (this.compareTo(ID.minId) >= 0 && this.compareTo(toId) < 0 && !ID.minId.equals(toId)));
    },

    addPowerOfTwo: function(powerOfTwo) {
      if (!_.isNumber(powerOfTwo)) {
        throw new Error("Invalid argument.");
      }
      if (powerOfTwo < 0 || powerOfTwo >= this.getLength()) {
        throw new Error("Power of two out of index.");
      }

      var copy = _.clone(this._bytes);
      var indexOfBytes = _.size(this._bytes) - 1 - Math.floor(powerOfTwo / 8);
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

    compareTo: function(id) {
      if (this.getLength() !== id.getLength()) {
        throw new Error("Invalid argument.");
      }

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
      return this._bitLength;
    },

    toHexString: function() {
      return this._hexString;
    }
  };

  ID.minId = new ID(_(ID._BYTE_SIZE).times(function() {
    return 0x00;
  }));

  ID.maxId = new ID(_(ID._BYTE_SIZE).times(function() {
    return 0xff;
  }));

  return ID;
});
