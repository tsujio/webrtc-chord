(function() {
  var _ = require('lodash');
  var Utils = require('./Utils');

  var CheckPredecessorTask = function(localNode, references) {
    this._localNode = localNode;
    this._references = references;
    this._timer = null;
  };

  CheckPredecessorTask.create = function(localNode, references, config) {
    if (!Utils.isZeroOrPositiveNumber(config.checkPredecessorTaskInterval)) {
      config.checkPredecessorTaskInterval = 30000;
    }

    var task = new CheckPredecessorTask(localNode, references);
    var timer = setInterval(function() {
      task.run();
    }, config.checkPredecessorTaskInterval);
    task._timer = timer;
    return task;
  };

  CheckPredecessorTask.prototype = {
    run: function() {
      var self = this;

      var predecessor = this._references.getPredecessor();
      if (_.isNull(predecessor)) {
        return;
      }

      predecessor.notifyAsSuccessor(this._localNode, function(successor, error) {
        if (error) {
          console.log(error);
          self._references.removeReference(predecessor);
          return;
        }

        if (!successor.equals(self._localNode)) {
          Utils.debug("[CheckPredecessorTask] Predecessor's successor is not self.");

          self._references.addReferenceAsPredecessor(successor);

          self.run();
          return;
        }

        predecessor = self._references.getPredecessor();
        Utils.debug("[CheckPredecessorTask] predecessor:", predecessor ? predecessor.getPeerId() : null);
      });
    },

    shutdown: function() {
      if (!_.isNull(this._timer)) {
        clearInterval(this._timer);
      }
    }
  };

  module.exports = CheckPredecessorTask;
})();
