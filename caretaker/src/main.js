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
* User Data / Security & Cryptography Setup
****************************************************************************/
const userType = 'caretaker';

// Create my side of the ECDH
const ecdh = crypto.createECDH('Oakley-EC2N-3');
const publickey = ecdh.generateKeys();

var msDelay = 2500;
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

const heartRateReading = {
    ...databox.NewDataSourceMetadata(),
    Description: 'HR reading',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'heartRateReading',
    DataSourceID: 'heartRateReading',
    StoreType: 'ts/blob',
}

const bloodPressureReading = {
    ...databox.NewDataSourceMetadata(),
    Description: 'BP reading',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'bloodPressureReading',
    DataSourceID: 'bloodPressureReading',
    StoreType: 'ts/blob',
}

const messages = {
    ...databox.NewDataSourceMetadata(),
    Description: 'Messages',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'messages',
    DataSourceID: 'messages',
    StoreType: 'ts/blob',
}

//create store schema for an actuator 
//(i.e a store that can be written to by an app)
const srhmCaretakerActuator = {
    ...metaData,
    Description: 'SRHM Caretaker Actuator',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'srhmCaretakerActuator',
    DataSourceID: 'srhmCaretakerActuator',
    StoreType: 'ts/blob',
    IsActuator: true,
}

// Create the datastores using the client
store.RegisterDatasource(userPreferences).then(() => {
    store.RegisterDatasource(heartRateReading);    
    store.RegisterDatasource(bloodPressureReading);
    store.RegisterDatasource(messages);
    console.log("Stores registered");
    //Register the actuator
    return store.RegisterDatasource(srhmCaretakerActuator);
}).catch((err) => { console.log("error registering caretaker config datasource", err) }).then(() => {
    console.log("registered srhmCaretakerActuator, observing", srhmCaretakerActuator.DataSourceID);
    store.TSBlob.Observe(srhmCaretakerActuator.DataSourceID, 0)
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

process.on('uncaughtException', function (err) {
    console.log('[!][Uncaught Exception]',err);
}); 
/****************************************************************************
*                           Request Handlers                                *
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
    store.TSBlob.Latest(heartRateReading.DataSourceID).then((result) => {
        hrResult=result.hr;
        return store.TSBlob.Latest(bloodPressureReading.DataSourceID);
    }).then((result) => {
        var print = result.bps + ':' + result.bpd;
        res.render('index', { hrreading: hrResult, bpreading: print});
        return store.KV.Read(userPreferences.DataSourceID, "ttl");
    }).then(() => {
        return store.KV.Read(userPreferences.DataSourceID, "filter");
    }).then(() => {
        console.log("[*][ReadAll] Loaded index.ejs");
    }).catch((err) => {
        console.log("[!][ReadAll] Read Error:", err);
        res.send({ success: false, err }); // HORRIBLE
    });
}

//Try establish a session
app.get('/establish', async (req,res)=>{
    var socket;
    socket = tls.connect(TLS_PORT, SERVER_IP, tlsConfig, async () => {
        console.log('\n00000000000\n[*][Establish] TLS connection established and ', socket.authorized ? 'authorized' : 'unauthorized');

        var relaySessionKey;
        
        // WHAT HAPPENS IF ONE DISCONNECTS AFTER SENDING ITS DATA??????

        //Use TURN daemon on relay to discover my public IP
        await discoverIP().then(function(result){userIP = result}).catch((err)=>{console.log(err);});
            
        //Save my IP to userPreferences datastore? -- no changes all the time f dat

        //Establish shared session key with ECDH and HKDF
        await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});

        await firstAttemptEstablish(userIP, relaySessionKey).then(async function(result){
            const establishResult = result;
            if(result=="PSK Error") {
                console.log('[!][Establish] Match found, error in key establishment.');
                softUnlink(res,result);
            }
            else if (result == "no match") {
                console.log('[!][Establish] No match found.');
                softUnlink(res,result);
            }
            else if(result == "no target pin"){
                console.log('[!][Establish] No target PIN.');
                softUnlink(res,result);
            }   
            else if(result == "no user pin"){
                console.log('[!][Establish] No user PIN.');
                softUnlink(res,result);
            }   
            else if(result == "other error"){
                console.log('[!][Establish] Arbitrary error.');
                softUnlink(res,result);
            }
            else {
                await savePSK(result).then(async function(result){
                    if(result=="success") {
                        const success = '[+][Establish] Established PSK: '+establishResult.toString('hex');
                        console.log(success);
                        res.json(JSON.stringify({established:true}));
                    }
                }).catch((err)=>{console.log("[!][Establish]",err); softUnlink(res,err);});
            }
        }).catch((err) => { console.log("[!][Establish]", err); softUnlink(res,err);});
    });
    
    socket.on('error',function(err){
        console.log("[!][Connection] Error connecting to server.");
        softUnlink(res,'connection-error');
    });
});

/****************************************************************************
* Data Management
****************************************************************************/
app.get('/refresh', async (req,res)=>{
    await requestNewData().then(async function(result){
        switch(result){
            // DONT FUCKIGN REFRESH!!!!
            case "empty": console.log("[!][refresh] Nothing found"); res.redirect('/'); break;
            case "psk-err": console.log("[!][refresh] No PSK!"); res.redirect('/'); break;
            case "rsk-err": console.log("[!][refresh] RSK establishment failure. No attempt removed."); res.redirect('/'); break;
            case "no-targetpin": console.log("[!][refresh] No targetPIN."); res.redirect('/'); break;
            default: 
                await readNewData(result).then(function(result){
                    console.log("[*][refresh]",result);
                    //ONLY REFRESH IF THEY QUIT
                    //if(result=='unlinked')
                    res.redirect('/');
                });
        }
    });
    res.end();
});

// Handles each entry received from the patient
function readNewData(dataArr){
    return new Promise((resolve,reject)=>{
        if(dataArr!='empty'){
            dataArr.forEach(async entry =>{
                var datajson;
                const type = entry.type;
                const datetime = entry.datetime;
                const ttl = entry.ttl;
                const filter = entry.filter;

                if(type=='HR') datajson = JSON.stringify({hr:entry.hr});
                else if(type=='BP') datajson = JSON.stringify({bps:entry.bps,bpd:entry.bpd});
                else if(type=='MSG') datajson = JSON.stringify({subj:entry.subj,txt:entry.txt})

                // DROP CONNECTION WITH OTHER PERSON - THEY DROPPED IT FIRST SO OK
                else if(type=='UNLNK') {
                    await followUnlink().then(function(){
                        resolve('unlinked');
                    });
                }
                else return;

                await saveData(type,datetime,ttl,filter,datajson).then(function(result){
                    if(result!="success") console.log("[!][saveData] Error saving data.");
                });
            });
            resolve('success');
        }
        else resolve('empty')
    });
}

// Saves the entries to corresponding datastores
function saveData(type, datetime, ttl, filter, datajson){
    return new Promise(async(resolve, reject) => {

        // data can be number or text ... separate them if want charts

        // do somthn with datetime and TTL

        if(!(h.isJSON(datajson))) resolve('not-json');

        const data = JSON.parse(datajson);

        var dataSourceID, key;

        switch(type){
            
            case 'MSG': 
                dataSourceID = messages.DataSourceID;
                
                store.TSBlob.Write(dataSourceID, { subj: data.subj, txt: data.txt}).then(() => {
                    console.log("Wrote new MSG: ", data.subj,"text:",data.txt);
                    resolve("success");
                }).catch((err) => {
                    console.log(type,"write failed", err);
                    resolve('err');
                });
                break;
        }
    
    });
}
/****************************************************************************
* Navigation
****************************************************************************/

// load settings
app.get("/settings", function(req,res){
    res.render('settings');
});

// other screen -> home
app.get("/main", function(req,res){
    readAll(req,res);
});

/****************************************************************************
* Settings
****************************************************************************/

// Save settings with ajax
app.post("/saveSettings", function(req,res){
    const ttlSetting = req.body.ttl;
    const filterSetting = req.body.filter;

    console.log("[*][ajaxSaveSettings] Got settings: ",ttlSetting," ",filterSetting);

    return new Promise((resolve, reject) => {
        store.KV.Write(userPreferences.DataSourceID, "ttl", { value: ttlSetting }).then(() => {
        }).catch((err) => {
            console.log("[!][saveSettings] TTL settings update failed", err);
            reject(err);
        });
    }).then(() => {
        resolve();
        res.status(200).send();
    });
});

// Read settings with ajax
app.get("/readSettings", async function(req,res){
    await readPrivacyPrefs().then(function(result){
        if(result!='error') res.json(JSON.stringify({ttl:result[0], error:null}));
        else res.json(JSON.stringify({error:result}));
    });
});

/****************************************************************************
* Login/Singup Form
****************************************************************************/
app.get("/checkUnlinked", async function(req,res){
    await readUserPIN().then(async function(result){
        if(result!=null) {
            await readPSK().then(function(result){
                if(result!=null) res.json(JSON.stringify({result:false}));
                else res.json(JSON.stringify({result:true}));
            });
        }
        else res.json(JSON.stringify({result:true}));
    });
});

app.get("/openForm", async function(req,res){

    await readPINs().then(async function(result){
        if(result=='no-userpin'){ // No userPIN (should never be the case but hey)
            await newPIN().then(async function(result){
                if(result!='error') {
                    console.log("[*][Establish] New User PIN:",h.pinToString(result));
                    res.json(JSON.stringify({hasTargetPIN:false,userpin:h.pinToString(result)}));
                }
            });
        }

        else if (result=='error' || result==null){
            console.log('[!][openForm] Arbitrary read PINs error, not opening form.')
            res.end();
        }

        else if (result.length == 1){ // No targetPIN to fill in
            const userPIN = result[0];
            res.json(JSON.stringify({hasTargetPIN:false,userpin:h.pinToString(userPIN)}));
        }

        else {
            const userPIN = result[0];
            const targetPIN = result[1];
            res.json(JSON.stringify({hasTargetPIN:true,userpin:h.pinToString(userPIN),targetpin:h.pinToString(targetPIN)}));
        }
    });
});

app.post("/handleForm", async function(req,res){
    const tPIN = req.body.targetPIN;
    //const age = req.body.age;

    await saveTargetPIN(tPIN).then(function (result){
        if(result=='success'){
            //await thing to save age BLAh
            res.json(JSON.stringify({result:true}));
        } else res.json(JSON.stringify({result:false}));
            
    });
});

// TESTING ONLY
app.get('/deleteUserPIN', async function(req,res){
    await deleteUserPIN().then(function (result){
        if(result!='error') res.redirect('/');
    });
});

/****************************************************************************
* Misc
****************************************************************************/
app.get("/unlink", async function(req,res){
    console.log("[?][unlink] hello");
    await initiateUnlink().then(function(result){
        console.log("[?][unlink] returned from initiateUnlink");
        if(result!='success') res.json(JSON.stringify({result:result}));
        else res.redirect('/');
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

/****************************************************************************
*                               Establish PSK                               *
****************************************************************************/
// First attempt to find match
async function firstAttemptEstablish(userIP, relaySessionKey){
    return new Promise(async(resolve,reject)=>{
        if(relaySessionKey!=null){
            await readPINs().then(function (pins){
                if(pins == 'no-userpin') resolve('no user pin');
                else if(pins.length<2) resolve('no-target-pin');
                else{
                    const userPIN = pins[0];
                    const targetPIN = pins[1];
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
                }
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
function requestNewData(){
    return new Promise(async (resolve,reject) => {
        await readPSK().then(async function(result) { 
            if(result==null) {
                resolve("psk-err"); 
            }
            else {
                var peerSessionKey = result;
                var relaySessionKey;
                await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});
                var targetPIN;
                await readTargetPIN().then(function(result){
                    if(result!=null){
                        targetPIN=result;
                        var encrypted_PIN= h.encrypt(targetPIN,relaySessionKey);
                        request.post(SERVER_URI+'retrieve')
                        .json({ pin : encrypted_PIN})
                        .on('data', function(data) {
                            if(data == "RSK Concurrency Error") resolve("rsk-err");
                            var arr = JSON.parse(data);
                            var resultsArr = [];
                            arr.forEach(entry =>{
                                if (entry=='EOF') { resolve("empty"); }
                                else {
                                    var checksum = entry.checksum;
                                    var encrypted_data = entry.data;
                
                                    // *** CHECKSUM VERIFICATION
                                    var verification = crypto.createHash('sha256').update(peerSessionKey+encrypted_data).digest('hex');
                                    if(verification == checksum){
                                        // *** END-TO-END ENCRYPTION
                                        //console.log("Trying to decrypt:",encrypted_data,"with key:",peerSessionKey.toString('hex'));
                
                                        // TRY TO DECRYPT, IF BAD DECRYPT NEED TO UPDATE THE PSK!
                                        try {
                                            var decrypted_data = h.decrypt(encrypted_data,peerSessionKey);
                                        } catch(err){
                                            console.log("[!][requestNewData] Outdated entries with old PSK detected. These will be deleted next run. Skipping for now...");
                                            return;
                                        }
                                        var json_data = JSON.parse(decrypted_data);
                                        resultsArr.push(json_data);
                                        console.log("[*][requestNewData] New entry from patient: ",json_data);
                                    }
                                    else {
                                        console.log("[!!][requestNewData] Failed checksum verification!",json_data);
                                    }
                                }
                            });
                            resolve(resultsArr);
                        });
                    }
                    else resolve("no-targetpin");
                }); 
            }
        });
    });
}

async function sendData(peerSessionKey, datajson){
    return new Promise(async (resolve,reject) => {
        await readPSK().then(async function(result) { 
            if(result==null) {
                resolve("psk-err"); 
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
                        console.log("[!][sendData] RSK establishment failure.");
                        resolve("rsk-err");
                    }
                    else {
                        resolve("success");
                    }
                })
                .on('error', function(){
                    resolve("server-err");
                });
            }
        });
    });
}
/****************************************************************************
*                             UserPrefs Get/Set                             *
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
            resolve();
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
            else { 
                userPIN = (result.value).toString();
                resolve((result.value).toString());
            }
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
            else console.log("[*][saveTargetPIN] Updated target PIN:",pin);
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

function readPINs(){
    return new Promise(async(resolve,reject)=> {
        var userIP;
        var results = [];
        await store.KV.Read(userPreferences.DataSourceID, "userPIN").then(async(result) => {
            if(result.value=='' || result.value == null) userIP = null;
            else userIP = (result.value).toString();
            if(userIP!=null){
                results.push(userIP); // index 0 is userpin now
                await store.KV.Read(userPreferences.DataSourceID, "targetPIN").then((result) => {
                    console.log('Reading target:',result.value);
                    if(!(result.value=='' || result.value == null)) results.push(result.value); // index 1 is targetpin

                    console.log('[*][readPINs] Read pins:',results);
                    resolve(results);
                });
            }
            else resolve('no-userpin');
        }).catch((err) => {
            resolve('error');
        });
    });
}

function readPrivacyPrefs(){
    return new Promise(async(resolve,reject)=>{
        var results = [];
        store.KV.Read(userPreferences.DataSourceID, "ttl").then((result) => {
            results.push(result.value);
            resolve(results);
        }).catch((err) => {
            console.log("[!][readPrivacyPrefs] Read Error", err);
            resolve('error');
        });
    });
}
/****************************************************************************
*                                   Unlink                                  *
****************************************************************************/
async function softUnlink(res,err){
    await savePSK(null).then(async function (){
        res.json(JSON.stringify({established:false,err:err})); 
    });
}

async function initiateUnlink(){
    return new Promise(async(resolve,reject)=>{
        await readPSK().then(async function(result){
            if(result!=null){
                await sendData(result,JSON.stringify({type:'UNLNK'})).then(async function(result){
                    if(result=='success'){
                        await savePSK(null).then(async function(){
                            await saveTargetPIN(null).then(function(){
                                resolve('success');
                            });
                        });
                    } else resolve('no-send');
                });
            } else resolve("no-psk");
        });
    });
}

async function followUnlink(){
    return new Promise(async(resolve,reject)=>{
        await readPSK().then(async function(result){
            if(result!=null){
                await savePSK(null).then(async function(){
                    await saveTargetPIN(null).then(function(){
                        resolve('success');
                    });
                });
            }
        });
    });
}

//when testing, we run as http, (to prevent the need for self-signed certs etc);
if (DATABOX_TESTING) {
    console.log("[Creating TEST http server]", DATABOX_PORT);
    http.createServer(app).listen(DATABOX_PORT);
} else {
    console.log("[Creating https server]", DATABOX_PORT);
    const credentials = databox.GetHttpsCredentials();
    https.createServer(credentials, app).listen(DATABOX_PORT);
}