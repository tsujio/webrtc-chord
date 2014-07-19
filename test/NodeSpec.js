var Node, ConnectionFactory, NodeFactory, Request, Response, ID, Entry;
replaceConnectionPool(function() {
  Node = require('../src/Node');
  ConnectionFactory = require('connectionpool');
  NodeFactory = require('../src/NodeFactory');
  Request = require('../src/Request');
  Response = require('../src/Response');
  ID = require('../src/ID');
  Entry = require('../src/Entry');
});

describe("Node", function() {
  var node, connectionFactory, connection, nodeFactory, requestHandler;

  beforeEach(function() {
    connectionFactory = new ConnectionFactory({});
    connection = jasmine.createSpyObj('connection', ['send', 'getRemotePeerId']);
    connection.getRemotePeerId.andReturn('dummy');
    spyOn(connectionFactory, 'create');
    connectionFactory.create.andCallFake(function(peerId, callback) {
      callback(connection);
    });

    localNode = jasmine.createSpy('localNode');
    localNode.nodeId = orderedNodesInfo[0].nodeId;
    nodeFactory = new NodeFactory(localNode, {});
    nodeFactory._connectionFactory = connectionFactory;

    requestHandler = jasmine.createSpyObj('requestHandler', ['handle']);

    node = new Node(orderedNodesInfo[1], orderedNodesInfo[0].nodeId, nodeFactory, connectionFactory,
                    requestHandler, {});
  });

  describe("#isValidNodeInfo", function() {
    it("should validate passed node info", function() {
      expect(Node.isValidNodeInfo({peerId: 'dummyid'})).toBeTruthy();
      expect(Node.isValidNodeInfo({peerId: ''})).toBeFalsy();
      expect(Node.isValidNodeInfo({})).toBeFalsy();
      expect(Node.isValidNodeInfo('dummyid')).toBeFalsy();
    });
  });

  describe("#findSuccessor", function() {
    it("should invoke callback with successor when success", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('FIND_SUCCESSOR');
        connection.ondata(Response.create('SUCCESS', {
          successorNodeInfo: {peerId: 'dummy'}
        }, request).toJson());
      });

      node.findSuccessor(ID.create('foo'), function(successor, error) {
        expect(successor.getPeerId()).toBe('dummy');
        expect(error).toBeUndefined();
        done();
      });
    });

    it("should continue to find successor when redirect", function(done) {
      var i = 0;
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('FIND_SUCCESSOR');
        if (i < 3) {
          i++;
          connection.ondata(Response.create('REDIRECT', {
            redirectNodeInfo: orderedNodesInfo[i + 2]
          }, request).toJson());
        } else {
          connection.ondata(Response.create('SUCCESS', {
            successorNodeInfo: orderedNodesInfo[i + 2]
          }, request).toJson());
        }
      });

      node.findSuccessor(ID.create('foo'), function(successor, error) {
        expect(successor.getPeerId()).toBe(orderedNodesInfo[5].peerId);
        expect(error).toBeUndefined();
        done();
      });
    });

    it("should invoke callback with error when error", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('FIND_SUCCESSOR');
        connection.ondata(Response.create('FAILED', {
          successorNodeInfo: {peerId: 'dummy'}
        }, request).toJson());
      });

      node.findSuccessor(ID.create('foo'), function(successor, error) {
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });

    it("should invoke callback with error when error occurred while redirect", function(done) {
      var i = 0;
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('FIND_SUCCESSOR');
        if (i < 3) {
          i++;
          connection.ondata(Response.create('REDIRECT', {
            redirectNodeInfo: orderedNodesInfo[i + 2]
          }, request).toJson());
        } else {
          connection.ondata(Response.create('FAILED', {
            successorNodeInfo: orderedNodesInfo[i + 2]
          }, request).toJson());
        }
      });

      node.findSuccessor(ID.create('foo'), function(successor, error) {
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });

    it("should invoke callback with error when request circulates in the network", function(done) {
      var i = 0;
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('FIND_SUCCESSOR');
        if (i < 3) {
          i++;
          connection.ondata(Response.create('REDIRECT', {
            redirectNodeInfo: orderedNodesInfo[i + 2]
          }, request).toJson());
        } else {
          connection.ondata(Response.create('REDIRECT', {
            redirectNodeInfo: orderedNodesInfo[i]
          }, request).toJson());
        }
      });

      node.findSuccessor(ID.create('foo'), function(successor, error) {
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });
  });

  describe("#notifyAndCopyEntries", function() {
    it("should invoke callback with references and entries when success", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('NOTIFY_AND_COPY');
        connection.ondata(Response.create('SUCCESS', {
          referencesNodeInfo: [{peerId: 'dummy1'}, {peerId: 'dummy2'}, {peerId: 'dummy3'}],
          entries: [
            {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'},
            {id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'}
          ]
        }, request).toJson());
      });

      nodeFactory.create({peerId: 'dummy'}, function(potentialPredecessor) {
        node.notifyAndCopyEntries(potentialPredecessor, function(references, entries, error) {
          expect(references.length).toBe(3);
          expect(references[0].getPeerId()).toBe('dummy1');
          expect(references[1].getPeerId()).toBe('dummy2');
          expect(references[2].getPeerId()).toBe('dummy3');
          expect(entries.length).toBe(2);
          expect(entries[0].id.toHexString()).toBe(
            '0000000000000000000000000000000000000000000000000000000000000000');
          expect(entries[1].id.toHexString()).toBe(
            'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
          expect(error).toBeUndefined();
          done();
        });
      });
    });

    it("should invoke callback with error when error", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('NOTIFY_AND_COPY');
        connection.ondata(Response.create('FAILED', {
          referencesNodeInfo: [{peerId: 'dummy1'}, {peerId: 'dummy2'}, {peerId: 'dummy3'}],
          entries: [
            {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'},
            {id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'}
          ]
        }, request).toJson());
      });

      nodeFactory.create({peerId: 'dummy'}, function(potentialPredecessor) {
        node.notifyAndCopyEntries(potentialPredecessor, function(references, entries, error) {
          expect(references).toBeNull();
          expect(entries).toBeNull();
          expect(error).toEqual(jasmine.any(Error));
          done();
        });
      });
    });
  });

  describe("#notify", function() {
    it("should invoke callback with references when success", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('NOTIFY');
        connection.ondata(Response.create('SUCCESS', {
          referencesNodeInfo: [{peerId: 'dummy1'}, {peerId: 'dummy2'}, {peerId: 'dummy3'}],
        }, request).toJson());
      });

      nodeFactory.create({peerId: 'dummy'}, function(potentialPredecessor) {
        node.notify(potentialPredecessor, function(references, error) {
          expect(references.length).toBe(3);
          expect(references[0].getPeerId()).toBe('dummy1');
          expect(references[1].getPeerId()).toBe('dummy2');
          expect(references[2].getPeerId()).toBe('dummy3');
          expect(error).toBeUndefined();
          done();
        });
      });
    });

    it("should invoke callback with error when error", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('NOTIFY');
        connection.ondata(Response.create('FAILED', {
          referencesNodeInfo: [{peerId: 'dummy1'}, {peerId: 'dummy2'}, {peerId: 'dummy3'}],
        }, request).toJson());
      });

      nodeFactory.create({peerId: 'dummy'}, function(potentialPredecessor) {
        node.notify(potentialPredecessor, function(references, error) {
          expect(references).toBeNull();
          expect(error).toEqual(jasmine.any(Error));
          done();
        });
      });
    });
  });

  describe("#leaveNetwork", function() {
    it("should send request with predecessor node info", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('LEAVES_NETWORK');
        expect(request.params.predecessorNodeInfo.peerId).toBe('dummy');
        done();
      });

      nodeFactory.create({peerId: 'dummy'}, function(predecessor) {
        node.leavesNetwork(predecessor);
      });
    });
  });

  describe("#ping", function() {
    it("should invoke callback when success", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('PING');
        connection.ondata(Response.create('SUCCESS', {
        }, request).toJson());
      });

      node.ping(function(error) {
        expect(error).toBeUndefined();
        done();
      });
    });

    it("should invoke callback with error when error", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('PING');
        connection.ondata(Response.create('FAILED', {
        }, request).toJson());
      });

      node.ping(function(error) {
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });
  });

  describe("#insertReplicas", function() {
    it("should send request with replicas", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('INSERT_REPLICAS');
        expect(request.params.replicas.length).toBe(2);
        expect(request.params.replicas[0].id).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        expect(request.params.replicas[1].id).toBe(
          'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        done();
      });

      node.insertReplicas([
        Entry.fromJson({
          id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'
        }),
        Entry.fromJson({
          id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'
        })
      ]);
    });
  });

  describe("#removeReplicas", function() {
    it("should send request with sending node id and replicas", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('REMOVE_REPLICAS');
        expect(request.params.sendingNodeId).toBe(
          '00000000000000000000000000000000ffffffffffffffffffffffffffffffff'
        );
        expect(request.params.replicas.length).toBe(2);
        expect(request.params.replicas[0].id).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        expect(request.params.replicas[1].id).toBe(
          'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        done();
      });

      node.removeReplicas(ID.fromHexString(
        '00000000000000000000000000000000ffffffffffffffffffffffffffffffff'
      ), [
        Entry.fromJson({
          id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'
        }),
        Entry.fromJson({
          id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'
        })
      ]);
    });
  });

  describe("#insertEntry", function() {
    it("should invoke callback when success", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('INSERT_ENTRY');
        connection.ondata(Response.create('SUCCESS', {
        }, request).toJson());
      });

      node.insertEntry(Entry.fromJson({
        id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value'
      }), function(error) {
        expect(error).toBeUndefined();
        done();
      });
    });

    it("should continue to insert entry when redirect", function(done) {
      var i = 0;
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('INSERT_ENTRY');
        if (i < 3) {
          i++;
          connection.ondata(Response.create('REDIRECT', {
            redirectNodeInfo: {peerId: 'dummy' + i}
          }, request).toJson());
        } else {
          connection.ondata(Response.create('SUCCESS', {
          }, request).toJson());
        }
      });

      node.insertEntry(Entry.fromJson({
        id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value'
      }), function(error) {
        expect(error).toBeUndefined();
        done();
      });
    });

    it("should invoke callback with error when error", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('INSERT_ENTRY');
        connection.ondata(Response.create('FAILED', {
        }, request).toJson());
      });

      node.insertEntry(Entry.fromJson({
        id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value'
      }), function(error) {
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });

    it("should invoke callback with error when error occurred while redirect", function(done) {
      var i = 0;
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('INSERT_ENTRY');
        if (i < 3) {
          i++;
          connection.ondata(Response.create('REDIRECT', {
            redirectNodeInfo: {peerId: 'dummy' + i}
          }, request).toJson());
        } else {
          connection.ondata(Response.create('FAILED', {
          }, request).toJson());
        }
      });

      node.insertEntry(Entry.fromJson({
        id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value'
      }), function(error) {
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });
  });

  describe("#retrieveEntries", function() {
    it("should invoke callback with entries when success", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('RETRIEVE_ENTRIES');
        connection.ondata(Response.create('SUCCESS', {
          entries: [
            {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'},
            {id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'}
          ]
        }, request).toJson());
      });

      node.retrieveEntries(ID.fromHexString(
        '00000000000000000000000000000000ffffffffffffffffffffffffffffffff'
      ), function(entries, error) {
        expect(entries.length).toBe(2);
        expect(entries[0].id.toHexString()).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        expect(entries[1].id.toHexString()).toBe(
          'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        expect(error).toBeUndefined();
        done();
      });
    });

    it("should continue to retrieve entries when redirect", function(done) {
      var i = 0;
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('RETRIEVE_ENTRIES');
        if (i < 3) {
          i++;
          connection.ondata(Response.create('REDIRECT', {
            redirectNodeInfo: {peerId: 'dummy' + i}
          }, request).toJson());
        } else {
          connection.ondata(Response.create('SUCCESS', {
            entries: [
              {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'},
              {id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'}
            ]
          }, request).toJson());
        }
      });

      node.retrieveEntries(ID.fromHexString(
        '00000000000000000000000000000000ffffffffffffffffffffffffffffffff'
      ), function(entries, error) {
        expect(entries.length).toBe(2);
        expect(entries[0].id.toHexString()).toBe(
          '0000000000000000000000000000000000000000000000000000000000000000');
        expect(entries[1].id.toHexString()).toBe(
          'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
        expect(error).toBeUndefined();
        done();
      });
    });

    it("should invoke callback with error when error", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('RETRIEVE_ENTRIES');
        connection.ondata(Response.create('FAILED', {
          entries: [
            {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'},
            {id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'}
          ]
        }, request).toJson());
      });

      node.retrieveEntries(ID.fromHexString(
        '00000000000000000000000000000000ffffffffffffffffffffffffffffffff'
      ), function(entries, error) {
        expect(entries).toBeNull();
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });

    it("should invoke callback with error when error occurred while redirect", function(done) {
      var i = 0;
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('RETRIEVE_ENTRIES');
        if (i < 3) {
          i++;
          connection.ondata(Response.create('REDIRECT', {
            redirectNodeInfo: {peerId: 'dummy' + i}
          }, request).toJson());
        } else {
          connection.ondata(Response.create('FAILED', {
            entries: [
              {id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value1'},
              {id: 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff', value: 'value2'}
            ]
          }, request).toJson());
        }
      });

      node.retrieveEntries(ID.fromHexString(
        '00000000000000000000000000000000ffffffffffffffffffffffffffffffff'
      ), function(entries, error) {
        expect(entries).toBeNull();
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });
  });

  describe("#removeEntry", function() {
    it("should invoke callback when success", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('REMOVE_ENTRY');
        connection.ondata(Response.create('SUCCESS', {
        }, request).toJson());
      });

      node.removeEntry(Entry.fromJson({
        id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value'
      }), function(error) {
        expect(error).toBeUndefined();
        done();
      });
    });

    it("should continue to remove entry when redirect", function(done) {
      var i = 0;
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('REMOVE_ENTRY');
        if (i < 3) {
          i++;
          connection.ondata(Response.create('REDIRECT', {
            redirectNodeInfo: {peerId: 'dummy' + i}
          }, request).toJson());
        } else {
          connection.ondata(Response.create('SUCCESS', {
          }, request).toJson());
        }
      });

      node.removeEntry(Entry.fromJson({
        id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value'
      }), function(error) {
        expect(error).toBeUndefined();
        done();
      });
    });

    it("should invoke callback with error when error", function(done) {
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('REMOVE_ENTRY');
        connection.ondata(Response.create('FAILED', {
        }, request).toJson());
      });

      node.removeEntry(Entry.fromJson({
        id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value'
      }), function(error) {
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });

    it("should invoke callback with error when error occurred while redirect", function(done) {
      var i = 0;
      connection.send.andCallFake(function(request) {
        expect(request.method).toBe('REMOVE_ENTRY');
        if (i < 3) {
          i++;
          connection.ondata(Response.create('REDIRECT', {
            redirectNodeInfo: {peerId: 'dummy' + i}
          }, request).toJson());
        } else {
          connection.ondata(Response.create('FAILED', {
          }, request).toJson());
        }
      });

      node.removeEntry(Entry.fromJson({
        id: '0000000000000000000000000000000000000000000000000000000000000000', value: 'value'
      }), function(error) {
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });
  });

  describe("#_sendRequest", function() {
    it("should invoke success callback if received SUCCESS", function(done) {
      connection.send.andCallFake(function(request) {
        connection.ondata(Response.create('SUCCESS', {key: 'value'}, request).toJson());
      });

      node._sendRequest('FIND_SUCCESSOR', {}, {
        success: function(result) {
          expect(result).toEqual({key: 'value'});
          done();
        }
      });
    });

    it("should invoke redirect callback if received REDIRECT", function(done) {
      connection.send.andCallFake(function(request) {
        connection.ondata(Response.create('REDIRECT', {key: 'value'}, request).toJson());
      });

      node._sendRequest('FIND_SUCCESSOR', {}, {
        redirect: function(result) {
          expect(result).toEqual({key: 'value'});
          done();
        }
      });
    });

    it("should invoke error callback if received FAILED", function(done) {
      connection.send.andCallFake(function(request) {
        connection.ondata(Response.create('FAILED', {key: 'value'}, request).toJson());
      });

      node._sendRequest('FIND_SUCCESSOR', {}, {
        error: function(error) {
          expect(error).toEqual(jasmine.any(Error));
          done();
        }
      });
    });

    it("should invoke error callback if creating connection fails", function(done) {
      connectionFactory.create.andCallFake(function(peerId, callback) {
        callback(null, new Error('error'));
      });

      node._sendRequest('FIND_SUCCESSOR', {}, {
        error: function(error) {
          expect(error).toEqual(jasmine.any(Error));
          done();
        }
      });
    });

    it("should invoke error callback if request times out", function(done) {
      node._config.requestTimeout = 1;
      node._sendRequest('FIND_SUCCESSOR', {}, {
        error: function(error) {
          expect(error).toEqual(jasmine.any(Error));
          done();
        }
      });
    });
  });

  describe("#onRequestReceived", function() {
    it("should invoke RequestHandler#handle and send response", function(done) {
      var response;
      node._requestHandler.handle.andCallFake(function(request, callback) {
        response = Response.create('SUCCESS', {}, request);
        callback(response);

        expect(connection.ondata).toEqual(jasmine.any(Function));
        expect(connection.onerror).toEqual(jasmine.any(Function));
        expect(connection.send).toHaveBeenCalled();
        done();
      });

      node.onRequestReceived(Request.create('FIND_SUCCESSOR', {}));
    });

    it("should not send response if error", function(done) {
      connectionFactory.create.andCallFake(function(peerId, callback) {
        callback(null, new Error('error'));
      });

      var response;
      node._requestHandler.handle.andCallFake(function(request, callback) {
        response = Response.create('SUCCESS', {}, request);
        callback(response);

        expect(node._nodeFactory.setListenersToConnection).not.toHaveBeenCalled();
        expect(connection.send).not.toHaveBeenCalled();
        done();
      });
      spyOn(node._nodeFactory, 'setListenersToConnection');

      node.onRequestReceived(Request.create('FIND_SUCCESSOR', {}));
    });
  });

  describe("#onResponseReceived", function() {
    it("should invoke registered callback", function(done) {
      var response = Response.create('SUCCESS', {}, Request.create('FIND_SUCCESSOR', {}));
      node._nodeFactory.registerCallback(response.requestId, function(_response) {
        expect(_response).toBe(response);
        expect(Object.keys(node._nodeFactory._callbacks).length).toBe(0);
        done();
      });
      node.onResponseReceived(response);
    });

    it("should do nothing if callback is not registered", function() {
      var response1 = Response.create('SUCCESS', {}, Request.create('FIND_SUCCESSOR', {}));
      var response2 = Response.create('SUCCESS', {}, Request.create('FIND_SUCCESSOR', {}));
      var spyFunc = jasmine.createSpy('spyFunc');
      node._nodeFactory.registerCallback(response1.requestId, spyFunc);

      node.onResponseReceived(response2);

      expect(spyFunc).not.toHaveBeenCalled();
      expect(Object.keys(node._nodeFactory._callbacks).length).toBe(1);
    });
  });

  describe("#disconnect", function() {
    it("should invoke ConnectionFactory#removeConnection", function() {
      spyOn(connectionFactory, 'removeConnection');
      node.disconnect();
      expect(connectionFactory.removeConnection).toHaveBeenCalledWith(node.getPeerId());
    });
  });
});
