var ConnectionFactory, NodeFactory, ID;
replaceConnectionPool(function() {
  ConnectionFactory = require('connectionpool');
  NodeFactory = require('../src/NodeFactory');
  ID = require('../src/ID');
});

describe("NodeFactory", function() {
  var nodeFactory;
  var localNode;

  beforeEach(function() {
    localNode = jasmine.createSpy('localNode');
    localNode.nodeId = ID.create('localid');
    nodeFactory = new NodeFactory(localNode, {});
    nodeFactory._connectionFactory = new ConnectionFactory();
  });

  describe("#create", function() {
    it("should create node object", function(done) {
      nodeFactory.create({peerId: 'dummyid'}, function(node, error) {
        expect(node.getPeerId()).toBe('dummyid');
        done();
      });
    });

    it("should return error if passed invalid node info", function(done) {
      nodeFactory.create({peerId: ''}, function(node, error) {
        expect(error).toEqual(jasmine.any(Error));
        done();
      });
    });

    it("should return local node if passed local node info", function(done) {
      nodeFactory.create({peerId: 'localid'}, function(node, error) {
        expect(node).toBe(localNode);
        done();
      });
    });
  });

  describe("#createAll", function() {
    it("should create all nodes of passed nodes info", function(done) {
      nodeFactory.createAll([
        {peerId: 'dummyid1'}, {peerId: 'dummyid2'}, {peerId: 'dummyid3'}
      ], function(nodes, error) {
        expect(nodes.length).toBe(3);
        expect(nodes[0].getPeerId()).toBe('dummyid1');
        expect(nodes[1].getPeerId()).toBe('dummyid2');
        expect(nodes[2].getPeerId()).toBe('dummyid3');
        done();
      });
    });

    it("should ignore invalid node info", function(done) {
      nodeFactory.createAll([
        {peerId: 'dummyid1'}, {peerId: ''}, {peerId: 'dummyid3'}
      ], function(nodes, error) {
        expect(nodes.length).toBe(2);
        expect(nodes[0].getPeerId()).toBe('dummyid1');
        expect(nodes[1].getPeerId()).toBe('dummyid3');
        done();
      });
    });
  });

  describe("#setListenersToConnection", function() {
    it("should set listeners to passed connection", function() {
      var connection = {};
      nodeFactory.setListenersToConnection(connection);
      expect(connection.ondata).toEqual(jasmine.any(Function));
      expect(connection.onerror).toEqual(jasmine.any(Function));
    });
  });

  describe("#registerCallback", function() {
    it("should register passed callback", function() {
      var callback = function() {};
      nodeFactory.registerCallback('key', callback);
      expect(nodeFactory._callbacks['key']).toBe(callback);
    });
  });

  describe("#deregisterCallback", function() {
    it("should deregister and return callback", function() {
      var callback = function() {};
      nodeFactory.registerCallback('key', callback);
      expect(nodeFactory.deregisterCallback('key')).toBe(callback);
      expect(Object.keys(nodeFactory._callbacks).length).toBe(0);
    });

    it("should return null if passed unknown key", function() {
      var callback = function() {};
      nodeFactory.registerCallback('key', callback);
      expect(nodeFactory.deregisterCallback('unknownkey')).toBeNull();
      expect(Object.keys(nodeFactory._callbacks).length).toBe(1);
    });
  });

  describe("#destroy", function() {
    it("should destroy ConnectionFactory", function() {
      spyOn(nodeFactory._connectionFactory, 'destroy');
      nodeFactory.destroy();
      expect(nodeFactory._connectionFactory.destroy).toHaveBeenCalled();
    });
  });
});
