(function() {
  $(function() {
    var printNodeStatus = function(chord, html) {
      var statuses = chord.getStatuses();

      statuses = _.chain(statuses)
        .map(function(str, key) {
          return [key, str.replace(/[\r\n]/g, "<br />")];
        })
        .object()
        .value();

      html.find("#successors-container").html(statuses.successors);
      html.find("#predecessor-container").html(statuses.predecessor);
      html.find("#finger-table-container").html(statuses.fingerTable);
      html.find("#entries-container").html(statuses.entries);
    };

    $("#btn-create-node").click(function() {
      var chord = new Chord({
        peer: {
          options: {
            key: 'lwjd5qra8257b9',
          }
        }
      });

      var html = $(_.template($("#node-template").html())());
      var timer;
      html.find("#btn-create").click(function() {
        chord.create(function(peerId) {
          if (_.isNull(peerId)) {
            console.log("Failed to create network.");
            return;
          }
          html.find("#peer-id").text("Peer ID: " + peerId);

          timer = setInterval(function() {
            printNodeStatus(chord, html);
          }, 5000);
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

          timer = setInterval(function() {
            printNodeStatus(chord, html);
          }, 5000);
        });
      });

      html.find("#btn-leave").click(function() {
        chord.leave();
        clearInterval(timer);
      });

      html.find("#btn-insert-entry").click(function() {
        var key = html.find("#text-insert-entry-key").val();
        var value = html.find("#text-insert-entry-value").val();
        chord.insert(key, JSON.parse(value), function(inserted) {
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
        chord.remove(key, JSON.parse(value), function(removed) {
          if (!removed) {
            console.log("Failed to remove entry.");
          }
        });
      });

      $("#node-list-container").append(html);
    });
  });
})();
