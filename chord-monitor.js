(function() {
  $(function() {
    var chords = {};
    var canvas = $("#canvas-chord");
    var width = canvas.width(), height = canvas.height(), r = height / 2 - 50;
    var center = {x: width / 2, y: height / 2};

    var calculateCoordinates = function(nodeId) {
      var bytes = _(Math.floor(_.size(nodeId) / 2)).times(function(i) {
        return parseInt(nodeId.substr(i * 2, 2), 16);
      });
      var ratio = _.chain(bytes)
        .map(function(b) { return b / 0xff;})
        .reduceRight(function(a, b) { return (a >> 8) + b; }, 0)
        .value();
      var radian = ratio * 2 * Math.PI;
      return {
        x: center.x - r * Math.cos(radian),
        y: center.y - r * Math.sin(radian)
      };
    };

    var peerIdToShow = null;
    var updateChordGraph = function() {
      var ctx = canvas[0].getContext('2d');
      ctx.clearRect(0, 0, width, height);
      ctx.beginPath();
      ctx.arc(center.x, center.y, r, 0, 2 * Math.PI);
      ctx.strokeStyle = 'gray';
      ctx.stroke();

      _.each(chords, function(chord) {
        ctx.beginPath();
        var coord = calculateCoordinates(chord.getNodeId());
        ctx.arc(coord.x, coord.y, 5, 0, 2 * Math.PI);
        ctx.stroke();
        ctx.fillStyle = 'red';
        ctx.fill();

        if (!_.isNull(peerIdToShow) && chord.getPeerId() !== peerIdToShow) {
          return;
        }

        var strokeQuadraticCurve = function(toNode, rOffset, color) {
          var _coord = calculateCoordinates(toNode.nodeId);
          var radian = Math.atan2((_coord.y + coord.y) / 2 - center.y,
                                  (_coord.x + coord.x) / 2 - center.x);
          ctx.beginPath();
          ctx.moveTo(coord.x, coord.y);
          var cpx = center.x + (r + rOffset) * Math.cos(radian);
          var cpy = center.y + (r + rOffset) * Math.sin(radian);
          ctx.quadraticCurveTo(cpx, cpy, _coord.x, _coord.y);
          ctx.strokeStyle = color;
          ctx.stroke();

          ctx.beginPath();
          ctx.moveTo(_coord.x, _coord.y);
          var radian = Math.atan2(cpy - _coord.y,
                                  cpx - _coord.x);
          ctx.lineTo(_coord.x + 10 * Math.cos(radian - Math.PI / 6),
                     _coord.y + 10 * Math.sin(radian - Math.PI / 6));
          ctx.lineTo(_coord.x + 10 * Math.cos(radian + Math.PI / 6),
                     _coord.y + 10 * Math.sin(radian + Math.PI / 6));
          ctx.closePath();
          ctx.fillStyle = color;
          ctx.fill();
        };

        var statuses = chord.getStatuses();

        if ($("#checkbox-show-successors").prop('checked')) {
          _.each(statuses.successors, function(successor) {
            strokeQuadraticCurve(successor, 50, 'blue');
          });
        }

        if ($("#checkbox-show-predecessor").prop('checked')) {
          if (!_.isNull(statuses.predecessor)) {
            strokeQuadraticCurve(statuses.predecessor, 20, 'green');
          }
        }

        if ($("#checkbox-show-fingertable").prop('checked')) {
          var stroked = {};
          _.each(statuses.fingerTable, function(node) {
            if (_.isNull(node)) {
              return;
            }

            if (_.has(stroked, node.peerId)) {
              return;
            }
            stroked[node.peerId] = node;

            var _coord = calculateCoordinates(node.nodeId);
            ctx.beginPath();
            ctx.moveTo(coord.x, coord.y);
            ctx.lineTo(_coord.x, _coord.y);
            ctx.strokeStyle = "orange";
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(_coord.x, _coord.y);
            var radian = Math.atan2(coord.y - _coord.y,
                                    coord.x - _coord.x);
            ctx.lineTo(_coord.x + 10 * Math.cos(radian - Math.PI / 6),
                       _coord.y + 10 * Math.sin(radian - Math.PI / 6));
            ctx.lineTo(_coord.x + 10 * Math.cos(radian + Math.PI / 6),
                       _coord.y + 10 * Math.sin(radian + Math.PI / 6));
            ctx.closePath();
            ctx.fillStyle = "orange";
            ctx.fill();
          });
        }
      });
    };

    var replaceCrLf = function(str) {
      return str.replace(/[\r\n]/g, "<br />");
    };

    setInterval(function() {
      _.each(chords, function(chord, peerId) {
        var html = $("#" + peerId);
        html.find("#node-status-container").html(replaceCrLf(_.escape(chord.toString())));
      });

      updateChordGraph();
    }, 5000);

    canvas.click(function(e) {
      var offset = $(e.target).offset();
      var offsetX = e.pageX - offset.left;
      var offsetY = e.pageY - offset.top;

      peerIdToShow = null;
      _.each(chords, function(chord) {
        var coord = calculateCoordinates(chord.getNodeId());
        if (Math.pow(offsetX - coord.x, 2) +
            Math.pow(offsetY - coord.y, 2) <= Math.pow(5, 2)) {
          $("#p-node-info").text(chord.getNodeId() + " (" + chord.getPeerId() + ")");
          peerIdToShow = chord.getPeerId();
        }
      });

      updateChordGraph();
    });

    $("#checkbox-show-successors").click(updateChordGraph);
    $("#checkbox-show-predecessor").click(updateChordGraph);
    $("#checkbox-show-fingertable").click(updateChordGraph);

    $("#btn-create-node").click(function() {
      var chord = new Chord({
        peer: {
          options: {
            key: 'lwjd5qra8257b9',
          }
        }
      });

      var html = $(_.template($("#node-template").html())());
      html.find("#btn-create").click(function() {
        chord.create(function(peerId) {
          if (_.isNull(peerId)) {
            console.log("Failed to create network.");
            return;
          }
          html.find("#peer-id").text("Peer ID: " + peerId);
          html.find("#node-id").text("Node ID: " + chord.getNodeId());
          html.attr('id', peerId);

          chords[peerId] = chord;
        });
      });

      html.find("#btn-join").click(function() {
        var id = html.find("#text-id-to-join").val();
        chord.join(id, function(peerId) {
          if (_.isNull(peerId)) {
            console.log("Failed to join network.");
            return;
          }
          html.find("#peer-id").text("Peer ID: " + peerId);
          html.find("#node-id").text("Node ID: " + chord.getNodeId());
          html.attr('id', peerId);

          chords[peerId] = chord;
        });
      });

      html.find("#btn-leave").click(function() {
        delete chords[chord.getPeerId()];
        chord.leave();
      });

      html.find("#btn-insert-entry").click(function() {
        var key = html.find("#text-insert-entry-key").val();
        var value = html.find("#text-insert-entry-value").val();
        try {
          value = JSON.parse(value);
        } catch (e) {
        }
        chord.insert(key, value, function(inserted) {
          if (!inserted) {
            console.log("Failed to insert entry.");
          }
        });
      });

      html.find("#btn-retrieve-entry").click(function() {
        var key = html.find("#text-retrieve-entry-key").val();
        chord.retrieve(key, function(value) {
          if (_.isNull(value)) {
            console.log("Failed to retrieve entries.");
            return;
          }
          html.find("#p-retrieve-entry-value").text(JSON.stringify(value));
        });
      });

      html.find("#btn-remove-entry").click(function() {
        var key = html.find("#text-remove-entry-key").val();
        var value = html.find("#text-remove-entry-value").val();
        try {
          value = JSON.parse(value);
        } catch (e) {
        }
        chord.remove(key, value, function(removed) {
          if (!removed) {
            console.log("Failed to remove entry.");
          }
        });
      });

      $("#node-list-container").append(html);
    });
  });
})();
