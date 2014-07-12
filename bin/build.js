({
  baseUrl: '../src',

  paths: {
    lodash: 'lib/lodash',
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
