const crypto = require('crypto');
const fs = require('fs');
const HKDF = require('hkdf');
const request = require('request');

const SERVER_IP = '3.8.236.94';
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
    },

    generatePIN: function(){
        return Math.floor(1000000000000000 + Math.random() * 9000000000000000); 
    },

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

    //Calculate descriptions/classification from measurement values
    valueToDesc: function (type, valueJSON) {
        var values = JSON.parse(valueJSON);
        var desc;
        switch(type){
            case 'BP':
                var bps = parseInt(values.bps);
                var bpd = parseInt(values.bpd);
                const bpsLevel =  getBPLevel('bps',bps);
                const bpdLevel = getBPLevel('bpd',bpd);
                desc = classifyBP(bpsLevel,bpdLevel);
                break;
            case 'HR':
                desc = classifyHR(parseInt(values.hr), values.age);
                break;
        }
        return desc;
    },

    //https://stackoverflow.com/questions/24738169/how-can-i-get-the-current-datetime-in-the-format-2014-04-01080000-in-node
    dateTime: function() {
        const date = new Date();

        return date.getDate().toString().padStart(2, '0') + '/' +
            (date.getMonth() + 1).toString().padStart(2, '0') + '/' +
            date.getFullYear() + ' | ' +
            date.getHours().toString().padStart(2, '0') + ':' +
            date.getMinutes().toString().padStart(2, '0') + ':' +
            date.getSeconds().toString().padStart(2, '0');
    }

}

function classifyHR(value,age){
    var desc;
    // Max target HR (during exercise, assuming 100% use)
    var max = 220 - age;

    // Making assumptions -- bad..
    var normal_low = max*0.35; // rest?
    var normal_high = max*0.49; // right before light exercise

    console.log("[?][classifyHR] value=",value);

    if (value < normal_low) desc = 'low';
    else if (value > normal_high) desc = 'high';
    else desc = 'normal';

    return desc;
}

function classifyBP(bpsLevel, bpdLevel){
    //https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings
    var desc = "error";
    if(bpsLevel == 1 && bpdLevel == 1) desc = "normal";
    else if(bpsLevel == 2 && bpdLevel == 1) desc = "elevated";
    else if(bpsLevel == 3 || bpdLevel == 2) desc = "ht1";
    else if(bpsLevel == 4 || bpdLevel == 3) desc = "ht2";
    else if(bpsLevel == 5 || bpdLevel == 4) desc = "htc";
    return desc;
}

function getBPLevel(type, value){
    //https://www.nhs.uk/common-health-questions/lifestyle/what-is-blood-pressure/
    //https://www.heart.org/en/health-topics/high-blood-pressure/understanding-blood-pressure-readings
    var level;
    if(type=='bps'){
        if(value<120) level = 1;
        else if (value < 130) level = 2;
        else if (value < 140) level = 3;
        else if (value < 180) level = 4;
        else level = 5;
    }
    else{
        if(value<80) level = 1;
        else if (value < 90) level = 2;
        else if (value < 120) level = 3;
        else level = 4;
    }
    return level;
}