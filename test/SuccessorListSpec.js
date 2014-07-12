(function() {
  var _ = require('lodash');
  var SuccessorList = require('../src/SuccessorList');
  var Node = require('../src/Node');
  var ID = require('../src/ID');

  describe("SuccessorList", function() {
    var successors;
    var entries;

    beforeEach(function() {
      var localId = ID.fromHexString("0000000000000000000000000000000000000000000000000000000000000000");
      var numberOfEntries = 2;
      var _entries = jasmine.createSpyObj('entries', ['getEntriesInInterval']);
      var references = jasmine.createSpyObj('references', [
        'disconnectIfUnreferenced', 'getFirstFingerTableEntries', 'getPredecessor', 'getClosestPrecedingNode']);
      _entries.getEntriesInInterval.andReturn([]);
      references.getFirstFingerTableEntries.andReturn([]);
      references.getPredecessor.andReturn(null);
      references.getClosestPrecedingNode.andReturn(null);
      successors = new SuccessorList(localId, _entries, references, {
        numberOfEntriesInSuccessorList: 2
      });

      entries = _(3).times(function() {
        var node = new Node({peerId: "dummy", nodeId: "dummy"}, null, null, null, {});
        spyOn(node, 'insertReplicas');
        spyOn(node, 'removeReplicas');
        return node;
      }).value();
      entries[0].nodeId = ID.fromHexString("00000000000000000000000000000000ffffffffffffffffffffffffffffffff");
      entries[1].nodeId = ID.fromHexString("0000000000000000ffffffffffffffffffffffffffffffff0000000000000000");
      entries[2].nodeId = ID.fromHexString("ffffffffffffffffffffffffffffffff00000000000000000000000000000000");
    });

    describe("#addSuccessor", function() {
      it("should add specified node", function() {
        successors.addSuccessor(entries[0]);
        successors.addSuccessor(entries[1]);
        expect(successors._successors[0]).toEqualNode(entries[0]);
        expect(successors._successors[1]).toEqualNode(entries[1]);
      });

      it("should remove node if capacity overflowed", function() {
        successors.addSuccessor(entries[2]);
        successors.addSuccessor(entries[1]);
        successors.addSuccessor(entries[0]);
        expect(successors._successors[0]).toEqualNode(entries[0]);
        expect(successors._successors[1]).toEqualNode(entries[1]);
        expect(successors._references.disconnectIfUnreferenced).toHaveBeenCalledWith(entries[2]);
      });

      it("should not store duplicated nodes", function() {
        successors.addSuccessor(entries[0]);
        successors.addSuccessor(entries[0]);
        expect(successors._successors[0]).toEqualNode(entries[0]);
        expect(successors._successors.length).toBe(1);
      });
    });

    describe("#getDirectSuccessor", function() {
      it("should return direct successor", function() {
        successors.addSuccessor(entries[1]);
        successors.addSuccessor(entries[0]);
        expect(successors.getDirectSuccessor()).toEqualNode(entries[0]);
      });

      it("shoult return null if no successor stored", function() {
        expect(successors.getDirectSuccessor()).toBeNull();
      });
    });

    describe("#getClosestPrecedingNode", function() {
      it("should return closest preceding node of specified key", function() {
        successors.addSuccessor(entries[0]);
        successors.addSuccessor(entries[1]);

        expect(successors.getClosestPrecedingNode(ID.fromHexString(
          "00000000000000000000000000000001ffffffffffffffffffffffffffffffff"))).toEqualNode(entries[0]);
        expect(successors.getClosestPrecedingNode(ID.fromHexString(
          "0000000000000001ffffffffffffffffffffffffffffffff0000000000000000"))).toEqualNode(entries[1]);
        expect(successors.getClosestPrecedingNode(ID.fromHexString(
          "0000000000000000fffffffffffffffffffffffffffffffe0000000000000000"))).toEqualNode(entries[0]);
        expect(successors.getClosestPrecedingNode(ID.fromHexString(
          "00000000000000000000000000000000efffffffffffffffffffffffffffffff"))).toBeNull();
      });

      it("should return null if no successor stored", function() {
        expect(successors.getClosestPrecedingNode(ID.fromHexString(
          "00000000000000000000000000000000ffffffffffffffffffffffffffffffff"))).toBeNull();
      });
    });

    describe("#getReferences", function() {
      it("should return references", function() {
        successors.addSuccessor(entries[0]);
        successors.addSuccessor(entries[1]);

        var references = successors.getReferences();
        expect(references[0]).toEqualNode(entries[0]);
        expect(references[1]).toEqualNode(entries[1]);
      });
    });

    describe("#removeReference", function() {
      it("should remove specified reference", function() {
        successors.addSuccessor(entries[0]);
        successors.addSuccessor(entries[1]);
        successors.removeReference(entries[0]);
        expect(successors.getReferences().length).toBe(1);
        expect(successors.getReferences()[0]).toEqualNode(entries[1]);
      });
    });

    describe("#containsReference", function() {
      it("#should return whether specified reference is stored", function() {
        successors.addSuccessor(entries[0]);
        expect(successors.containsReference(entries[0])).toBeTruthy();
        expect(successors.containsReference(entries[1])).toBeFalsy();
      });
    });
  });
})();
