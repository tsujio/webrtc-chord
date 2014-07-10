(function() {
  var _ = require('lodash');
  var Utils = require('./Utils');

  var Response = function(version, status, method, result, requestId, timestamp) {
    if (version[0] !== Utils.version[0]) {
      throw new Error("Cannot communicate with version " + version.join('.') +
                      " (your version is " + Utils.version.join('.') +")");
    }

    if (!Utils.isNonemptyString(status) ||
        !Utils.isNonemptyString(method) ||
        !_.isObject(result) || !Utils.isNonemptyString(requestId) ||
        !_.isNumber(timestamp)) {
      throw new Error("Invalid argument.");
    }

    this.version = version;
    this.status = status;
    this.method = method;
    this.result = result;
    this.requestId = requestId;
    this.timestamp = timestamp;
  };

  Response.create = function(status, result, request) {
    return new Response(Utils.version, status, request.method, result, request.requestId, _.now());
  };

  Response.isResponse = function(data) {
    if (!_.isObject(data)) {
      return false;
    }
    if (!Utils.isNonemptyString(data.status)) {
      return false;
    }
    return true;
  };

  Response.fromJson = function(json) {
    if (!_.isObject(json)) {
      throw new Error("Invalid argument.");
    }
    return new Response(json.version, json.status, json.method, json.result, json.requestId, json.timestamp);
  };

  Response.prototype = {
    toJson: function() {
      return {
        version: this.version,
        status: this.status,
        method: this.method,
        result: this.result,
        requestId: this.requestId,
        timestamp: this.timestamp
      };
    },
  };

  module.exports = Response;
})();
