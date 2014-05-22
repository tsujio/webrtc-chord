webrtc-chord
============

An implementation of Chord, a kind of Distributed Hash Table, using WebRTC.

## Requirements
webrtc-chord uses [WebRTC](http://www.webrtc.org/) as transports, so check your
browser supports WebRTC.

It also uses [PeerJS](https://github.com/peers/peerjs) library, which
simplifies use of WebRTC.
PeerJS needs [PeerServer](https://github.com/peers/peerjs-server) as signaling
server, so you must run your own PeerServer or use cloud service like 
[PeerServer Cloud](http://peerjs.com/peerserver) or 
[SkyWay](http://nttcom.github.io/skyway/en/). The information of PeerServer 
must be passed to chord object as parameter of the constructor.

WebRTC and PeerJS uses STUN/TURN server and PeerServer, so you may need
some proxy settings to access to them.

## Include libraries
webrtc-chord depends on the following libraries.
* [underscore.js](http://underscorejs.org/)
* [sha256.js of crypto-js libraries](https://code.google.com/p/crypto-js/)
* [PeerJS](https://github.com/peers/peerjs)

So you must include them **before** include webrtc-chord.js as the following.
```html
<script type="text/javascript" src="path/to/underscore.js"></script>
<script type="text/javascript" src="path/to/sha256.js"></script>
<script type="text/javascript" src="path/to/peer.js"></script>
<script type="text/javascript" src="path/to/webrtc-chord.js"></script>
```

## Setup
First, create a new chord instance.
```javascript
// Create a new chord instance
var chord = new Chord(config);
```

`config` is an object containing the following properties.
```javascript
var config = {
  peer: {                               // The object to pass to the Peer constructor.
    id: 'yourid',                       // See the PeerJS document for details.
    options: {
      host: ...,
      ...
    }
  },

  numberOfEntriesInSuccessorList: 3,    // The number of nodes to retain as successor.
                                        // Defaults to 3.

  connectionPoolSize: 10,               // The capacity of connection pool.
                                        // Defaults to 10.

  connectionOpenTimeout: 30000,         // The timeout in milliseconds for waiting
                                        // opening a connection.
                                        // Defaults to 30000.

  requestTimeout: 180000,               // The timeout in milliseconds for waiting
                                        // a response from the other node.
                                        // Defaults to 180000.

  stabilizeTaskInterval: 30000,         // The interval in milliseconds in which the
                                        // stabilize task works.
                                        // Defaults to 30000.

  fixFingerTaskInterval: 30000,         // The interval in milliseconds in which the
                                        // fix finger task works.
                                        // Defaults to 30000.

  checkPredecessorTaskInterval: 30000,  // The interval in milliseconds in which the
                                        // check predecessor task works.
                                        // Defaults to 30000.
};
```

## Chord network
After creating an instance, create a new chord network,
```javascript
// Create a new chord network
chord.create(function(myPeerId) {
  if (myPeerId === null) {
    console.log("Failed to create chord network.");
  } else {
    console.log("My peer ID: " + myPeerId);
  }
});
```

or join an existing one.
```javascript
// Join an existing chord network
chord.join(bootstrapId, function(myPeerId) {
  if (myPeerId === null) {
    console.log("Failed to join chord network.");
  } else {
    console.log("My peer ID: " + myPeerId);
  }
});
```
`bootstrapId` is the peer ID of the node which you initially connect to.

## Entries
Then, you can insert/retrieve/remove entries.
```javascript
// Insert entry
chord.insert(key, value, function(inserted) {
  if (!inserted) {
    console.log("Failed to insert entry.");
  } else {
    console.log("The entry has been inserted.");
  }
});

// Retrieve entry
chord.retrieve(key, function(entries) {
  if (entries === null) {
    console.log("Failed to retrieve entries.");
  } else {
    console.log("Retrieved entries: " + entries.toString());
  }
});

// Remove entry
chord.remove(key, value);
```
Expects `key` to string and `value` to json.

## Leave network
```javascript
// Leave chord network
chord.leave();
```

## References
* I. Stoica, et al, [Chord: A scalable peer-to-peer lookup service for internet applications](http://dl.acm.org/citation.cfm?id=383071), 2001
* [Open Chord](http://open-chord.sourceforge.net/)
