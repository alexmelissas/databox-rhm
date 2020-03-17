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

    var userIP;
    var relaySessionKey;
    
    //TODO: initial checks eg if already registered etc - stuff
    // eg. if have a peerSessionKey in my datastore means i have connection so skip establish

    // WHAT HAPPENS IF ONE DISCONNECTS AFTER SENDING ITS DATA??????

    //Use TURN daemon on relay to discover my public IP
    await discoverIP().then(function(result){userIP = result});
        
    //Save my IP to userPreferences datastore

    //Establish shared session key with ECDH and HKDF
    await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});

    await firstAttemptEstablish(userIP, relaySessionKey).then(function(result){
        if(result==0) console.log('Match found, error in key establishment.');
        else if (result == 1) console.log('No match found.');
        else console.log(result);
    }).catch((err) => { console.log("Error in establishment", err) });

});

socket.setEncoding('utf8');

socket.on('end', (data) => {
  console.log('Session Closed, server said:',data);
});
/****************************************************************************
* Cryptography Helpers etc
****************************************************************************/
// Send random HR data to relay
function sendData(){
  return new Promise(async (resolve,reject) => {
    //TODO: TTL

    const value = 120;
    const datetime = '03/03/2020 | 23:42';
    const type = 'HR';

    // END-TO-END ENCRYPTION
    var datajson = JSON.stringify({type: type, datetime: datetime, value: value});
    var datajson2 = JSON.stringify({type: 'BP', datetime: '05/03/2020 | 12:32', value: 'high'});

    if(peerSessionKey==null) reject();
    var encrypted_datajson = h.encryptBuffer(datajson,peerSessionKey);
    var encrypted_datajson2 = h.encryptBuffer(datajson2,peerSessionKey);
    console.log("Encrypted:",encrypted_datajson,"with key:",peerSessionKey.toString('hex'));
    
    await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});
    var encrypted_PIN = h.encrypt(userPIN,relaySessionKey);
    request.post(SERVER_URI+'store')
    .json({ pin : encrypted_PIN, data: encrypted_datajson})
    .on('data', async function(data) {
      console.log("Sent 1");
      request.post(SERVER_URI+'store')
      .json({ pin : encrypted_PIN, data: encrypted_datajson2})
      .on('data', async function(data) {
        console.log("Sent 2");
        resolve();
      });
    });

  });
}

// First attempt to find match
async function firstAttemptEstablish(userIP, relaySessionKey){
    return new Promise((resolve,reject)=>{
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
                if(data != 'AWAITMATCH'){ //horrible idea for error handling
                    var res = JSON.parse(data);
                    var match_pin = h.decrypt(Buffer.from(res.pin), relaySessionKey);
                    var match_ip = h.decrypt(Buffer.from(res.ip), relaySessionKey);
                    var match_pbk = h.decrypt(Buffer.from(res.pbk), relaySessionKey);
                    console.log("[<-] Received match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
                    await h.establishPeerSessionKey(ecdh, match_pbk).then(async function(result){
                        if(result == 0) resolve(0);
                        else { await sendData(); resolve(result);}
                        //await savePSK(match_pin,result);
                    });
                } 
                // Recursive function repeating 5 times every 5 secs, to check if a match has appeared
                else {
                    console.log("No match found. POSTing to await for match");
                    await attemptMatch(ecdh, publickey, userType,userPIN,targetPIN).then(async function(result){
                        if(result!=null) await sendData().then(function (result){
                                resolve(result);
                            });
                        else resolve(1);
                    });
                }
                });
        } else { 
            console.log("Relay Session Key establishment failure."); 
        }
    });
    
}

// Search on relay for a match to connect to x times x time
async function attemptMatch (ecdh, publickey, userType,userPIN,targetPIN) {
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
                return new Promise(async(resolve,reject)=>{
                    var res = JSON.parse(data);
                    var match_pin = h.decrypt(Buffer.from(res.pin), relaySessionKey);
                    var match_ip = h.decrypt(Buffer.from(res.ip), relaySessionKey);
                    var match_pbk = h.decrypt(Buffer.from(res.pbk), relaySessionKey);
                    console.log("[<-] Received match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
                    await h.establishPeerSessionKey(ecdh, match_pbk).then(function(result){
                        //await savePSK(match_pin,result);
                        request.post(SERVER_URI+'deleteSessionInfo').json({pin : encrypted_PIN});
                        attempts=0;
                        resolve(result);
                    });
                });
            }
            //timeout - delete for cleanliness
            else if(attempts==1){
                return new Promise(async(resolve,reject)=> {
                    attempts = 0;
                    await h.establishRelaySessionKey(ecdh, publickey).then(function(relaySessionKey){
                        encrypted_PIN = h.encrypt(userPIN,relaySessionKey);
                        request.post(SERVER_URI+'deleteSessionInfo').json({pin : encrypted_PIN});
                        resolve(null);
                    });
                });
            }   
        });
    }
    if(attempts>0) attemptMatch(ecdh, publickey, userType,userPIN,targetPIN,attempts,msDelay);
    }, msDelay);
}

//Save peerPIN and PSK to datastore
// function savePSK(peerID, peerSessionKey){
//     return new Promise((resolve, reject) => {
//         store.KV.Write(userPreferences.DataSourceID, "peerSession",
//                 { peerID: peerID, peerSessionKey: peerSessionKey }).then(() => {
//             console.log("Updated Peer Session Data");
//             resolve(0);
//         }).catch((err) => {
//             console.log("PSK write failed", err);
//             reject(err);
//         });
//     });
// }

function discoverIP(){
    return new Promise((resolve,reject)=>{
        stun.request("turn:"+TURN_USER+"@"+SERVER_IP, async (err, res) => {
            if (err) {
                console.error(err);
                reject(err);
            } else {
                const { address } = res.getXorAddress();
                resolve(address);
            }
        });
    });
}