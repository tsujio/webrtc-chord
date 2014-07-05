webrtc-chord
============

An implementation of Chord, a protocol of Distributed Hash Table, using WebRTC.

## Release
Date       | Version
---------- | -------
2014/07/01 | v0.1.0

Note that releases of different major versions are not compatible.

The next release v1.0.0 being developed on master.

## Requirements
webrtc-chord requires [WebRTC](http://www.webrtc.org/), so check if your
browser supports WebRTC.

It also uses [PeerJS](https://github.com/peers/peerjs) library, which
simplifies the use of WebRTC.
PeerJS needs [PeerServer](https://github.com/peers/peerjs-server) (to act) as signaling
server, so you must run your own PeerServer or use cloud services such as
[PeerServer Cloud](http://peerjs.com/peerserver) or 
[SkyWay](http://nttcom.github.io/skyway/en/) (Centralization problem caused by PeerServer
is discussed in [Issue 2](https://github.com/tsujio/webrtc-chord/issues/2)).
A Chord object receives the information 
for connecting to the PeerServer via a parameter of the constructor.

WebRTC and PeerJS uses STUN/TURN server and PeerServer, so you may need
to adjust some proxy settings to access to them.

## Build
Linux
```sh
npm install -g requirejs
cd webrtc-chord
r.js -o bin/build.js
```

Windows
```bat
npm install -g requirejs
cd webrtc-chord
r.js.cmd -o bin\build.js
```

## Include libraries
webrtc-chord depends on the following libraries.
* [Lo-Dash](http://lodash.com/)
* [sha256.js of crypto-js libraries](https://code.google.com/p/crypto-js/)
* [PeerJS](https://github.com/peers/peerjs)

So you must include them **before** include webrtc-chord.js as the following.
```html
<script type="text/javascript" src="path/to/lodash.js"></script>
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

  debug: false,                         // Enable debug log.
                                        // Defaults to false.

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
chord.create(function(myPeerId, error) {
  if (error) {
    console.log("Failed to create chord network: " + error);
  } else {
    console.log("My peer ID: " + myPeerId);
  }
});
```

or join an existing one.
```javascript
// Join an existing chord network
chord.join(bootstrapId, function(myPeerId, error) {
  if (error) {
    console.log("Failed to join chord network: " + error);
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
chord.insert(key, value, function(id, error) {
  if (error) {
    console.log("Failed to insert entry: " + error);
  }
});

// Retrieve entries
chord.retrieve(key, function(entries, error) {
  if (error) {
    console.log("Failed to retrieve entries: " + error);
  }
});

// Remove entry
chord.remove(key, value, function(error) {
  if (error) {
    console.log("Failed to remove entry: " + error);
  }
});
```
Expect `key` to be a string value type and `value` to be a JSON data type.

You can detect insertion/removal of entries into/from your node as the following.
```javascript
// Invoked when entries are inserted into your node
chord.onentriesinserted = function(insertedEntries) {
  console.log(insertedEntries.length + " entries were inserted.");
};

// Invoked when entries are removed from your node
chord.onentriesremoved = function(removedEntries) {
  console.log(removedEntries.length + " entries were removed.");
};
```

APIs of get/set entries from/to your node are also provided.
```javascript
// Get the entries stored in your node
var entries = chord.getEntries();

// Set entries to your node
chord.setEntries(entries);
```

## Leave network
```javascript
// Leave chord network
chord.leave();
```

## Chord monitor
Chord monitor visualizes actual behavior of a Chord network.

Open `chord-monitor.html` by a WebRTC enabled browser to start monitoring.

You can create nodes by clicking "Create node" button and connect them by "Join network"
button.

Enjoy.

## References
* I. Stoica, et al, [Chord: A scalable peer-to-peer lookup service for internet applications](http://dl.acm.org/citation.cfm?id=383071), 2001
* [Open Chord](http://open-chord.sourceforge.net/)
