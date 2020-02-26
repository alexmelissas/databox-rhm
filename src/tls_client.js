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

const crypto = require('crypto');
const assert = require('assert');
const HKDF = require('hkdf');

const userType = 'patient';
const userPIN = '1234';
const targetPIN = '5678';

const SERVER_IP = '18.130.115.38';
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

var sessionKey;
/****************************************************************************
* TLS & ECDH
****************************************************************************/
var socket = tls.connect(TLS_PORT, SERVER_IP, tlsConfig, async () => {
  console.log('TLS connection established and ', socket.authorized ? 'authorized' : 'unauthorized');

  //TODO: initial checks eg if already registered etc - stuff

  // Use TURN daemon of relay server to learn my own public IP
  stun.request("turn:"+TURN_USER+"@"+SERVER_IP, (err, res) => {
    if (err) {
      console.error(err);
    } else {
      const { address } = res.getXorAddress();
      const userIP = address;

      //Establish shared session key with ECDH and HKDF
      await establishSessionKey();

      if(sessionKey!=null){
        // Encrypt my IP and data
        var encrypted_userType = encryptString('aes-256-cbc',sessionKey,userType);
        var encrypted_PIN = encryptString('aes-256-cbc',sessionKey,userPIN);
        var encrypted_target_PIN = encryptString('aes-256-cbc',sessionKey,targetPIN);
        var encrypted_ip = encryptString('aes-256-cbc',sessionKey,userIP);

        // Send my encrypted IP and data to other guy
        request.post(SERVER_URI+'clientInfo')
        .json({ type: encrypted_userType, pin : encrypted_PIN, targetpin: encrypted_target_PIN, ip: encrypted_ip })
        .on('data', function(data) {
          // If client reads and validates my IP, it sends back an encrypted pokemon that we decrypt and show
          if(data == 'OK'){
            request.get(SERVER_URI+'pikachu')
            .on('data', function(data) {
              var charizard = decryptString('aes-256-cbc',sessionKey,data);
              process.stdout.write(charizard);
            });
          } else{ console.log("Error with server receiving this IP"); }
        });
      } else{ console.log("Key establishment failure."); }

    }
  });
});

socket.setEncoding('utf8');

socket.on('end', () => {
  console.log('Session Closed')
});

/****************************************************************************
* Encrypt / Decrypt
****************************************************************************/
//based on https://lollyrock.com/posts/nodejs-encryption/
function decryptString(algorithm, key, data) {
  var decipher = crypto.createDecipher(algorithm, key)
  var decrypted_data = decipher.update(data,'hex','utf8')
  decrypted_data += decipher.final('utf8');
  return decrypted_data;
}
function decryptBuffer(algorithm, key, data){
  var decipher = crypto.createDecipher(algorithm,key);
  var decrypted_data = Buffer.concat([decipher.update(data) , decipher.final()]);
  return decrypted_data;
}

function encryptString(algorithm, key, data) {
  var cipher = crypto.createCipher(algorithm, key)
  var encrypted_data = cipher.update(data,'utf8','hex')
  encrypted_data += cipher.final('hex');
  return encrypted_data;
}
function encryptString(algorithm, key, data) {
  var cipher = crypto.createCipher(algorithm,key)
  var encrypted_data = Buffer.concat([cipher.update(data),cipher.final()]);
  return encrypted_data;
}

function establishSessionKey() {
  // Create my side of the ECDH
  const alice = crypto.createECDH('Oakley-EC2N-3');
  const aliceKey = alice.generateKeys();
  return new Promise(resolve,reject => {

  // Initiate the ECDH process with the relay server
  request.post(SERVER_URI+'establishSessionKey')
  .json({alicekey: aliceKey})
  .on('data', function(bobKey) {

    // Use ECDH to establish sharedSecret
    const aliceSecret = alice.computeSecret(bobKey);
    var hkdf = new HKDF('sha256', 'saltysalt', aliceSecret);

    // Derive sessionKey with HKDF based on sharedSecret
    hkdf.derive('info', 4, function(key) {
      if(key!=null){
        console.log('HKDF Session Key: ',key.toString('hex'));
        sessionKey = key;
        resolve();
      } else {
        console.log("Key establishment error");
        reject();
      }
    });
  });
  });
}