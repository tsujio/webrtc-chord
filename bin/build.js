({
  baseUrl: '../src',

  paths: {
    underscore: 'lib/underscore',
    peerjs: 'lib/peerjs',
    cryptojs: 'lib/cryptojs'
  },

  include: ['Chord'],

  name: 'lib/almond',

  wrap: {
    startFile: 'start.frag',
    endFile: 'end.frag'
  },

  out: "../dist/webrtc-net.js"
})
