'use strict';

//hacky way to circumvent self-signed certificate on the server
//should consider what happens w/ security
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
///////////////////////////////////////////////////////////////

var express = require('express');
var app = express();
const tls = require('tls');
const fs = require('fs');
const request = require('request');
const https = require('https');
const stun = require('stun');

const SERVER_IP = '18.130.33.176';
const TLS_PORT = 8000;
const SERVER_URI = "https://"+SERVER_IP+":"+TLS_PORT+"/";
const TURN_USER = 'alex';
const TURN_CRED = 'donthackmepls';

const tlsConfig = {
    ca: [ fs.readFileSync('client.crt') ]
  };

var isInitiator;
var configuration = {"iceServers": [
    {"url": "stun:stun.l.google.com:19302"},
    {"url":"turn:"+TURN_USER+"@"+SERVER_IP, "credential":TURN_CRED}
  ]};

var lobby = randomToken();

function randomToken() {
    return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

/****************************************************************************
* Signaling server
****************************************************************************/
var socket = tls.connect(TLS_PORT, SERVER_IP, tlsConfig, () => {
  console.log('TLS connection established and ', socket.authorized ? 'authorized' : 'unauthorized');

  //initial checks eg if already registered etc - stuff

  request.get(SERVER_URI+'charizard').on('data', function(d) {
    process.stdout.write(d);
  });

  stun.request("turn:"+TURN_USER+"@"+SERVER_IP, (err, res) => {
    if (err) {
      console.error(err);
    } else {
      const { address } = res.getXorAddress();
      request.post(SERVER_URI+'requestKey')
              .form({id:address})
              .on('data', function(d) {
                process.stdout.write(d);
              }); 
    }
  });

});

socket.setEncoding('utf8');

socket.on('data', (data) => {
  console.log(data);
});

socket.on('end', () => {
  console.log('Session Closed')
});

///////////////////////////////
socket.on('created', function(lobby, clientId) {
  console.log('Created lobby', lobby, '- my client ID is', clientId);
  isInitiator = true;
  //grabWebCamVideo();
});

socket.on('joined', function(lobby, clientId) {
  console.log('This peer has joined lobby', lobby, 'with client ID', clientId);
  isInitiator = false;
  //createPeerConnection(isInitiator, configuration);
  //grabWebCamVideo();
});

socket.on('full', function(lobby) {
  alert('Lobby ' + lobby + ' is full. We will create a new lobby for you.');
  window.location.hash = '';
  window.location.reload();
});

socket.on('ready', function() {
  console.log('Socket is ready');
  //createPeerConnection(isInitiator, configuration);
});

socket.on('log', function(array) {
  console.log.apply(console, array);
});

socket.on('message', function(message) {
  console.log('Client received message:', message);
  //signalingMessageCallback(message);
});

// Join a room
socket.emit('create or join', lobby);

// if (location.hostname.match(/localhost|127\.0\.0/)) {
//   socket.emit('ipaddr');
// }

/**
* Send message to signaling server
*/
function sendMessage(message) {
  console.log('Client sending message: ', message);
  socket.emit('message', message);
}

/**
* Updates URL on the page so that users can copy&paste it to their peers.
*/
// function updateRoomURL(ipaddr) {
//   var url;
//   if (!ipaddr) {
//     url = location.href;
//   } else {
//     url = location.protocol + '//' + ipaddr + ':2013/#' + room;
//   }
//   roomURL.innerHTML = url;
// }

/****************************************************************************
* User media (webcam)
****************************************************************************/
function grabWebCamVideo() {}
function gotStream(stream) {}
/****************************************************************************
* WebRTC peer connection and data channel
****************************************************************************/

var peerConn;
var dataChannel;

function signalingMessageCallback(message) {
  if (message.type === 'offer') {
    console.log('Got offer. Sending answer to peer.');
    peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {},
                                  logError);
    peerConn.createAnswer(onLocalSessionCreated, logError);

  } else if (message.type === 'answer') {
    console.log('Got answer.');
    peerConn.setRemoteDescription(new RTCSessionDescription(message), function() {},
                                  logError);

  } else if (message.type === 'candidate') {
    peerConn.addIceCandidate(new RTCIceCandidate({
      candidate: message.candidate
    }));

  } else if (message === 'bye') {
// TODO: cleanup RTC connection?
}
}

function createPeerConnection(isInitiator, config) {
  console.log('Creating Peer connection as initiator?', isInitiator, 'config:',config);
  peerConn = new RTCPeerConnection(config);

  // send any ice candidates to the other peer
  peerConn.onicecandidate = function(event) {
    console.log('icecandidate event:', event);
    if (event.candidate) {
      sendMessage({
        type: 'candidate',
        label: event.candidate.sdpMLineIndex,
        id: event.candidate.sdpMid,
        candidate: event.candidate.candidate
      });
    } else {
      console.log('End of candidates.');
    }
  };

  if (isInitiator) {
    console.log('Creating Data Channel');
    dataChannel = peerConn.createDataChannel('photos');
    onDataChannelCreated(dataChannel);

    console.log('Creating an offer');
    peerConn.createOffer(onLocalSessionCreated, logError);
  } else {
    peerConn.ondatachannel = function(event) {
      console.log('ondatachannel:', event.channel);
      dataChannel = event.channel;
      onDataChannelCreated(dataChannel);
    };
  }
}

function onLocalSessionCreated(desc) {
  console.log('local session created:', desc);
  peerConn.setLocalDescription(desc, function() {
    console.log('sending local desc:', peerConn.localDescription);
    sendMessage(peerConn.localDescription);
  }, logError);
}

function onDataChannelCreated(channel) {
  console.log('onDataChannelCreated:', channel);

  channel.onopen = function() {
    console.log('CHANNEL opened!!!');
  };

  channel.onmessage = (adapter.browserDetails.browser === 'firefox') 
  ? receiveDataFirefoxFactory() : receiveDataChromeFactory();
}

function receiveDataChromeFactory() {
  var buf, count;

  return function onmessage(event) {
    if (typeof event.data === 'string') {
      buf = window.buf = new Uint8ClampedArray(parseInt(event.data));
      count = 0;
      console.log('Expecting a total of ' + buf.byteLength + ' bytes');
      return;
    }

    var data = new Uint8ClampedArray(event.data);
    buf.set(data, count);

    count += data.byteLength;
    console.log('count: ' + count);

    if (count === buf.byteLength) {
// we're done: all data chunks have been received
console.log('Done. Rendering photo.');
renderPhoto(buf);
}
};
}

function receiveDataFirefoxFactory() {
  var count, total, parts;

  return function onmessage(event) {
    if (typeof event.data === 'string') {
      total = parseInt(event.data);
      parts = [];
      count = 0;
      console.log('Expecting a total of ' + total + ' bytes');
      return;
    }

    parts.push(event.data);
    count += event.data.size;
    console.log('Got ' + event.data.size + ' byte(s), ' + (total - count) +
                ' to go.');

    if (count === total) {
      console.log('Assembling payload');
      var buf = new Uint8ClampedArray(total);
      var compose = function(i, pos) {
        var reader = new FileReader();
        reader.onload = function() {
          buf.set(new Uint8ClampedArray(this.result), pos);
          if (i + 1 === parts.length) {
            console.log('Done. Rendering photo.');
            renderPhoto(buf);
          } else {
            compose(i + 1, pos + this.result.byteLength);
          }
        };
        reader.readAsArrayBuffer(parts[i]);
      };
      compose(0, 0);
    }
  };
}


/****************************************************************************
* Aux functions, mostly UI-related
****************************************************************************/

function snapPhoto() {
  photoContext.drawImage(video, 0, 0, photo.width, photo.height);
  show(photo, sendBtn);
}

function sendPhoto() {
// Split data channel message in chunks of this byte length.
var CHUNK_LEN = 64000;
console.log('width and height ', photoContextW, photoContextH);
var img = photoContext.getImageData(0, 0, photoContextW, photoContextH),
len = img.data.byteLength,
n = len / CHUNK_LEN | 0;


console.log('Sending a total of ' + len + ' byte(s)');
dataChannel.send(len);
socket.emit('store image', photo.toDataURL());

// split the photo and send in chunks of about 64KB
for (var i = 0; i < n; i++) {
  var start = i * CHUNK_LEN,
  end = (i + 1) * CHUNK_LEN;
  console.log(start + ' - ' + (end - 1));
  dataChannel.send(img.data.subarray(start, end));
}

// send the reminder, if any
if (len % CHUNK_LEN) {
  console.log('last ' + len % CHUNK_LEN + ' byte(s)');
  dataChannel.send(img.data.subarray(n * CHUNK_LEN));
}
}

function snapAndSend() {
  snapPhoto();
  sendPhoto();
}

function renderPhoto(data) {
  var canvas = document.createElement('canvas');
  canvas.width = photoContextW;
  canvas.height = photoContextH;
  canvas.classList.add('incomingPhoto');
  // trail is the element holding the incoming images
  trail.insertBefore(canvas, trail.firstChild);

  var context = canvas.getContext('2d');
  var img = context.createImageData(photoContextW, photoContextH);
  img.data.set(data);
  context.putImageData(img, 0, 0);
}

function show() {
  Array.prototype.forEach.call(arguments, function(elem) {
    elem.style.display = null;
  });
}

function hide() {
  Array.prototype.forEach.call(arguments, function(elem) {
    elem.style.display = 'none';
  });
}

function randomToken() {
  return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}

function logError(err) {
  console.log(err.toString(), err);
}

