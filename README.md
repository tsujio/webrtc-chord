webrtc-chord
============

An implementation of Chord, a protocol of Distributed Hash Table, using WebRTC.

## Requirements
webrtc-chord requires [WebRTC](http://www.webrtc.org/), so check if your
browser supports WebRTC.

It also uses [PeerJS](https://github.com/peers/peerjs) library, which
simplifies the use of WebRTC.
PeerJS needs [PeerServer](https://github.com/peers/peerjs-server) (to act) as signaling
server, so you must run your own PeerServer or use cloud services such as
[PeerServer Cloud](http://peerjs.com/peerserver) or 
[SkyWay](http://nttcom.github.io/skyway/en/). A Chord object receives the information 
for connecting to the PeerServer via a parameter of the constructor.

WebRTC and PeerJS uses STUN/TURN server and PeerServer, so you may need
to adjust some proxy settings to access to them.

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
Expect `key` to be a string value type and `value` to be a JSON data type.

## Leave network
```javascript
// Leave chord network
chord.leave();
```

## Chord monitor
Chord monitor visualizes actual behavior of a Chord network.

To use, open `chord-monitor.html` by a WebRTC enabled browser.

First, create a new node by clicking the "Create node" button and
then click the "Create network" button. If cnnection to the PeerServer 
succeed, the peer ID of the node is displayed above the button.

Then, create another node by clicking "Create node" button and 
copy the peer ID of the first node and paste it into the textbox at the left 
side of the "Join network" button which is at the second node's space.
If joining the network the first node created succeed, the peer ID of the 
second node and statuses of each node are displayed.


Now the two nodes are connected, then try inserting an entry.

Input a key and value into textboxes at the left side of an "Insert" button 
(the first or second node's one, either is ok) and click it. If insertion 
succeed, the entry is displayed both of the nodes's spaces 
(inserted entries are replicated to the near nodes for redundancy).

The entries which have been inserted can be retrieved or removed by 
"Retrieve" or "Remove" buttons.

You can increase nodes by "Create node" button, and obsearve behavior of a Chord 
network.

Enjoy.

## References
* I. Stoica, et al, [Chord: A scalable peer-to-peer lookup service for internet applications](http://dl.acm.org/citation.cfm?id=383071), 2001
* [Open Chord](http://open-chord.sourceforge.net/)
