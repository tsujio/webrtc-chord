define(['FingerTable', 'Node', 'ID'], function(FingerTable, Node, ID) {
  describe("FingerTable", function() {
    var fingerTable;
    var entries;

    beforeEach(function() {
      var localId = ID.fromHexString("0000000000000000000000000000000000000000000000000000000000000000");
      var references = jasmine.createSpyObj('references', ['disconnectIfUnreferenced', 'getSuccessors']);
      references.getSuccessors.and.returnValue(entries);
      fingerTable = new FingerTable(localId, references);

      entries = _(2).times(function() {
        return new Node({peerId: "dummy", nodeId: "dummy"}, null, null, null, {});
      }).value();
      entries[0].nodeId = ID.fromHexString("00000000000000000000000000000000ffffffffffffffffffffffffffffffff");
      entries[1].nodeId = ID.fromHexString("0000000000000000ffffffffffffffffffffffffffffffff0000000000000000");
    });

    describe("#addReference", function() {
      it("should set entry at appropriate index", function() {
        fingerTable.addReference(entries[1]);
        _.each(_.range(0, 192), function(i) {
          expect(fingerTable._table[i]).toBeNull();
        });
        _.each(_.range(192, 256), function(i) {
          expect(fingerTable._table[i]).toEqualNode(entries[1]);
        });

        fingerTable.addReference(entries[0]);
        _.each(_.range(0, 128), function(i) {
          expect(fingerTable._table[i]).toBeNull();
        });
        _.each(_.range(128, 192), function(i) {
          expect(fingerTable._table[i]).toEqualNode(entries[0]);
        });
        _.each(_.range(192, 256), function(i) {
          expect(fingerTable._table[i]).toEqualNode(entries[1]);
        });
      });

      it("should replace old entry if more appropriate entry set", function() {
        fingerTable.addReference(entries[0]);
        _.each(_.range(0, 128), function(i) {
          expect(fingerTable._table[i]).toBeNull();
        });
        _.each(_.range(128, 256), function(i) {
          expect(fingerTable._table[i]).toEqualNode(entries[0]);
        });

        fingerTable.addReference(entries[1]);
        _.each(_.range(0, 128), function(i) {
          expect(fingerTable._table[i]).toBeNull();
        });
        _.each(_.range(128, 192), function(i) {
          expect(fingerTable._table[i]).toEqualNode(entries[0]);
        });
        _.each(_.range(192, 256), function(i) {
          expect(fingerTable._table[i]).toEqualNode(entries[1]);
        });

        expect(fingerTable._references.disconnectIfUnreferenced.calls.count()).toBe(64);
        expect(fingerTable._references.disconnectIfUnreferenced).toHaveBeenCalledWith(entries[0]);
      });
    });

    describe("#getClosestPrecedingNode", function() {
      it("should return closest preceding node of specified key", function() {
        fingerTable.addReference(entries[0]);
        expect(fingerTable.getClosestPrecedingNode(ID.fromHexString(
          "00000000000000000000000000000001ffffffffffffffffffffffffffffffff"))).toEqualNode(entries[0]);
        expect(fingerTable.getClosestPrecedingNode(ID.fromHexString(
          "0000000000000001ffffffffffffffffffffffffffffffff0000000000000000"))).toEqualNode(entries[0]);
        expect(fingerTable.getClosestPrecedingNode(ID.fromHexString(
          "00000000000000000000000000000000fffffffffffffffffffffffffffffffe"))).toBeNull();

        fingerTable.addReference(entries[1]);

        expect(fingerTable.getClosestPrecedingNode(ID.fromHexString(
          "00000000000000000000000000000001ffffffffffffffffffffffffffffffff"))).toEqualNode(entries[0]);
        expect(fingerTable.getClosestPrecedingNode(ID.fromHexString(
          "0000000000000001ffffffffffffffffffffffffffffffff0000000000000000"))).toEqualNode(entries[1]);
        expect(fingerTable.getClosestPrecedingNode(ID.fromHexString(
          "00000000000000000000000000000000fffffffffffffffffffffffffffffffe"))).toBeNull();
      });
    });

    describe("#removeReference", function() {
      it("should remove specified reference and replace the positions with appropriate node", function() {
        fingerTable.addReference(entries[0]);
        fingerTable.addReference(entries[1]);

        fingerTable.removeReference(entries[0]);

        _.each(_.range(0, 192), function(i) {
          expect(fingerTable._table[i]).toBeNull();
        });
        _.each(_.range(192, 256), function(i) {
          expect(fingerTable._table[i]).toEqualNode(entries[1]);
        });

        fingerTable.removeReference(entries[1]);

        _.each(_.range(0, 256), function(i) {
          expect(fingerTable._table[i]).toBeNull();
        });

        fingerTable.addReference(entries[0]);
        fingerTable.addReference(entries[1]);

        fingerTable.removeReference(entries[1]);

        _.each(_.range(0, 128), function(i) {
          expect(fingerTable._table[i]).toBeNull();
        });
        _.each(_.range(128, 256), function(i) {
          expect(fingerTable._table[i]).toEqualNode(entries[0]);
        });

        fingerTable.removeReference(entries[0]);

        _.each(_.range(0, 256), function(i) {
          expect(fingerTable._table[i]).toBeNull();
        });
      });
    });

    describe("#getFirstFingerTableEntries", function() {
      it("should return the first n entries", function() {
        expect(fingerTable.getFirstFingerTableEntries()).toEqual([]);

        fingerTable.addReference(entries[0]);
        expect(fingerTable.getFirstFingerTableEntries().length).toBe(1);
        expect(fingerTable.getFirstFingerTableEntries()[0]).toEqualNode(entries[0]);

        fingerTable.addReference(entries[1]);
        expect(fingerTable.getFirstFingerTableEntries().length).toBe(2);
        expect(fingerTable.getFirstFingerTableEntries()[0]).toEqualNode(entries[0]);
        expect(fingerTable.getFirstFingerTableEntries()[1]).toEqualNode(entries[1]);

        expect(fingerTable.getFirstFingerTableEntries(1).length).toBe(1);
        expect(fingerTable.getFirstFingerTableEntries()[0]).toEqualNode(entries[0]);
      });
    });

    describe("#containsReference", function() {
      it("should return whether specified reference is contained", function() {
        fingerTable.addReference(entries[0]);

        expect(fingerTable.containsReference(entries[0])).toBeTruthy();
        expect(fingerTable.containsReference(entries[1])).toBeFalsy();

        fingerTable.addReference(entries[1]);

        expect(fingerTable.containsReference(entries[0])).toBeTruthy();
        expect(fingerTable.containsReference(entries[1])).toBeTruthy();
      });
    });
  });
});
