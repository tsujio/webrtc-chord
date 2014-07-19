var RequestHandler = require('../src/RequestHandler');
var NodeFactory = require('../src/NodeFactory');
var Request = require('../src/Request');
var Entry = require('../src/Entry');
var ID = require('../src/ID');

describe("Node", function() {
  var requestHandler, nodeFactory, localNode;

  beforeEach(function() {
    localNode = jasmine.createSpyObj('localNode', [
      'findSuccessorIterative',
      'notifyAndCopyEntries',
      'notify',
      'insertReplicas',
      'removeReplicas',
      'insertEntryIterative',
      'retrieveEntriesIterative',
      'removeEntryIterative',
      'leavesNetwork',
    ]);
    localNode.nodeId = ID.create('localid');
    nodeFactory = new NodeFactory(localNode, {});
    requestHandler = new RequestHandler(localNode, nodeFactory);
  });

  describe("#_onFindSuccessor", function() {
    it("should invoke callback with successor if success", function(done) {
      localNode.findSuccessorIterative.andCallFake(function(key, callback) {
        expect(key.toHexString()).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        nodeFactory.create({peerId: 'dummy'}, function(successor) {
          callback('SUCCESS', successor);
        });
      });
      requestHandler.handle(Request.create('FIND_SUCCESSOR', {
        key: '0000000000000000000000000000000000000000000000000000000000000000'
      }), function(response) {
        expect(response.status).toBe('SUCCESS');
        expect(response.result.successorNodeInfo.peerId).toBe('dummy');
        done();
      });
    });

    it("should invoke callback with redirectNodeInfo if redirect", function(done) {
      localNode.findSuccessorIterative.andCallFake(function(key, callback) {
        expect(key.toHexString()).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        nodeFactory.create({peerId: 'dummy'}, function(redirectNode) {
          callback('REDIRECT', redirectNode);
        });
      });
      requestHandler.handle(Request.create('FIND_SUCCESSOR', {
        key: '0000000000000000000000000000000000000000000000000000000000000000'
      }), function(response) {
        expect(response.status).toBe('REDIRECT');
        expect(response.result.redirectNodeInfo.peerId).toBe('dummy');
        done();
      });
    });

    it("should invoke callback with error response if passed invalid params", function(done) {
      requestHandler.handle(Request.create('FIND_SUCCESSOR', {}), function(response) {
        expect(response.status).toBe('FAILED');
        done();
      });
    });
  });

  describe("#_onNotifyAndCopy", function() {
    it("should invoke callback with references and entries if success", function(done) {
      localNode.notifyAndCopyEntries.andCallFake(function(potentialPredecessor, callback) {
        expect(potentialPredecessor.getPeerId()).toBe('dummy');
        nodeFactory.createAll([{peerId: 'dummy1'}, {peerId: 'dummy2'}], function(references) {
          callback(references, [
            Entry.fromJson({
              id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'
            }),
            Entry.fromJson({
              id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'
            }),
          ]);
        });
      });
      requestHandler.handle(Request.create('NOTIFY_AND_COPY', {
        potentialPredecessorNodeInfo: {peerId: 'dummy'}
      }), function(response) {
        expect(response.status).toBe('SUCCESS');
        expect(response.result.referencesNodeInfo.length).toBe(2);
        expect(response.result.referencesNodeInfo[0].peerId).toBe('dummy1');
        expect(response.result.referencesNodeInfo[1].peerId).toBe('dummy2');
        expect(response.result.entries.length).toBe(2);
        expect(response.result.entries[0].id).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        expect(response.result.entries[1].id).toBe(
          'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        done();
      });
    });
  });

  describe("#_onNotify", function() {
    it("should invoke callback with references if success", function(done) {
      localNode.notify.andCallFake(function(potentialPredecessor, callback) {
        expect(potentialPredecessor.getPeerId()).toBe('dummy');
        nodeFactory.createAll([{peerId: 'dummy1'}, {peerId: 'dummy2'}], function(references) {
          callback(references);
        });
      });
      requestHandler.handle(Request.create('NOTIFY', {
        potentialPredecessorNodeInfo: {peerId: 'dummy'}
      }), function(response) {
        expect(response.status).toBe('SUCCESS');
        expect(response.result.referencesNodeInfo.length).toBe(2);
        expect(response.result.referencesNodeInfo[0].peerId).toBe('dummy1');
        expect(response.result.referencesNodeInfo[1].peerId).toBe('dummy2');
        done();
      });
    });
  });

  describe("#_onPing", function() {
    it("should invoke callback", function(done) {
      requestHandler.handle(Request.create('PING', {}), function(response) {
        expect(response.status).toBe('SUCCESS');
        done();
      });
    });
  });

  describe("#_onInsertReplicas", function() {
    it("should invoke LocalNode#insertReplicas", function() {
      requestHandler.handle(Request.create('INSERT_REPLICAS', {
        replicas: [
          {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'},
          {id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'},
        ]
      }));
      expect(localNode.insertReplicas).toHaveBeenCalledWith(jasmine.any(Array));
    });
  });

  describe("#_onRemoveReplicas", function() {
    it("should invoke LocalNode#removeReplicas", function() {
      requestHandler.handle(Request.create('REMOVE_REPLICAS', {
        sendingNodeId: '00000000000000000000000000000000ffffffffffffffffffffffffffffffff',
        replicas: [
          {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'},
          {id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'},
        ]
      }));
      expect(localNode.removeReplicas).toHaveBeenCalledWith(jasmine.any(ID), jasmine.any(Array));
    });
  });

  describe("#_onInsertEntry", function() {
    it("should invoke callback with success response if success", function(done) {
      localNode.insertEntryIterative.andCallFake(function(entry, callback) {
        expect(entry.id.toHexString()).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        callback('SUCCESS');
      });
      requestHandler.handle(Request.create('INSERT_ENTRY', {
        entry: {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'}
      }), function(response) {
        expect(response.status).toBe('SUCCESS');
        done();
      });
    });

    it("should invoke callback with redirectNodeInfo if redirect", function(done) {
      localNode.insertEntryIterative.andCallFake(function(entry, callback) {
        expect(entry.id.toHexString()).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        nodeFactory.create({peerId: 'dummy'}, function(redirectNode) {
          callback('REDIRECT', redirectNode);
        });
      });
      requestHandler.handle(Request.create('INSERT_ENTRY', {
        entry: {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'}
      }), function(response) {
        expect(response.status).toBe('REDIRECT');
        expect(response.result.redirectNodeInfo.peerId).toBe('dummy');
        done();
      });
    });

    it("should invoke callback with error response if passed invalid params", function(done) {
      requestHandler.handle(Request.create('INSERT_ENTRY', {
        entry: {id: '00000000000000000000000000000000', value: 'value1'}
      }), function(response) {
        expect(response.status).toBe('FAILED');
        done();
      });
    });
  });

  describe("#_onRetrieveEntries", function() {
    it("should invoke callback with entries if success", function(done) {
      localNode.retrieveEntriesIterative.andCallFake(function(id, callback) {
        expect(id.toHexString()).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        callback('SUCCESS', [
          Entry.fromJson({
            id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'
          }),
          Entry.fromJson({
            id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'
          }),
        ]);
      });
      requestHandler.handle(Request.create('RETRIEVE_ENTRIES', {
        id: '0000000000000000000000000000000000000000000000000000000000000000'
      }), function(response) {
        expect(response.status).toBe('SUCCESS');
        expect(response.result.entries.length).toBe(2);
        expect(response.result.entries[0].id).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        expect(response.result.entries[1].id).toBe(
          'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        done();
      });
    });

    it("should invoke callback with redirectNodeInfo if redirect", function(done) {
      localNode.retrieveEntriesIterative.andCallFake(function(id, callback) {
        expect(id.toHexString()).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        nodeFactory.create({peerId: 'dummy'}, function(redirectNode) {
          callback('REDIRECT', null, redirectNode);
        });
      });
      requestHandler.handle(Request.create('RETRIEVE_ENTRIES', {
        id: '0000000000000000000000000000000000000000000000000000000000000000'
      }), function(response) {
        expect(response.status).toBe('REDIRECT');
        expect(response.result.redirectNodeInfo.peerId).toBe('dummy');
        done();
      });
    });

    it("should invoke callback with error response if passed invalid params", function(done) {
      requestHandler.handle(Request.create('RETRIEVE_ENTRIES', {
        id: '00000000000000000000000000000000'
      }), function(response) {
        expect(response.status).toBe('FAILED');
        done();
      });
    });
  });

  describe("#_onRemoveEntry", function() {
    it("should invoke callback with success response if success", function(done) {
      localNode.removeEntryIterative.andCallFake(function(entry, callback) {
        expect(entry.id.toHexString()).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        callback('SUCCESS');
      });
      requestHandler.handle(Request.create('REMOVE_ENTRY', {
        entry: {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'}
      }), function(response) {
        expect(response.status).toBe('SUCCESS');
        done();
      });
    });

    it("should invoke callback with redirectNodeInfo if redirect", function(done) {
      localNode.removeEntryIterative.andCallFake(function(entry, callback) {
        expect(entry.id.toHexString()).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        nodeFactory.create({peerId: 'dummy'}, function(redirectNode) {
          callback('REDIRECT', redirectNode);
        });
      });
      requestHandler.handle(Request.create('REMOVE_ENTRY', {
        entry: {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'}
      }), function(response) {
        expect(response.status).toBe('REDIRECT');
        expect(response.result.redirectNodeInfo.peerId).toBe('dummy');
        done();
      });
    });

    it("should invoke callback with error response if passed invalid params", function(done) {
      requestHandler.handle(Request.create('REMOVE_ENTRY', {
        entry: {id: '00000000000000000000000000000000', value: 'value1'}
      }), function(response) {
        expect(response.status).toBe('FAILED');
        done();
      });
    });
  });

  describe("#_onLeavesNetwork", function() {
    it("should invoke LocalNode#leavesNetwork with params", function(done) {
      localNode.leavesNetwork.andCallFake(function(predecessor) {
        expect(predecessor.getPeerId()).toBe('dummy');
        done();
      });
      requestHandler._onLeavesNetwork(Request.create('LEAVES_NETWORK', {
        predecessorNodeInfo: {peerId: 'dummy'}
      }));
    });
  });
});
