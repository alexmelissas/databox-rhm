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
* User Data - Security & Cryptography Setup
****************************************************************************/
const userType = 'patient';
userPIN = '1234';
userAge = 70;

// Create my side of the ECDH
const ecdh = crypto.createECDH('Oakley-EC2N-3');
const publickey = ecdh.generateKeys();

var relaySessionKey;

var msDelay = 3000;
var findMatchAttempts = 5;
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

const bloodPressureReading = {
    ...databox.NewDataSourceMetadata(),
    Description: 'BP reading',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'bloodPressureReading',
    DataSourceID: 'bloodPressureReading',
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

//create store schema for an actuator 
//(i.e a store that can be written to by an app)
const srhmPatientActuator = {
    ...metaData,
    Description: 'SRHM Patient Actuator',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'srhmPatientActuator',
    DataSourceID: 'srhmPatientActuator',
    StoreType: 'ts/blob',
    IsActuator: true,
}

// Create the datastores using the client
store.RegisterDatasource(userPreferences).then(() => {
    store.RegisterDatasource(heartRateReading);
    store.RegisterDatasource(bloodPressureReading);
    console.log("Stores registered");
    //Register the actuator
    return store.RegisterDatasource(srhmPatientActuator);
}).catch((err) => { console.log("error registering patient config datasource", err) }).then(() => {
    console.log("registered alexTestActuator, observing", srhmPatientActuator.DataSourceID);
    store.TSBlob.Observe(srhmPatientActuator.DataSourceID, 0)
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
        console.log("result:", heartRateReading.DataSourceID, result.hr);
        hrResult=result;
        return store.KV.Read(bloodPressureReading.DataSourceID, "value");
    }).then((result) => {
        var print = result.bps + ':' + result.bpd;
        res.render('index', { hrreading: hrResult.value, bpreading: print});
        return store.KV.Read(userPreferences.DataSourceID, "ttl");
    }).then((result) => {
        console.log("TTL Setting:", result);
        return store.KV.Read(userPreferences.DataSourceID, "filter");
    }).then((result) => {
        console.log("Filter Setting:", result);
    }).catch((err) => {
        console.log("Read Error", err);
        res.send({ success: false, err }); // HORRIBLE
    });
}

//Try establish a session
app.get('/establish', async (req,res)=>{
    var socket = tls.connect(TLS_PORT, SERVER_IP, tlsConfig, async () => {
        console.log('\n00000000000\n[*][Establish] TLS connection established and ', socket.authorized ? 'authorized' : 'unauthorized');

        var relaySessionKey;
        
        // WHAT HAPPENS IF ONE DISCONNECTS AFTER SENDING ITS DATA??????

        //Use TURN daemon on relay to discover my public IP
        await discoverIP().then(function(result){userIP = result}).catch((err)=>{console.log(err);});
            
        //Save my IP to userPreferences datastore?

        //Establish shared session key with ECDH and HKDF
        await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});

        await firstAttemptEstablish(userIP, relaySessionKey).then(async function(result){
            const establishResult = result;
            if(result=="PSK Error") {
                console.log('[!][Establish] Match found, error in key establishment.');
                selfUnlink(res);
            }
            else if (result == "no match") {
                console.log('[!][Establish] No match found.');
                selfUnlink(res);
            }
            else if(result == "no target pin"){
                console.log('[!][Establish] No target PIN.');
                selfUnlink(res);
            }   
            else if(result == "other error"){
                console.log('[!][Establish] Arbitrary error.');
                selfUnlink(res);
            }
            else {
                await savePSK(result).then(async function(result){
                    if(result=="success") {
                        const success = '[+][Establish] Established PSK: '+establishResult.toString('hex');
                        console.log(success);
                        //res.send(success);// -- FOR SHOWCASE
                        res.redirect('/');
                    }
                }).catch((err)=>{console.log("[!][Establish]",err); selfUnlink(res);});
            }
        }).catch((err) => { console.log("[!][Establish]", err); selfUnlink(res);});
    });
});

// Write new HR reading into datastore
app.post('/setHR', (req, res) => {
    const hrreading = req.body.measurement;
    // Create the JSON

    //TODO: TTL
    const datajson = JSON.stringify({type: 'HR', datetime: dateTime(), hr: hrreading});

    return new Promise(async (resolve, reject) => {
        await store.KV.Write(heartRateReading.DataSourceID, "value", 
        { key: heartRateReading.DataSourceID, hr: hrreading }).then(async() => {
            console.log("Wrote new HR: ", hrreading);
            await readPSK().then(async function(psk){
                if(psk!=null) {
                    await sendData(psk,datajson).then(function(result){
                        console.log(result);
                        resolve(result);
                        // contingency here .. resend? save in some queue to send later?
                        // bundled/atomic instruction style - either both write and send or neither
                    });
                }
                else resolve('noPSK');
            });
        }).catch((err) => {
            console.log("HR write failed", err);
            resolve('err');
        });
    }).then(function(result){
        if(result=='err') { 
            console.log("[!][SetHR] Send error"); 
            res.status(400).send("[!][SetHR] Send error"); 
        }
        else if(result=='noPSK') { 
            console.log('[!][SetHR] No PSK, no send'); 
            res.status(400).send("[!][SetHR] No PSK, no send"); 
        }
        else {
            store.KV.Read(heartRateReading.DataSourceID, "value")
            .then((result) => {
                if(result!=null) res.json(JSON.stringify({hrreading:result.hr}));
            }).catch((e) => {
                res.status(400).send(e);
            });
        }
    });
});

app.post('/setBP', (req, res) => {
    const bpsreading = req.body.bps;
    const bpdreading = req.body.bpd;
    //TODO: TTL
    const datajson = JSON.stringify({type: 'BP', datetime: dateTime(), bps: bpsreading, bpd: bpdreading});

    return new Promise((resolve, reject) => {
        store.KV.Write(bloodPressureReading.DataSourceID, "value", 
        { key: bloodPressureReading.DataSourceID, bps: bpsreading, bpd: bpdreading}).then(async() => {
            console.log("Wrote new BP: ", bpsreading+":"+bpdreading);

            await readPSK().then(async function(psk){
                if(psk!=null) {
                    await sendData(psk,datajson).then(function(result){
                        console.log(result);
                        resolve(result);
                        // contingency here .. resend? save in some queue to send later?
                        // bundled/atomic instruction style - either both write and send or neither
                    });
                }
                else resolve('noPSK');
            });
        }).catch((err) => {
            console.log("BP write failed", err);
            resolve('err');
        });
    }).then(function(result){
        if(result=='err') { 
            console.log("[!][SetBP] Send error"); 
            res.status(400).send("[!][SetBP] Send error"); 
        }
        else if(result=='noPSK') { 
            console.log('[!][SetBP] No PSK, no send'); 
            res.status(400).send("[!][SetBP] No PSK, no send"); 
        }
        else {
            store.KV.Read(bloodPressureReading.DataSourceID, "value")
            .then((result) => {
                if(result!=null) res.json(JSON.stringify({bps:result.bps, bpd:result.bpd}));
            }).catch((e) => {
                res.status(400).send(e);
            });
        }
    });
});

app.get("/linkStatus", async function (req, res) {
    var linkStatus;
    await readPSK().then(function(result){
        if(result!=null) linkStatus = 1;
        else linkStatus = 0;
        res.json(JSON.stringify({link: linkStatus}));
    });
});

app.get("/serverStatus", async function (req, res) {
    var serverStatus;
    request.get(SERVER_URI+'ping').on('data', function(){
        if(data=='OK') res.json(JSON.stringify({server: serverStatus}));
        else res.json(JSON.stringify({server: serverStatus}));
    });
});

// load settings
app.get("/settings", function(req,res){
    res.render('settings');
});

// other screen -> home
app.get("/main", function(req,res){
    readAll(req,res);
});

// Save settings with ajax
app.post("/ajaxSaveSettings", function(req,res){
    const ttlSetting = req.body.ttl;
    const filterSetting = req.body.filter;

    console.log("[*][ajaxSaveSettings] Got settings: ",ttlSetting," ",filterSetting);

    return new Promise((resolve, reject) => {
        store.KV.Write(userPreferences.DataSourceID, "ttl", { value: ttlSetting }).then(() => {
        }).then (() =>{
        store.KV.Write(userPreferences.DataSourceID, "filter", { value: filterSetting }).then(() => {
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

// Read settings with ajax
app.get("/readSettings", function(req,res){
    var ttl, filter;
    store.KV.Read(userPreferences.DataSourceID, "ttl").then((result) => {
        ttl = result.value;
        return store.KV.Read(userPreferences.DataSourceID, "filter");
    }).then((result2) => {
        filter = result2.value;
        res.json(JSON.stringify({ttl:ttl, filter:filter}));
    }).catch((err) => {
        console.log("[!][readSettings]Read Error", err);
        res.send('error');
    });
});

app.post("/disassociate", async function(req,res){
    await savePSK(null).then(async function (){
        await saveTargetPIN(null).then(function (){
            res.redirect('/'); 
        });
    });
});

async function selfUnlink(res){
    await savePSK(null).then(async function (){
        await saveTargetPIN(null).then(function (){
            res.redirect('/'); 
        });
    });
}

// AJAX gives the inserted target PIN, gets transformed to xxxxxxxxxxxxxxxxx from xxxx-xxxx-xxxx-xxxx
app.post("/readTargetPIN", async function(req,res){
    const tPIN = req.body.tpin;
    await saveTargetPIN(tPIN).then(function (){
        res.end();
    });
});

app.get("/checkFirstTime", async function(req,res){
    await readUserPIN().then(function(result){
        if(result!=null) res.json(JSON.stringify({result:false}));
        else res.json(JSON.stringify({result:true}));
    });
});

app.get("/handleFirstTime", async function(req,res){
    await readUserPIN().then(async function(result){
        if(result!=null) {
            userPIN = result;
            console.log("[*][Establish] Using User PIN:",h.pinToString(result));
            res.json(JSON.stringify({userpin:h.pinToString(userPIN)}));
        } else {
            await newPIN().then(function(result){
                if(result!='error') {
                    userPIN = result;
                    console.log("[*][Establish] New User PIN:",h.pinToString(result));
                    res.json(JSON.stringify({userpin:h.pinToString(userPIN)}));
                }
                else {
                    console.log("[!][Establish] No user PIN, can't create one either..?");
                    res.json(JSON.stringify({userpin:null}));
                }
            });
        }
    });
});

app.post("/handleForm", async function(req,res){
    const tPIN = req.body.tpin;
    //const age = req.body.age;

    await saveTargetPIN(tPIN).then(function (result){
        //save age BLAh
        res.redirect('/'); // establish from here? now need extrau user input
    });
});

// TESTING ONLY
app.get('/deleteUserPIN', async function(req,res){
    await deleteUserPIN().then(function (){
        res.end();
    });
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
* Establish PSK
****************************************************************************/
// First attempt to find match
async function firstAttemptEstablish(userIP, relaySessionKey){
    return new Promise(async(resolve,reject)=>{
        if(relaySessionKey!=null){
            await readTargetPIN().then(function (targetPIN){
                if(targetPIN!=null){
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
                            resolve("other error");
                            //RETRY SOMEHOW - ideally not from beginning to not frustrate usr
                        }
                        else if(data != 'AWAITMATCH'){ //horrible idea for error handling
                            var res = JSON.parse(data);
                            var match_pin = h.decrypt(Buffer.from(res.pin), relaySessionKey);
                            var match_ip = h.decrypt(Buffer.from(res.ip), relaySessionKey);
                            var match_pbk = h.decrypt(Buffer.from(res.pbk), relaySessionKey);
                            console.log("[<-] Received match:\n      PIN: "+match_pin
                                +"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
                            await h.establishPeerSessionKey(ecdh, match_pbk).then(function(result){
                                if(result == 0) resolve("PSK Error");
                                else resolve(result);
                            });
                        } 
                        // Recursive function repeating 5 times every 5 secs, to check if a match has appeared
                        else {
                            console.log("No match found. POSTing to await for match");
                            await attemptMatch(findMatchAttempts, ecdh, publickey, userType,userPIN,targetPIN)
                            .then(function(result){
                                // doesnt reach here when recursing more than once
                                if(result!="no match") resolve(result);
                                else resolve("no match");
                            });
                        }
                    });  
                }
                else resolve("no target pin");
            });
        } 
        else { 
            console.log("[!][firstAttemptEstablish] Relay Session Key establishment failure.");
            resolve("other error");
        }
    });
    
}

async function attemptMatch(attempts, ecdh, publickey, userType,userPIN,targetPIN){
    return new Promise(async(resolve,reject) => {
        while(attempts>0) {
            attempts--;
            var relaySessionKey;
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
                    await h.establishPeerSessionKey(ecdh, match_pbk).then(function(result){
                        request.post(SERVER_URI+'deleteSessionInfo').json({pin : encrypted_PIN});
                        attempts = 0;
                        resolve(result);
                    });
                }
                else if (attempts==1) {
                    attempts = 0;
                    console.log("FindMatch attempts exceeded.");
                    await h.establishRelaySessionKey(ecdh, publickey).then(function(relaySessionKey){
                        encrypted_PIN = h.encrypt(userPIN,relaySessionKey);
                        request.post(SERVER_URI+'deleteSessionInfo').json({pin : encrypted_PIN});
                        resolve("no match");
                    });
                }
            });
            await wait(msDelay);
            if(attempts>0) console.log("Re-attempting,",attempts,"attempts remaining.");
        }
        resolve("no match");
    });
}

async function wait(ms) {
    return new Promise((resolve,reject) => {
        setTimeout(resolve, ms);
    });
}
/****************************************************************************
* Send/Receive
****************************************************************************/
async function sendData(peerSessionKey, datajson){
    return new Promise(async (resolve,reject) => {
      await attemptSendData(peerSessionKey, datajson).then(function(result){ //SLIGHTLY POINTLESS BUT MIGHT ADD BETTER ERROR HANDLE
        switch(result){
          case "Success": resolve("Success"); break;
          case "PSK err": resolve("No PSK!"); break;
          case "RSK err": resolve("Relay Session Key establishment failure. Try again"); break;
        }
      });
    });
  }

// Send random HR data to relay
function attemptSendData(peerSessionKey, datajson){
    return new Promise(async (resolve,reject) => {
        await readPSK().then(async function(result) { 
            if(result==null) {
                resolve("PSK err"); 
            }
            else {
                // END-TO-END ENCRYPTION
                var encrypted_datajson = h.encryptBuffer(datajson,peerSessionKey);
                //CHECKSUMS FOR INTEGRITY
                var checksum = crypto.createHash('sha256').update(peerSessionKey+encrypted_datajson).digest('hex');
                
                var relaySessionKey;
                await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});
                var encrypted_PIN = h.encrypt(userPIN,relaySessionKey);
                request.post(SERVER_URI+'store')
                .json({ pin : encrypted_PIN, checksum: checksum, data: encrypted_datajson})
                .on('data', function(data) {
                    if(data == "RSK Concurrency Error"){
                        console.log("Relay Session Key establishment failure.");
                        resolve("RSK err");
                    }
                    else {
                        console.log("Sent data");
                        resolve("Success");
                    }
                });
            }
        });
    });
}

/****************************************************************************
* Helpers
****************************************************************************/
//Save PSK to datastore
function savePSK(peerSessionKey){
    return new Promise((resolve, reject) => {
        store.KV.Write(userPreferences.DataSourceID, "peerSessionKey", { value: peerSessionKey}).then(() => {
            if(peerSessionKey==null) console.log("[X][savePSK] Null'd PSK");
            else console.log("[*][savePSK] Updated PSK");
            resolve("success");
        }).catch((err) => {
            console.log("[!][savePSK] Write error", err);
            resolve("error");
        });
    });
}

function readPSK(){
    return new Promise((resolve,reject)=> {
        store.KV.Read(userPreferences.DataSourceID, "peerSessionKey").then((result) => {
            if(result.value =='' || result.value == null) resolve (null);
            else resolve(Buffer.from(result.value.data));
        }).catch((err) => {
            console.log("[!][readPSK] Read error", err);
            resolve(null);
        });
    });
}

//Save User PIN to datastore
function newPIN(){
    return new Promise((resolve, reject) => {
        var pin = h.generatePIN();
        store.KV.Write(userPreferences.DataSourceID, "userPIN", { value: pin.toString()}).then(() => {
            console.log("[*][newPIN] Generated new PIN");
            resolve(pin.toString());
        }).catch((err) => {
            console.log("[!][newPIN] PIN generate failed", err);
            resolve("error");
        });
    });
}

/// testing only!
function deleteUserPIN(){
    return new Promise((resolve, reject) => {
        store.KV.Write(userPreferences.DataSourceID, "userPIN", { value: null}).then(() => {
            console.log("[X][deletePIN] Deleted userPIN");
            resolve(pin.toString());
        }).catch((err) => {
            console.log("[!][deletePIN] Couldn't delete userPIN", err);
            resolve("error");
        });
    });
}
//////////////////

//Read User PIN from datastore
function readUserPIN(){
    return new Promise((resolve,reject)=> {
        store.KV.Read(userPreferences.DataSourceID, "userPIN").then((result) => {
            if(result.value=='' || result.value == null) resolve (null);
            else resolve((result.value).toString());
        }).catch((err) => {
            console.log("[!][readUserPIN] Read error", err);
            resolve(null);
        });
    });
}

//Save Target PIN to datastore
function saveTargetPIN(pin){
    return new Promise((resolve, reject) => {
        store.KV.Write(userPreferences.DataSourceID, "targetPIN", { value: pin}).then(() => {
            if(pin==null) console.log("[X][saveTargetPIN] Null'd target PIN");
            else console.log("[*][saveTargetPIN] Updated target PIN");
            resolve("success");
        }).catch((err) => {
            console.log("[!][saveTargetPIN] Target PIN save failed", err);
            resolve("error");
        });
    });
}

function readTargetPIN(){
    return new Promise((resolve,reject)=> {
        store.KV.Read(userPreferences.DataSourceID, "targetPIN").then((result) => {
            if(result.value=='' || result.value == null) resolve (null);
            else{ 
                console.log("[*][readTargetPIN]",result.value);
                resolve(result.value);
            }
        }).catch((err) => {
            console.log("[!][readTargetPIN] Read error", err);
            resolve(null);
        });
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