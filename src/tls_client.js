'use strict';

//hacky way to circumvent self-signed certificate on the server
//should consider what happens w/ security
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
///////////////////////////////////////////////////////////////

/****************************************************************************
* Imports
****************************************************************************/
const tls = require('tls');
const fs = require('fs');
const request = require('request');
const https = require('https');
const stun = require('stun');
const crypto = require('crypto');
const assert = require('assert');
const HKDF = require('hkdf');

/****************************************************************************
* Server Settings
****************************************************************************/
const SERVER_IP = '35.177.14.11';
const TLS_PORT = 8000;
const SERVER_URI = "https://"+SERVER_IP+":"+TLS_PORT+"/";
const TURN_USER = 'alex';
const TURN_CRED = 'donthackmepls';

const tlsConfig = {
    ca: [ fs.readFileSync('client.crt') ]
  };

var configuration = {"iceServers": [
    {"url": "stun:stun.l.google.com:19302"},
    {"url":"turn:"+TURN_USER+"@"+SERVER_IP, "credential":TURN_CRED}
  ]};


/****************************************************************************
* User Preferences
****************************************************************************/
const userType = 'patient';
const userPIN = '1234';
const targetPIN = '5678';

// Create my side of the ECDH
const ecdh = crypto.createECDH('Oakley-EC2N-3');
const publickey = ecdh.generateKeys();

var relaySessionKey;
var peerSessionKey;
/****************************************************************************
* TLS & ECDH
****************************************************************************/
var socket = tls.connect(TLS_PORT, SERVER_IP, tlsConfig, async () => {
  console.log('TLS connection established and ', socket.authorized ? 'authorized' : 'unauthorized');

  //TODO: initial checks eg if already registered etc - stuff
  // eg. if have a peerSessionKey in my datastore means i have connection so skip establish

  // Use TURN daemon of relay server to learn my own public IP
  stun.request("turn:"+TURN_USER+"@"+SERVER_IP, async (err, res) => {
    if (err) {
      console.error(err);
    } else {
      const { address } = res.getXorAddress();
      const userIP = address;

      //Establish shared session key with ECDH and HKDF
      await establishRelaySessionKey();

      if(relaySessionKey!=null){
        // Encrypt my details
        var encrypted_userType = encryptString('aes-256-cbc',relaySessionKey,userType);
        var encrypted_PIN = encryptString('aes-256-cbc',relaySessionKey,userPIN);
        var encrypted_target_PIN = encryptString('aes-256-cbc',relaySessionKey,targetPIN);
        var encrypted_ip = encryptString('aes-256-cbc',relaySessionKey,userIP);
        var encrypted_public_key = encryptString('aes-256-cbc',relaySessionKey,publickey.toString('hex'));

        console.log('PublicKey:',publickey.toString('hex'));
        console.log('Encrypted PublicKey:',encrypted_public_key.toString('hex'));

        request.post(SERVER_URI+'register')
        .json({ type: encrypted_userType, pin : encrypted_PIN, targetpin: encrypted_target_PIN,
           publickey: encrypted_public_key, ip: encrypted_ip })
        .on('data', async function(data) {
          if(data != 'AWAITMATCH'){ //horrible idea for error handling

            var res = JSON.parse(data);
            var match_pin = decryptString('aes-256-cbc', relaySessionKey, Buffer.from(res.pin));
            var match_ip = decryptString('aes-256-cbc', relaySessionKey, Buffer.from(res.ip));
            var match_pbk = decryptString('aes-256-cbc', relaySessionKey, Buffer.from(res.pbk));
            console.log("[<-] Received match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
            await establishPeerSessionKey(match_pbk);

          } else {
            console.log("No match found. POSTing to await for match");
            await establishRelaySessionKey();
            request.post(SERVER_URI+'awaitMatch')
            .json({pin: relaySessionKey})
            .on('data', async function(data) {

              var res = JSON.parse(data);
              var match_pin = decryptString('aes-256-cbc', relaySessionKey, Buffer.from(res.pin));
              var match_ip = decryptString('aes-256-cbc', relaySessionKey, Buffer.from(res.ip));
              var match_pbk = decryptString('aes-256-cbc', relaySessionKey, Buffer.from(res.pbk));
              console.log("[<-] Received match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
              await establishPeerSessionKey(match_pbk);

            });
          }
        });
      } else{ console.log("Relay Session Key establishment failure."); }

    }
  });
});

socket.setEncoding('utf8');

socket.on('end', (data) => {
  console.log('Session Closed, server said:',data);
});

/****************************************************************************
* Encrypt / Decrypt
****************************************************************************/
//based on https://lollyrock.com/posts/nodejs-encryption/
function decryptString(algorithm, key, data) {
  var decipher = crypto.createDecipher(algorithm, key);
  //decipher.setAutoPadding(false);
  var decrypted_data = decipher.update(data,'hex','utf8');
  decrypted_data += decipher.final('utf8');
  return decrypted_data;
}
function decryptBuffer(algorithm, key, data){
  var decipher = crypto.createDecipher(algorithm,key);
  var decrypted_data = Buffer.concat([decipher.update(data) , decipher.final()]);
  return decrypted_data;
}

function encryptBuffer(algorithm, key, data) {
  var cipher = crypto.createCipher(algorithm, key);
  var encrypted_data = cipher.update(data,'utf8','hex');
  encrypted_data += cipher.final('hex');
  return encrypted_data;
}
function encryptString(algorithm, key, data) {
  var cipher = crypto.createCipher(algorithm,key);
  var encrypted_data = Buffer.concat([cipher.update(data),cipher.final()]);
  return encrypted_data;
}

function establishRelaySessionKey() {
  return new Promise((resolve,reject) => {
    // Initiate the ECDH process with the relay server
    request.post(SERVER_URI+'establishSessionKey')
    .json({publickey: publickey})
    .on('data', function(bobKey) {

      // Use ECDH to establish sharedSecret
      const sharedSecret = ecdh.computeSecret(bobKey);
      var hkdf = new HKDF('sha256', 'saltysalt', sharedSecret);

      // Derive relaySessionKey with HKDF based on sharedSecret
      hkdf.derive('info', 4, function(key) {
        if(key!=null){
          console.log('Relay Session Key: ',key.toString('hex'));
          relaySessionKey = key;
          resolve();
        } else {
          console.log("Key establishment error");
          reject();
        }
      });
    });
  });
}

function establishPeerSessionKey(peerPublicKey) {
  return new Promise((resolve,reject) => {

    // Use ECDH to establish sharedSecret
    const sharedSecret = ecdh.computeSecret(Buffer.from(peerPublicKey.toString('hex'),'hex'));

    var hkdf = new HKDF('sha256', 'saltysalt', sharedSecret);
    // Derive peerSessionKey with HKDF based on sharedSecret
    hkdf.derive('info', 4, function(key) {
      if(key!=null){
        console.log('Peer Session Key: ',key.toString('hex'));
        peerSessionKey = key;
        resolve();
      } else {
        console.log("Key establishment error");
        reject();
      }
    });

  });
}

// async function handleMatchFound(data){
//   return new Promise((resolve,reject) => {
//     // If client reads and validates my IP, it sends back an encrypted pokemon that we decrypt and show
//     request.get(SERVER_URI+'pikachu')
//     .on('data', function(data) {
//       //var pikachu = decryptString('aes-256-cbc',relaySessionKey,data);
//       //process.stdout.write(pikachu);
//       process.stdout.write(data);
//     });
//     resolve();
//   });
// }