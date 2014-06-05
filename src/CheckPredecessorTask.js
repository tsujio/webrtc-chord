define(['underscore', 'Utils'], function(_, Utils) {
  var CheckPredecessorTask = function(references) {
    this._references = references;
    this._timer = null;
  };

  CheckPredecessorTask.create = function(references, config) {
    if (!Utils.isZeroOrPositiveNumber(config.checkPredecessorTaskInterval)) {
      config.checkPredecessorTaskInterval = 30000;
    }

    var task = new CheckPredecessorTask(references);
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

      predecessor.ping(function(isAlive, error) {
        if (error) {
          console.log(error);
          self._references.removeReference(predecessor);
        }
      });
    },

    shutdown: function() {
      if (!_.isNull(this._timer)) {
        clearInterval(this._timer);
      }
    }
  };

  return CheckPredecessorTask;
});
