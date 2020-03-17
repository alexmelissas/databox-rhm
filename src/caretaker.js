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
const userType = 'caretaker';
const userPIN = '5678';
const targetPIN = '1234';

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
            requestData(6);
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
          requestData(6);
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

socket.setEncoding('utf8');

socket.on('end', (data) => {
  console.log('Session Closed, server said:',data);
});
/****************************************************************************
* Cryptography Helpers etc
****************************************************************************/
// Ping relay for new data?
function requestData(attempts){
  setTimeout(async function() {
    if(attempts>0) {
      if(attempts!=6){
        console.log('Looking for new data',attempts,'attempts remaining.');
        await pingServerForData().then(function(result){
          switch(result){
            case "Empty": break;
            case "Success": attempts = 0; break;
            case "PSK err": console.log("No PSK!"); attempts = 0; break;
            case "RSK err": console.log("Relay Session Key establishment failure. No attempt removed."); attempts++; break;
            case "Checksum err": console.log("Checksum verification failed. YEETing this entry"); break;
          }
        });
      }
      attempts--;
      requestData(attempts);
    }
  }, 1000); 
}

function pingServerForData(){
  return new Promise(async (resolve,reject) => {
      var relaySessionKey;
      await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});
      var encrypted_PIN = h.encrypt(targetPIN,relaySessionKey);

      request.post(SERVER_URI+'retrieve')
      .json({ pin : encrypted_PIN})
      .on('data', function(data) {
          if(data == "RSK Concurrency Error") resolve("RSK err");
          var arr = JSON.parse(data);
          arr.forEach(entry =>{
              if (entry=='EOF') { resolve("Empty"); }
              else {
                  //console.log("Entry:",entry);
                  var checksum = entry.checksum;
                  //var fakeTestChecksum = 'ecf864c75c4341900b7db1cee8c2c388248b0d9f05e0b026d9e1becd0bd94b7c';
                  var encrypted_data = entry.data;

                  // *** CHECKSUM VERIFICATION
                  var verification = crypto.createHash('sha256').update(encrypted_data).digest('hex');
                  if(verification == checksum){
                      // *** END-TO-END ENCRYPTION
                      //console.log("Trying to decrypt:",encrypted_data,"with key:",peerSessionKey.toString('hex'));

                      // TRY TO DECRYPT, IF BAD DECRYPT NEED TO UPDATE THE PSK!
                      try {
                        var decrypted_data = h.decrypt(encrypted_data,peerSessionKey);
                      } catch(err){
                        console.log("[!] Outdated entries with old PSK detected. These will be deleted next run. Skipping for now...");
                        return;
                      }
                      var json_data = JSON.parse(decrypted_data);
                      // SAVE IT
                      console.log("[*] New entry from patient: ",json_data);
                  }
                  else {
                      resolve("Checksum err");
                  }
              }
          });
          resolve("Success");
          process.exit();
      });
  });
}

