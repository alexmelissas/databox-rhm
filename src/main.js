var https = require("https");
var http = require("http");
var express = require("express");
var bodyParser = require("body-parser");
var databox = require("node-databox");
var express = require('express');
var tls = require('tls');
var fs = require('fs');
var request = require('request');
var stun = require('stun');
var socket;

/****************************************************************************
* Hack-y way to circumvent self-signed certificate on the relay...
****************************************************************************/
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

/****************************************************************************
* Server Info & Configuration Stuff
****************************************************************************/

const DATABOX_ARBITER_ENDPOINT = process.env.DATABOX_ARBITER_ENDPOINT || 'tcp://127.0.0.1:4444';
const DATABOX_ZMQ_ENDPOINT = process.env.DATABOX_ZMQ_ENDPOINT || "tcp://127.0.0.1:5555";
const DATABOX_TESTING = !(process.env.DATABOX_VERSION);
const DATABOX_PORT = process.env.port || '8080';

const SERVER_IP = '35.176.4.8';
const TLS_PORT = 8000;
const SERVER_URI = "https://"+SERVER_IP+":"+TLS_PORT+"/";
const TURN_USER = 'alex';
const TURN_CRED = 'donthackmepls';

const tlsConfig = {
    ca: [ fs.readFileSync('client.crt') ]
  };

 iceConfig = {"iceServers": [
    {"url": "stun:stun.l.google.com:19302"},
    {"url":"turn:"+TURN_USER+"@"+SERVER_IP, "credential":TURN_CRED}
  ]};

/****************************************************************************
* Cryptography
****************************************************************************/
const crypto = require('crypto');
const HKDF = require('hkdf');

const userType = 'patient';
//will use this manually
const userName = 'supergran7000';

var sessionKey;

/****************************************************************************
* Datastores
****************************************************************************/

const store = databox.NewStoreClient(DATABOX_ZMQ_ENDPOINT, DATABOX_ARBITER_ENDPOINT, false);

//get the default store metadata
const metaData = databox.NewDataSourceMetadata();

//Stores user preferences - SessionKey, Privacy Settings etc
const userPreferences = {
    ...databox.NewDataSourceMetadata(),
    Description: 'User Preferences',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'userPreferences',
    DataSourceID: 'userPreferences',
    StoreType: 'kv',
}

const heartRateReading = {
    ...databox.NewDataSourceMetadata(),
    Description: 'HR reading',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'heartRateReading',
    DataSourceID: 'heartRateReading',
    StoreType: 'kv',
}

const bloodPressureLowReading = {
    ...databox.NewDataSourceMetadata(),
    Description: 'BPL reading',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'bloodPressureLowReading',
    DataSourceID: 'bloodPressureLowReading',
    StoreType: 'kv',
}

const bloodPressureHighReading = {
    ...databox.NewDataSourceMetadata(),
    Description: 'BPH reading',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'bloodPressureHighReading',
    DataSourceID: 'bloodPressureHighReading',
    StoreType: 'kv',
}

//create store schema for an actuator 
//(i.e a store that can be written to by an app)
const alexTestActuator = {
    ...metaData,
    Description: 'alex test actuator',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'alexTestActuator',
    DataSourceID: 'alexTestActuator',
    StoreType: 'ts/blob',
    IsActuator: true,
}

// Create the datastores using the client
store.RegisterDatasource(userPreferences).then(() => {
    store.RegisterDatasource(heartRateReading);
    store.RegisterDatasource(bloodPressureLowReading);
    store.RegisterDatasource(bloodPressureHighReading);
    console.log("Stores registered");
    //Register the actuator
    return store.RegisterDatasource(alexTestActuator);
}).catch((err) => { console.log("error registering alexTest config datasource", err) }).then(() => {
    console.log("registered alexTestActuator, observing", alexTestActuator.DataSourceID);
    store.TSBlob.Observe(alexTestActuator.DataSourceID, 0)
        .catch((err) => {
            console.log("[Actuation observing error]", err);
        })
        .then((eventEmitter) => {
            if (eventEmitter) {
                eventEmitter.on('data', (data) => {
                    console.log("[Actuation] data received ", data);
                });
            }
        })
        .catch((err) => {
            console.log("[Actuation error]", err);
        });
});

/****************************************************************************
* Webserver Setup
****************************************************************************/

//set up webserver to serve driver endpoints
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.urlencoded());
app.set('views', './views');
app.set('view engine', 'ejs');

// Allow serving static files from views directory (ajax and css stuff)
app.use(express.static('views'));


/****************************************************************************
* Request Handlers
****************************************************************************/

app.get("/", function (req, res) {
    res.redirect("/ui");
});

//Initial Loading of UI
app.get("/ui", function (req, res) {
    readAll(req,res);
});

//Read latest values from datastores
function readAll(req,res){
    store.KV.Read(heartRateReading.DataSourceID, "value").then((result) => {
        console.log("result:", heartRateReading.DataSourceID, result.value);
        hrResult=result;
        return store.KV.Read(bloodPressureHighReading.DataSourceID, "value");
    }).then((result2) => {
       console.log("result2:", bloodPressureHighReading.DataSourceID, result2.value);
       bphResult = result2;
       return store.KV.Read(bloodPressureLowReading.DataSourceID, "value");
    }).then((result3) => {
        console.log("result3:", bloodPressureLowReading.DataSourceID, result3.value);
        bplResult = result3;
        res.render('index', { hrreading: hrResult.value, bphreading: bphResult.value, bplreading: bplResult.value });
        return store.KV.Read(userPreferences.DataSourceID, "ttl");
    }).then((result4) => {
        console.log("TTL Setting:", result4);
        return store.KV.Read(userPreferences.DataSourceID, "filter");
    }).then((result5) => {
        console.log("Filter Setting:", result5);
    }).catch((err) => {
        console.log("Read Error", err);
        res.send({ success: false, err });
    });
}

// WAS TRYING TO MAKE THE KEY ESTABLISHMENT INTO A GET REQUEST YOU WOULD SELF-CALL FOR ASYNC FUNCTIONALITY... HOWWWWWWWWWWWWWWWW
// app.get('/establishSessionKey',(req,res)=>{
//     // Create my side of the ECDH
//     const alice = crypto.createECDH('Oakley-EC2N-3');
//     const aliceKey = alice.generateKeys();
  
//     // Initiate the ECDH process with the relay server
//     request.post(SERVER_URI+'establishSessionKey')
//     .json({alicekey: aliceKey})
//     .on('data', function(bobKey) {
  
//       // Use ECDH to establish sharedSecret
//       const aliceSecret = alice.computeSecret(bobKey);
//       var hkdf = new HKDF('sha256', 'saltysalt', aliceSecret);
  
//       // Derive sessionKey with HKDF based on sharedSecret
//       hkdf.derive('info', 4, function(key) {
//         console.log("Deriving key...");
//         if(key!=null){
//           console.log('HKDF Session Key: ',key.toString('hex'));
//           sessionKey = key;
//           res.send("OK");
//         } res.end();
//       });
//     });
// });

//Try connecting with TLS to server
app.get('/tryTLS',(req,res)=>{
    console.log("Trying TLS connection");
    socket = tls.connect(TLS_PORT, SERVER_IP, tlsConfig, () => {
        console.log('TLS connection established and ', socket.authorized ? 'authorized' : 'unauthorized');
      
        //TODO: initial checks eg if already registered etc - stuff
      
        // Use TURN daemon of relay server to learn my own public IP
        stun.request("turn:"+TURN_USER+"@"+SERVER_IP, (err, res) => {
            if (err) {
                console.error(err);
            } else {
                // Get pure external IP (after TURN)
                const { address } = res.getXorAddress();
                const userIP = address;

                // Create my side of the ECDH
                const alice = crypto.createECDH('Oakley-EC2N-3');
                const aliceKey = alice.generateKeys();
        
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
                        if(sessionKey!=null){
                            // Encrypt my IP and data
                            var encrypted_userType = encryptString('aes-256-cbc',sessionKey,userType);
                            var encrypted_userName = encryptString('aes-256-cbc',sessionKey,userName);
                            var encrypted_ip = encryptString('aes-256-cbc',sessionKey,userIP);
                
                            // Send my encrypted IP and data to other guy
                            request.post(SERVER_URI+'clientInfo')
                            .json({ type: encrypted_userType, username : encrypted_userName, ip: encrypted_ip })
                            .on('data', function(data) {
                            // If relay reads and validates my IP, it sends back an encrypted pokemon that we decrypt and show
                            if(data == 'OK'){
                                request.get(SERVER_URI+'charizard')
                                .on('data', function(data) {
                                var charizard = decryptString('aes-256-cbc',sessionKey,data);
                                process.stdout.write(charizard);
                                });
                            } else{ console.log("Error with server receiving this IP"); }
                            });
                        } else{ console.log("Key establishment failure."); }
                        }
                    });
                })
            }
        });
    });
    res.end();
});

// Write new HR reading into datastore -- POST
app.post('/setHR', (req, res) => {

    const hrreading = req.body.hrreading;

    return new Promise((resolve, reject) => {
        store.KV.Write(heartRateReading.DataSourceID, "value", 
                { key: heartRateReading.DataSourceID, 
                    value: hrreading }).then(() => {
            console.log("Wrote new HR: ", hrreading);
            resolve();
        }).catch((err) => {
            console.log("HR write failed", err);
            reject(err);
        });
    }).then(() => {
        //request.post(SERVER_URI+'setHR').form({message:hrreading});
        res.redirect('/');
    });
});

//update hr with ajax.. doesnt work
app.post('/ajaxUpdateHR', function(req, res){
    
    const hrreading = req.body.measurement;

    return new Promise((resolve, reject) => {
        store.KV.Write(heartRateReading.DataSourceID, "value", 
        { key: heartRateReading.DataSourceID, value: hrreading }).then(() => {
            console.log("Wrote new HR: ", hrreading);
            store.KV.Read(heartRateReading.DataSourceID, "value").then((result) => {
                console.log("Sending response to AJAX:",result.value);
                res.status(200).send({new_measurement:result.value, test:'hello'});
                resolve();
            }).catch((e) => {
                res.status(400).send(e);
            });
        }).catch((err) => {
            console.log("HR write failed", err);
            reject(err);
        });
    });
    
});

app.post('/setBPL', (req, res) => {

    const bplreading = req.body.bplreading;

    return new Promise((resolve, reject) => {
        store.KV.Write(bloodPressureLowReading.DataSourceID, "value", 
        { key: bloodPressureLowReading.DataSourceID, value: bplreading }).then(() => {
            console.log("Wrote new BPL: ", bplreading);
            resolve();
        }).catch((err) => {
            console.log("BPL write failed", err);
            reject(err);
        });
    }).then(() => {
        //request.post(SERVER_URI+'setBPL').form({message:bplreading});
        res.redirect('/');
    });
});

app.post('/setBPH', (req, res) => {

    const bphreading = req.body.bphreading;

    return new Promise((resolve, reject) => {
        store.KV.Write(bloodPressureHighReading.DataSourceID, "value", 
        { key: bloodPressureHighReading.DataSourceID, value: bphreading }).then(() => {
            console.log("Wrote new BPH: ", bphreading);
            resolve();
        }).catch((err) => {
            console.log("BPH write failed", err);
            reject(err);
        });
    }).then(() => {
        //request.post(SERVER_URI+'setBPH').form({message:bphreading});
        res.redirect('/');
    });
});

app.get("/status", function (req, res) {
    res.send("active");
});

//dynamic load of settings page on top of index
app.get("/settings", function(req,res){

    var ttl, filter;

    store.KV.Read(userPreferences.DataSourceID, "ttl").then((result) => {
        console.log("ttl:", result.value);
        ttl = result;
        return store.KV.Read(userPreferences.DataSourceID, "filter");
    }).then((result2) => {
        console.log("filter:", result2.value);
        filter = result2;
    }).catch((err) => {
        console.log("Read Error", err);
        res.send({ success: false, err });
    });

    //this makes no sense - want to do smth like getelementbyid to change which thing is checked
    // switch(ttl){
    //     case "indefinite": res.body.ttl1.checked = true; break;
    //     case "month": res.body.ttl2.checked = true; break;
    //     case "week": rres.body.ttl3.checked = true; break;
    //     default: res.body.ttl1.checked = true; break;
    // }
    
    // switch(filter){
    //     case "values": res.body.filter1.checked = true; break;
    //     case "desc": res.body.filter2.checked = true; break;
    //     default: res.body.filter1.checked = true; break;
    // }

    res.render('settings');

});

// opposite
app.get("/main", function(req,res){
    readAll(req,res);
    res.end();
});

app.post("/ajaxSaveSettings", function(req,res){

    console.log("SaveSettings Called");

    const ttlSetting = req.body.ttl;
    const filterSetting = req.body.filter;

    console.log("Got settings: ",ttlSetting," ",filterSetting);

    return new Promise((resolve, reject) => {
        store.KV.Write(userPreferences.DataSourceID, "ttl", 
        { key: userPreferences.DataSourceID, value: ttlSetting }).then(() => {
            console.log("Updated TTL settings: ", ttlSetting);
        }).then (() =>{
        store.KV.Write(userPreferences.DataSourceID, "filter", 
        { key: userPreferences.DataSourceID, value: filterSetting }).then(() => {
            console.log("Updated Filter settings: ", filterSetting);
        }).catch((err) => {
            console.log("Filter settings update failed", err);
            reject(err);
        });
        }).then(() => {
            resolve();
            res.status(200).send();
        });
    });
    res.end();
});

app.post("/disassociate", function(req,res){
    console.log("DISASSOCIATE HERE");
    res.end();
});

//when testing, we run as http, (to prevent the need for self-signed certs etc);
if (DATABOX_TESTING) {
    console.log("[Creating TEST http server]", DATABOX_PORT);
    http.createServer(app).listen(DATABOX_PORT);
} else {
    console.log("[Creating https server]", DATABOX_PORT);
    const credentials = databox.GetHttpsCredentials();
    https.createServer(credentials, app).listen(DATABOX_PORT);
}

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
