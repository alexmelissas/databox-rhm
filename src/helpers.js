const crypto = require('crypto');
const fs = require('fs');
const HKDF = require('hkdf');
const request = require('request');

const SERVER_IP = '52.56.59.110';
const TLS_PORT = 8000;
const SERVER_URI = "https://"+SERVER_IP+":"+TLS_PORT+"/";
const TURN_USER = 'alex';
const TURN_CRED = 'donthackmepls';
const tlsConfig = {
    ca: [ fs.readFileSync('client.crt') ]
  };
  
var relaySessionKey;

module.exports = {

    relaySessionKey : relaySessionKey,
    /****************************************************************************
    * Server Constants
    ****************************************************************************/
    SERVER_IP: SERVER_IP,
    TLS_PORT: TLS_PORT,
    SERVER_URI: SERVER_URI,
    TURN_USER: TURN_USER,
    TURN_CRED: TURN_CRED,
    tlsConfig: tlsConfig,

    /****************************************************************************
    * Encrypt / Decrypt
    ****************************************************************************/

    //based on https://lollyrock.com/posts/nodejs-encryption/
    decrypt: function (data, key) {
        var decipher = crypto.createDecipher('aes-256-cbc', key);
        //decipher.setAutoPadding(false);
        var decrypted_data = decipher.update(data,'hex','utf8');
        decrypted_data += decipher.final('utf8');
        return decrypted_data;
    },

    decryptBuffer: function (data, key){
        var decipher = crypto.createDecipher('aes-256-cbc',key);
        var decrypted_data = Buffer.concat([decipher.update(data) , decipher.final()]);
        return decrypted_data;
    },

    encryptBuffer: function (data, key) {
        var cipher = crypto.createCipher('aes-256-cbc', key);
        var encrypted_data = cipher.update(data,'utf8','hex');
        encrypted_data += cipher.final('hex');
        return encrypted_data;
    },

    encrypt: function (data, key) {
        var cipher = crypto.createCipher('aes-256-cbc',key);
        var encrypted_data = Buffer.concat([cipher.update(data),cipher.final()]);
        return encrypted_data;
    },

    // Simple check if passed data is JSON
    isJSON: function (data) {
        try { var testobject = JSON.parse(data); } catch (err) { return false; } return true;
    },

    /****************************************************************************
    * Secure end-to-end key Establishment
    ****************************************************************************/

    // Establish ECDH-HKDF session key with relay
    establishRelaySessionKey: function (ecdh, publickey) {
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
                resolve(key);
            } else {
                console.log("Key establishment error");
                reject("Key establishment error");
            }
            });
        });
        });
    },
    
    // Establish ECDH-HKDF session key with the matched peer
    establishPeerSessionKey: function (ecdh, peerPublicKey) {
        return new Promise((resolve,reject) => {
    
        // Use ECDH to establish sharedSecret
        const sharedSecret = ecdh.computeSecret(Buffer.from(peerPublicKey.toString('hex'),'hex'));
    
        var hkdf = new HKDF('sha256', 'saltysalt', sharedSecret);
        // Derive peerSessionKey with HKDF based on sharedSecret
        hkdf.derive('info', 4, function(key) {
            if(key!=null){
                console.log('Peer Session Key: ',key.toString('hex'));
                peerSessionKey = key;
                resolve(key);
            } else {
                console.log("Key establishment error");
                resolve(0);
            }
        });
    
        });
    }//,

    // Search on relay for a match to connect to x times x time
    // attemptMatch: function (ecdh, publickey, userType,userPIN,targetPIN) {
        
    //     setTimeout(async function () {
    //     attempts--;
    //     if(attempts>0){
    //         console.log("Re-attempting,",attempts,"attempts remaining.");
    //         await module.exports.establishRelaySessionKey(ecdh, publickey).then(function(result){
    //             module.exports.relaySessionKey=result;
    //         });
    //         var encrypted_userType = module.exports.encrypt(userType,module.exports.relaySessionKey); // MAYBE USE TRY HERE
    //         var encrypted_PIN = module.exports.encrypt(userPIN,module.exports.relaySessionKey);
    //         var encrypted_target_PIN = module.exports.encrypt(targetPIN,module.exports.relaySessionKey);
        
    //         request.post(SERVER_URI+'awaitMatch')
    //         .json({ type: encrypted_userType, pin : encrypted_PIN, targetpin: encrypted_target_PIN })
    //         .on('data', async function(data) {
    //         if(module.exports.isJSON(data)){
    //             var res = JSON.parse(data);
    //             var match_pin = module.exports.decrypt(Buffer.from(res.pin), module.exports.relaySessionKey);
    //             var match_ip = module.exports.decrypt(Buffer.from(res.ip), module.exports.relaySessionKey);
    //             var match_pbk = module.exports.decrypt(Buffer.from(res.pbk), module.exports.relaySessionKey);
    //             console.log("[<-] Received match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
    //             var peerSessionKey;
    //             await module.exports.establishPeerSessionKey(ecdh, match_pbk).then(function(result){peerSessionKey=result;});
    //             request.post(SERVER_URI+'deleteSessionInfo').json({pin : encrypted_PIN});
    //             attempts=0;
                
    //             return peerSessionKey;
    //         }
    //         //timeout - delete for cleanliness
    //         else if(attempts==1){
    //             attempts = 0;
    //             await module.exports.establishRelaySessionKey(ecdh, publickey).then(function(result){module.exports.relaySessionKey=result;});
    //             encrypted_PIN = module.exports.encrypt(userPIN,module.exports.relaySessionKey);
    //             request.post(SERVER_URI+'deleteSessionInfo').json({pin : encrypted_PIN});
    //         }
    //         });
    //     }
    //     if(attempts>0) module.exports.attemptMatch(ecdh, publickey, userType,userPIN,targetPIN,attempts,msDelay);
    //     }, msDelay);
    // }

}