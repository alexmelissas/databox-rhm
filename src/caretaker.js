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
const SERVER_IP = '35.177.86.42';
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
const userType = 'caretaker';
const userPIN = '5678';
const targetPIN = '1234';

// Create my side of the ECDH
const ecdh = crypto.createECDH('Oakley-EC2N-3');
const publickey = ecdh.generateKeys();

var relaySessionKey;
var peerSessionKey;

var msDelay = 5000;
var attempts = 6;
/****************************************************************************
* TLS & ECDH
****************************************************************************/
var socket = tls.connect(TLS_PORT, SERVER_IP, tlsConfig, async () => {
  console.log('TLS connection established and ', socket.authorized ? 'authorized' : 'unauthorized');

  //TODO: initial checks eg if already registered etc - stuff
  // eg. if have a peerSessionKey in my datastore means i have connection so skip establish


  // WHAT HAPPENS IF ONE DISCONNECTS AFTER SENDING ITS DATA??????

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
        var encrypted_userType = encrypt(userType,relaySessionKey);
        var encrypted_PIN = encrypt(userPIN,relaySessionKey);
        var encrypted_target_PIN = encrypt(targetPIN,relaySessionKey);
        var encrypted_ip = encrypt(userIP,relaySessionKey);
        var encrypted_public_key = encrypt(publickey.toString('hex'),relaySessionKey);

        console.log('PublicKey:',publickey.toString('hex'));
        console.log('Encrypted PublicKey:',encrypted_public_key.toString('hex'));

        request.post(SERVER_URI+'register')
        .json({ type: encrypted_userType, pin : encrypted_PIN, targetpin: encrypted_target_PIN,
           publickey: encrypted_public_key, ip: encrypted_ip })
        .on('data', async function(data) {
          if(data != 'AWAITMATCH'){ //horrible idea for error handling

            var res = JSON.parse(data);
            var match_pin = decrypt(Buffer.from(res.pin), relaySessionKey);
            var match_ip = decrypt(Buffer.from(res.ip), relaySessionKey);
            var match_pbk = decrypt(Buffer.from(res.pbk), relaySessionKey);
            console.log("[<-] Received match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
            await establishPeerSessionKey(match_pbk);
////////////////////forced shit for testing
            requestData(6);
          } 
          // Recursive function repeating 5 times every 5 secs, to check if a match has appeared
          else {
            console.log("No match found. POSTing to await for match");
            attemptMatch(userType,userPIN,targetPIN);
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
function decrypt(data, key) {
  var decipher = crypto.createDecipher('aes-256-cbc', key);
  //decipher.setAutoPadding(false);
  var decrypted_data = decipher.update(data,'hex','utf8');
  decrypted_data += decipher.final('utf8');
  return decrypted_data;
}
function decryptBuffer(data, key){
  var decipher = crypto.createDecipher('aes-256-cbc',key);
  var decrypted_data = Buffer.concat([decipher.update(data) , decipher.final()]);
  return decrypted_data;
}

function encryptBuffer(data, key) {
  var cipher = crypto.createCipher('aes-256-cbc', key);
  var encrypted_data = cipher.update(data,'utf8','hex');
  encrypted_data += cipher.final('hex');
  return encrypted_data;
}
function encrypt(data, key) {
  var cipher = crypto.createCipher('aes-256-cbc',key);
  var encrypted_data = Buffer.concat([cipher.update(data),cipher.final()]);
  return encrypted_data;
}
/****************************************************************************
* Cryptography Helpers etc
****************************************************************************/
// Establish ECDH-HKDF session key with relay
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

// Establish ECDH-HKDF session key with the matched peer
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

// Simple check if passed data is JSON
function isJSON(data) {
  try { var testobject = JSON.parse(data); } catch (err) { return false; } return true;
}

// Search on relay for a match to connect to x times x time
function attemptMatch(userType,userPIN,targetPIN) {
  setTimeout(async function () {
    attempts--;
    if(attempts>0){
      console.log("Re-attempting,",attempts,"attempts remaining.");
      await establishRelaySessionKey();
      var encrypted_userType = encrypt(userType,relaySessionKey); // MAYBE USE TRY HERE
      var encrypted_PIN = encrypt(userPIN,relaySessionKey);
      var encrypted_target_PIN = encrypt(targetPIN,relaySessionKey);
      
      request.post(SERVER_URI+'awaitMatch')
      .json({ type: encrypted_userType, pin : encrypted_PIN, targetpin: encrypted_target_PIN })
      .on('data', async function(data) {
        if(isJSON(data)){
          var res = JSON.parse(data);
          var match_pin = decrypt(Buffer.from(res.pin), relaySessionKey);
          var match_ip = decrypt(Buffer.from(res.ip), relaySessionKey);
          var match_pbk = decrypt(Buffer.from(res.pbk), relaySessionKey);
          console.log("[<-] Received match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
          await establishPeerSessionKey(match_pbk);
          request.post(SERVER_URI+'deleteSessionInfo').json({pin : encrypted_PIN});
          attempts=0;
////////////////////forced shit for testing
          requestData(6);
        }
        //timeout - delete for cleanliness
        else if(attempts==1){
          attempts = 0;
          await establishRelaySessionKey();
          encrypted_PIN = encrypt(userPIN,relaySessionKey);
          request.post(SERVER_URI+'deleteSessionInfo').json({pin : encrypted_PIN});
        }
      });
    }
    if(attempts>0) attemptMatch(userType,userPIN,targetPIN,attempts,msDelay);
  }, msDelay);
}

// Ping relay for new data?
function requestData(attempts){
  console.log("Hey yall");
  setTimeout(async function () {
    if(attempts>0) {
      if(attempts!=6) await pingServerForData();
      attempts--;
      requestData(attempts);
    }
  }, msDelay); 
}

function pingServerForData(){
  return new Promise(async (resolve,reject) => {
    if(peerSessionKey==null) reject();

    await establishRelaySessionKey();
    var encrypted_PIN = encrypt(targetPIN,relaySessionKey);

    console.log("Pinging server");

    request.post(SERVER_URI+'retrieve')
    .json({ pin : encrypted_PIN})
    .on('data', function(meeps) {
      
      var omg = [];
      var meep = JSON.parse(meeps);
      meep.forEach(entry => {
        var dwb = decrypt(Buffer.from(entry),relaySessionKey);
        var decryptedEntry = dwb.substring(1, dwb.length-1);
        console.log("Meep entry:",decryptedEntry);
        omg.push(decryptedEntry);
      });

      //var data = decrypt(Buffer.from(meep),relaySessionKey);
      //console.log("Raw data:",data);

      // var happiness = JSON.parse(hooker);
      // console.log("Receive happiness:",happiness);

      omg.forEach(entry =>{
        console.log("Entry:",entry);
        var decrypted_entry = decrypt(entry,peerSessionKey);
        var json_entry = JSON.parse(decrypted_entry);        
        console.log("[*] New entry from patient: ",json_entry);
      });

      resolve();
    });
  });
}