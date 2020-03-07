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
const crypto = require('crypto');
var socket;

const h = require('./helpers.js');
/****************************************************************************
* Janky way to circumvent self-signed certificate on the relay...
****************************************************************************/
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
/****************************************************************************
* Databox Server Setup
****************************************************************************/
const DATABOX_ARBITER_ENDPOINT = process.env.DATABOX_ARBITER_ENDPOINT || 'tcp://127.0.0.1:4444';
const DATABOX_ZMQ_ENDPOINT = process.env.DATABOX_ZMQ_ENDPOINT || "tcp://127.0.0.1:5555";
const DATABOX_TESTING = !(process.env.DATABOX_VERSION);
const DATABOX_PORT = process.env.port || '8080';
/****************************************************************************
* Express Webserver Setup
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
* Relay Server Info
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
* Security & Cryptography Setup
****************************************************************************/
const userType = 'patient';
const userPIN = '1234';
const targetPIN = '5678';

// Create my side of the ECDH
const ecdh = crypto.createECDH('Oakley-EC2N-3');
const publickey = ecdh.generateKeys();

var relaySessionKey;

var msDelay = 2000;
var attempts = 6;
/****************************************************************************
* Datastores Setup
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

//Try establish a session
app.get('/establish', async (req,res)=>{
    var socket = tls.connect(TLS_PORT, SERVER_IP, tlsConfig, async () => {
        console.log('TLS connection established and ', socket.authorized ? 'authorized' : 'unauthorized');

        var userIP;
        var relaySessionKey;
        
        //TODO: initial checks eg if already registered etc - stuff
        // eg. if have a peerSessionKey in my datastore means i have connection so skip establish
        console.log(readPSK().toString('hex'));

        // WHAT HAPPENS IF ONE DISCONNECTS AFTER SENDING ITS DATA??????

        //Use TURN daemon on relay to discover my public IP
        await discoverIP().then(function(result){userIP = result});
            
        //Save my IP to userPreferences datastore

        //Establish shared session key with ECDH and HKDF
        await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});

        await firstAttemptEstablish(userIP, relaySessionKey).then(async function(result){
            var success = 'Established key: '+result.toString('hex');
            if(result==0) res.send('Match found, error in key establishment.');
            else if (result == 1) res.send('No match found.');
            else {
                await savePSK(result).then(function(result){
                    if(result==0) res.send(success);
                }).catch((err)=>{console.log(err);});
            }
        }).catch((err) => { console.log("Error in establishment", err); });

    });
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
        store.KV.Write(userPreferences.DataSourceID, "ttl", { value: ttlSetting }).then(() => {
            console.log("Updated TTL settings: ", ttlSetting);
        }).then (() =>{
        store.KV.Write(userPreferences.DataSourceID, "filter", { value: filterSetting }).then(() => {
            console.log("Updated Filter settings: ", filterSetting);
        }).catch((err) => {
            console.log("Filter settings update failed", err);
            reject(err);
        });
        }).then(() => {
            resolve();
            res.status(200).send();
        });
        res.end();
    });
});

app.post("/disassociate", function(req,res){
    //delete peerSessionKey
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
* Security Stuff
****************************************************************************/
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
                    await h.establishPeerSessionKey(ecdh, match_pbk).then(function(result){
                        if(result == 0) resolve(0);
                        else resolve(result);
                    });
                } 
                // Recursive function repeating 5 times every 5 secs, to check if a match has appeared
                else {
                    console.log("No match found. POSTing to await for match");
                    await attemptMatch(ecdh, publickey, userType,userPIN,targetPIN).then(function(result){
                        if(result!=null) resolve(result);
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

//Save PSK to datastore
function savePSK(peerSessionKey){
    return new Promise((resolve, reject) => {
        store.KV.Write(userPreferences.DataSourceID, "peerSessionKey", { value: peerSessionKey}).then(() => {
            console.log("Updated PSK");
            resolve(0);
        }).catch((err) => {
            console.log("PSK write failed", err);
            reject(err);
        });
    });
}

function readPSK(){
    store.KV.Read(userPreferences.DataSourceID, "peerSessionKey").then((result) => {
        console.log("PSK:", result);
        return result;
    }).catch((err) => {
        console.log("Read Error", err);
        return err;
    });
}

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