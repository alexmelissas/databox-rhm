/*--------------------------------------------------------------------------*
|   Setup
---------------------------------------------------------------------------*/
const crypto = require('crypto');
const fs = require('fs');
const HKDF = require('hkdf');
const request = require('request');

const SERVER_IP = '52.56.191.119';
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
    /*--------------------------------------------------------------------------*
    |   Server Constants
    ---------------------------------------------------------------------------*/
    SERVER_IP: SERVER_IP,
    TLS_PORT: TLS_PORT,
    SERVER_URI: SERVER_URI,
    TURN_USER: TURN_USER,
    TURN_CRED: TURN_CRED,
    tlsConfig: tlsConfig,

    /*--------------------------------------------------------------------------*
    |   Encrypt / Decrypt - Based on: https://lollyrock.com/posts/nodejs-encryption/
    ---------------------------------------------------------------------------*/
    decrypt: function (data, key) {
        var decipher = crypto.createDecipher('aes-256-cbc', key);
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

    /*--------------------------------------------------------------------------*
    |   Secure end-to-end key Establishment
    ---------------------------------------------------------------------------*/
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
    },

    /*--------------------------------------------------------------------------*
    |   Helpers
    ---------------------------------------------------------------------------*/
    // Generate a random 16-digit number to be used as a PIN
    generatePIN: function(){return Math.floor(1000000000000000 + Math.random() * 9000000000000000); },


    // Format the 16-digit number form of the PIN to a string: xxxx-xxxx-xxxx-xxxx
    pinToString: function (pin){
        output = [],
        spin = pin.toString();
        
        for (var i = 0; i < (spin.length)/4; i += 1) {
            for(var j=0; j < 4; j+=1){
                output.push(+spin.charAt((i*4)+j));
            }
            output.push('-');
        }
        var str = output.join('');
        return str.substring(0, str.length - 1);
    },

    // Get datetime string from epochtime(ms)
    epochToDateTime: function(epoch) {
        var d = new Date(epoch);
        return d.toLocaleString();
    },

    // Calculate when the data expires based on TTL preferences
    expiryCalc: function(ttl, datetime){
        var expire;
        switch(ttl){
            case 'indefinite': expire = 2147483647000; break;
            case 'month': expire = datetime + daysToMS(30); break;
            case 'week': expire = datetime + daysToMS(7); break;
            default: expire = 2147483647000; break;
        }
        return expire;
    },

    // Simple check if data is JSON
    isJSON: function (data) {
        try { var testobject = JSON.parse(data); } catch (err) { return false; } return true;
    }
}

/*--------------------------------------------------------------------------*
|   Local Helpers
---------------------------------------------------------------------------*/
// Convert days to milliseconds
function daysToMS(days){
    return 1000*60*60*24*days;
}