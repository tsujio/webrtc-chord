var _ = require('lodash');

var Chord, ConnectionFactory, ReferenceList, ID, Node;
replaceConnectionPool(function() {
  ConnectionFactory = require('connectionpool');
  Chord = require('../src/Chord');
  ReferenceList = require('../src/ReferenceList');
  ID = require('../src/ID');
  Node = require('../src/Node');
});

function runTasksOnce(chord) {
  if (chord._localNode) {
    _.invoke(chord._localNode._tasks, 'run');
  }
}

function runTasksOnceForAllChords(chords) {
  _.each(chords, function(chord) {
    runTasksOnce(chord);
  });
}

function shutdownChord(chord) {
  if (chord._localNode) {
    chord._localNode._nodeFactory._connectionFactory.destroy();
  }
}

describe("Orchestration test", function() {
  var chords;

  beforeEach(function() {
    ConnectionFactory.initialize();
    var peersNum = 10;
    chords = _.times(peersNum, function() {
      return new Chord({});
    });

    dummies = _.times(peersNum, function(i) {
      var dummy = new Node({peerId: i.toString()}, null, null, null, null, {});
      spyOn(dummy, 'disconnect');
      spyOn(dummy, '_sendRequest');
      return dummy
    });

    referencesList = _.times(peersNum, function(i) {
      var entries = jasmine.createSpyObj('entries', ['getEntriesInInterval']);
      entries.getEntriesInInterval.andReturn([]);
      return new ReferenceList(ID.create(i.toString()), entries, {});
    });
  });

  describe("10 peers cases", function() {
    it("should create network including 10 peers", function(done) {
      // Setup network
      chords[0].create(function(peerId1, error) {
        chords[0]._localNode._shutdownTasks();

        expect(peerId1).toEqual(jasmine.any(String));
        expect(error).toBeUndefined();

        (function join(chordToJoin, chords, callback) {
          setTimeout(function() {
            if (chords.length === 0) {
              callback();
              return;
            }

            _.first(chords).join(chordToJoin.getPeerId(), function(peerId, error) {
              expect(peerId).toEqual(jasmine.any(String));
              expect(error).toBeUndefined();

              _.first(chords)._localNode._shutdownTasks();
              join(chordToJoin, _.rest(chords), callback);
            });
          }, 0);
        })(chords[0], _.rest(chords), function() {
          _.each(chords, function(chord, i) {
            var orderedDummies = _.chain(dummies)
              .clone()
              .sort(function(a, b) {
                return a.nodeId.sub(referencesList[i]._localId).compareTo(b.nodeId.sub(referencesList[i]._localId));
              }).value();
            expect(chord._localNode._references.getSuccessor().toString()).toBe(
              orderedDummies[1].toString());
            expect(chord._localNode._references.getPredecessor().toString()).toBe(
              _.last(orderedDummies).toString());
          });

          done();
        });
      });
    });
  });
});
