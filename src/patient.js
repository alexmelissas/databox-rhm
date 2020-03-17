'use strict';

//hacky way to circumvent self-signed certificate on the server
//should consider what happens w/ security
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
///////////////////////////////////////////////////////////////

/****************************************************************************
* Imports
****************************************************************************/
const tls = require('tls');
const request = require('request');
const stun = require('stun');
const crypto = require('crypto');

const h = require('./helpers');
/****************************************************************************
* Server Settings
****************************************************************************/
const SERVER_IP = h.SERVER_IP;
const TLS_PORT = h.TLS_PORT;
const SERVER_URI = h.SERVER_URI;
const TURN_USER = h.TURN_USER;
const TURN_CRED = h.TURN_CRED;
const tlsConfig = h.tlsConfig;

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

var msDelay = 2000;
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
      await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});

      if(relaySessionKey!=null){
        // Encrypt my details
        var encrypted_userType = h.encrypt(userType,relaySessionKey);
        var encrypted_PIN = h.encrypt(userPIN,relaySessionKey);
        var encrypted_target_PIN = h.encrypt(targetPIN,relaySessionKey);
        var encrypted_ip = h.encrypt(userIP,relaySessionKey);
        var encrypted_public_key = h.encrypt(publickey.toString('hex'),relaySessionKey);

        console.log('PublicKey:',publickey.toString('hex'));
        console.log('Encrypted PublicKey:',encrypted_public_key.toString('hex'));

        request.post(SERVER_URI+'register')
        .json({ type: encrypted_userType, pin : encrypted_PIN, targetpin: encrypted_target_PIN,
           publickey: encrypted_public_key, ip: encrypted_ip })
        .on('data', async function(data) {
          if(data == "RSK Concurrency Error"){
            console.log("[!] Relay Session Key establishment failure. Can't establish secure connection.");
          }
          else if(data != 'AWAITMATCH'){ //horrible idea for error handling

            var res = JSON.parse(data);
            var match_pin = h.decrypt(Buffer.from(res.pin), relaySessionKey);
            var match_ip = h.decrypt(Buffer.from(res.ip), relaySessionKey);
            var match_pbk = h.decrypt(Buffer.from(res.pbk), relaySessionKey);
            console.log("[<-] Received match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
            await h.establishPeerSessionKey(ecdh, match_pbk).then(function(result){peerSessionKey=result;});
////////////////////forced shit for testing
            await sendData().then(function(result){console.log(result);});
          } 
          // Recursive function repeating 5 times every 5 secs, to check if a match has appeared
          else {
            console.log("No match found. POSTing to await for match");
            attemptMatch(ecdh, publickey, userType,userPIN,targetPIN);
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

// Search on relay for a match to connect to x times x time
function attemptMatch (ecdh, publickey, userType,userPIN,targetPIN) {
  setTimeout(async function () {
  attempts--;
  if(attempts>0){
      console.log("Re-attempting,",attempts,"attempts remaining.");
      await h.establishRelaySessionKey(ecdh, publickey).then(function(result){
          relaySessionKey=result;
      });
      var encrypted_userType = h.encrypt(userType,relaySessionKey); // MAYBE USE TRY HERE
      var encrypted_PIN = h.encrypt(userPIN,relaySessionKey);
      var encrypted_target_PIN = h.encrypt(targetPIN,relaySessionKey);
  
      request.post(SERVER_URI+'awaitMatch')
      .json({ type: encrypted_userType, pin : encrypted_PIN, targetpin: encrypted_target_PIN })
      .on('data', async function(data) {
      if(h.isJSON(data)){
          var res = JSON.parse(data);
          var match_pin = h.decrypt(Buffer.from(res.pin), relaySessionKey);
          var match_ip = h.decrypt(Buffer.from(res.ip), relaySessionKey);
          var match_pbk = h.decrypt(Buffer.from(res.pbk), relaySessionKey);
          console.log("[<-] Received match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
          await h.establishPeerSessionKey(ecdh, match_pbk).then(function(result){peerSessionKey=result;});
          request.post(SERVER_URI+'deleteSessionInfo').json({pin : encrypted_PIN});
////////////////////forced shit for testing
          await sendData().then(function(result){console.log(result);});
          attempts=0;
      }
      else if(data == "RSK Concurrency Error"){
        console.log("Relay Session Key establishment failure. No attempt removed.");
        attempts++;
      }
      //timeout - delete for cleanliness
      else if(attempts==1){
          attempts = 0;
          await h.establishRelaySessionKey(ecdh, publickey).then(function(result){
            relaySessionKey=result;
          });
          encrypted_PIN = h.encrypt(userPIN,relaySessionKey);
          request.post(SERVER_URI+'deleteSessionInfo').json({pin : encrypted_PIN});
      }
      });
  }
  if(attempts>0) attemptMatch(ecdh, publickey, userType,userPIN,targetPIN,attempts,msDelay);
  }, msDelay);
}
/****************************************************************************
* Cryptography Helpers etc
****************************************************************************/
// Send random HR data to relay
async function sendData(){
  return new Promise(async (resolve,reject) => {
    await attemptSendData().then(function(result){
      switch(result){
        case "Success": resolve("Success"); break;
        case "PSK err": resolve("No PSK!"); break;
        case "RSK err": resolve("Relay Session Key establishment failure. Try again"); break;
      }
    });
  });
}

function attemptSendData(){
  return new Promise(async (resolve,reject) => {
    
    //TODO: TTL

    // END-TO-END ENCRYPTION
    var datajson = JSON.stringify({type: 'HR', datetime: dateTime(), value: 120});
    var datajson2 = JSON.stringify({type: 'BP', datetime: dateTime(), value: 'high'});

    if(peerSessionKey==null) resolve("PSK err");

    var encrypted_datajson = h.encryptBuffer(datajson,peerSessionKey);
    var encrypted_datajson2 = h.encryptBuffer(datajson2,peerSessionKey);
    console.log("Encrypted:",encrypted_datajson,"with key:",peerSessionKey.toString('hex'));

    //CHECKSUMS FOR INTEGRITY
    var checksum = crypto.createHash('sha256').update(peerSessionKey+encrypted_datajson).digest('hex');
    var checksum2 = crypto.createHash('sha256').update(peerSessionKey+encrypted_datajson2).digest('hex');
    console.log("Checksum:",checksum);
    
    await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});
    var encrypted_PIN = h.encrypt(userPIN,relaySessionKey);
    request.post(SERVER_URI+'store')
    .json({ pin : encrypted_PIN, checksum: checksum, data: encrypted_datajson})
    .on('data', function(data) {

      if(data == "RSK Concurrency Error"){
        console.log("Relay Session Key establishment failure.");
        resolve("RSK err");
        return;
      }

      console.log("Sent 1");
      request.post(SERVER_URI+'store')
      .json({ pin : encrypted_PIN, checksum: checksum2, data: encrypted_datajson2})
      .on('data', async function(data) {

        if(data == "RSK Concurrency Error"){
          console.log("Relay Session Key establishment failure.");
          resolve("RSK err");
          return;
        }

        console.log("Sent 2");
        // FOR TESTING THE SCIPTS
        process.exit();
        resolve("Success");
      });
    });
  });
}

//https://stackoverflow.com/questions/24738169/how-can-i-get-the-current-datetime-in-the-format-2014-04-01080000-in-node
function dateTime() {
  const date = new Date();

  return date.getDate().toString().padStart(2, '0') + '/' +
      (date.getMonth() + 1).toString().padStart(2, '0') + '/' +
      date.getFullYear() + ' | ' +
      date.getHours().toString().padStart(2, '0') + ':' +
      date.getMinutes().toString().padStart(2, '0') + ':' +
      date.getSeconds().toString().padStart(2, '0');
}