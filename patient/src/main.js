/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
*      (1)                        CORE SETUP                                *
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
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

const h = require('./helpers.js');
/*--------------------------------------------------------------------------*
|   Circumvent self-signed certificate on relay
---------------------------------------------------------------------------*/
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
/*--------------------------------------------------------------------------*
|   Express Webserver Setup
---------------------------------------------------------------------------*/
//Setup webserver to serve driver endpoints
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(express.urlencoded());
app.set('views', './views');
app.set('view engine', 'ejs');

//Allow serving static files from views directory (ajax and css stuff)
app.use(express.static('views'));
/*--------------------------------------------------------------------------*
|   Databox Server Setup
---------------------------------------------------------------------------*/
const DATABOX_ARBITER_ENDPOINT = process.env.DATABOX_ARBITER_ENDPOINT || 'tcp://127.0.0.1:4444';
const DATABOX_ZMQ_ENDPOINT = process.env.DATABOX_ZMQ_ENDPOINT || "tcp://127.0.0.1:5555";
const DATABOX_TESTING = !(process.env.DATABOX_VERSION);
const DATABOX_PORT = process.env.port || '8080';

//Databox: when testing run as http
if (DATABOX_TESTING) {
    console.log("[Creating TEST http server]", DATABOX_PORT);
    http.createServer(app).listen(DATABOX_PORT);
} else {
    console.log("[Creating https server]", DATABOX_PORT);
    const credentials = databox.GetHttpsCredentials();
    https.createServer(credentials, app).listen(DATABOX_PORT);
}
/*--------------------------------------------------------------------------*
|   Datastores Setup
---------------------------------------------------------------------------*/
const store = databox.NewStoreClient(DATABOX_ZMQ_ENDPOINT, DATABOX_ARBITER_ENDPOINT, false);

//Get the default store metadata
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

//Stores BP measurements
const bloodPressureReading = {
    ...databox.NewDataSourceMetadata(),
    Description: 'BP reading',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'bloodPressureReading',
    DataSourceID: 'bloodPressureReading',
    StoreType: 'ts/blob',
}

//Stores HR measurements
const heartRateReading = {
    ...databox.NewDataSourceMetadata(),
    Description: 'HR reading',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'heartRateReading',
    DataSourceID: 'heartRateReading',
    StoreType: 'ts/blob',
}

//Stores messages
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
    store.RegisterDatasource(messages);
    console.log("Stores registered");
    //Register the actuator
    return store.RegisterDatasource(srhmPatientActuator);
}).catch((err) => { console.log("error registering patient config datasource", err) }).then(() => {
    console.log("registered srhmPatientActuator, observing", srhmPatientActuator.DataSourceID);
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

// Avoid crashes on random exceptions
process.on('uncaughtException', function (err) {
    console.log('[!][Uncaught Exception]',err);
}); 
/*--------------------------------------------------------------------------*
|   Relay Server Info
---------------------------------------------------------------------------*/
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
/*--------------------------------------------------------------------------*
|   User Data - Security & Cryptography Setup
---------------------------------------------------------------------------*/
const userType = 'patient';
newMessages = 0; //for updating the notification

// Create my side of the ECDH
const ecdh = crypto.createECDH('Oakley-EC2N-3');
const publickey = ecdh.generateKeys();

// Secure association establishment attempt variables
var msDelay = 2500;
var findMatchAttempts = 5;

/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
||      (2)                   UI NAVIGATION                                ||
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
app.get("/settings", function(req,res){res.render('settings');});
app.get("/hr", function(req,res){res.render('hr');});
app.get("/bp", function(req,res){res.render('bp');});
app.get("/msg", function(req,res){res.render('msg');});
app.get("/main", function(req,res){res.render('index');});
app.get("/", function (req, res) {res.redirect("/ui");});
// Initial Loading of UI at /ui
app.get("/ui", function (req, res) {res.render('index');});


/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
||      (3)             ESTABLISH SECURE ASSOCIATION                       ||
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
// Establish the secure association with the caretaker
app.get('/establish', async (req,res)=>{
    var socket;
    socket = tls.connect(TLS_PORT, SERVER_IP, tlsConfig, async () => {
        var relaySessionKey;
        console.log('[*][Establish] TLS connection established and ', socket.authorized ? 'authorized' : 'unauthorized');

        //Use TURN daemon on relay to discover my public IP
        await discoverIP().then(function(result){userIP = result}).catch((err)=>{console.log(err);});
    
        //Establish shared session key with ECDH and HKDF
        await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});

        //Initiate the establishment attempts process
        await firstAttemptEstablish(userIP, relaySessionKey).then(async function(result){
            switch(result){
                case "PSK Error": console.log('[!][Establish] Match found, error in key establishment.'); softUnlink(res,result); break;
                case "no match": console.log('[!][Establish] No match found.'); softUnlink(res,result); break;
                case "no target pin": console.log('[!][Establish] No target PIN.'); softUnlink(res,result); break;
                case "no user pin": console.log('[!][!][Establish] No user PIN.'); softUnlink(res,result); break;
                case "other error": console.log('[!][Establish] Arbitrary error.'); softUnlink(res,result); break;
                default: 
                    await savePSK(result).then(async function(savePSKresult){
                        if(savePSKresult=="success") {
                            const success = '[+][Establish] Established PSK: '+result.toString('hex');
                            console.log(success);
                            res.json(JSON.stringify({established:true}));
                        }
                    }).catch((err)=>{console.log("[!][Establish]",err); softUnlink(res,err);});
            }
        }).catch((err) => { console.log("[!][Establish]", err); softUnlink(res,err);});
    });
    
    // Avoid crashes on server connection errors
    socket.on('error',function(err){
        console.log("[!][Connection] Error connecting to server.");
        softUnlink(res,'connection-error');
    });
});

// Initiate the attempts process to find a match
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
                        // Encrypt user details with RSK
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
                              }
                              else if(data != 'AWAITMATCH'){
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

// Repeatable process to re-check if server has found a match yet
async function attemptMatch(attempts, ecdh, publickey, userType,userPIN,targetPIN){
    return new Promise(async(resolve,reject) => {
        while(attempts>0) {
            attempts--;
            var relaySessionKey;
            await h.establishRelaySessionKey(ecdh, publickey).then(function(result){
                relaySessionKey=result;
            });
            var encrypted_userType = h.encrypt(userType,relaySessionKey); // Could use try/catch here
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

// Wait before re-attempting, to not flood the server
async function wait(ms) {
    return new Promise((resolve,reject) => {
        setTimeout(resolve, ms);
    });
}


/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
||      (4)                   DATA HANDLING                                ||
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
/*--------------------------------------------------------------------------*
|   Add new data to datastore, encrypt,format and send it to server
---------------------------------------------------------------------------*/
// Write new data readings / messages into datastore and send to server
app.post('/addData', async (req, res) => {

    const type = req.body.type;
    const datetime = Date.now();
    var targetpin, userpin, filter, subj, txt;
    var ttl, datajson;

    await readPrivacyPrefs().then(function(result){
        if(result!='error') {
            ttl = result[0];
            filter = result[1];
        }
        else res.json(JSON.stringify({error:"no-priv"})); // no privacy settings no send data
    });

    var expiry = h.expiryCalc(ttl,datetime);

    await readTargetPIN().then(function(result){
        if(result!=null){
            targetpin = result;
        } else res.json(JSON.stringify({error:"no-targetpin"})); // no targerPIN no send data
    });

    await readUserPIN().then(function(result){
        if(result!=null){
            userpin = result;
        } else res.json(JSON.stringify({error:"no-userpin"})); // no userPIN no send data
    });

    // Shape the final JSON to be sent based on type of data and TTL/Filtering 
    switch(type){
        case 'HR':
            const hr = req.body.hr;
            var desc = '-';
            if(filter == 'desc') {
                await readAge().then(function(result){
                    if(result=='error' || result==undefined) console.log("[FATAL] No age for description");
                    else desc = h.valueToDesc(type,JSON.stringify({hr:hr,age:result}));
                    
                    datajson = JSON.stringify({type: type, targetpin:targetpin, datetime: datetime, 
                        filter: filter, desc: desc, expiry:expiry});
                });
            }
            else datajson = JSON.stringify({type: type, targetpin:targetpin, datetime: datetime, 
                filter: filter, hr: hr, expiry:expiry});
            break;
        
        case 'BP':
            const bps = req.body.bps;
            const bpd = req.body.bpd;
            var desc = null;
            if(filter == 'desc') { 
                desc = h.valueToDesc(type,JSON.stringify({bps:bps,bpd:bpd}));
                datajson = JSON.stringify({type: type, targetpin:targetpin, datetime: datetime, 
                    filter:filter, desc:desc, expiry:expiry});
            }
            else datajson = JSON.stringify({type: type, targetpin:targetpin, datetime: datetime, 
                filter:filter, bps: bps, bpd: bpd, expiry:expiry});
            break;
        
        case 'MSG':
            subj = req.body.subj;
            txt = req.body.txt;
            if(subj==undefined || txt==undefined) res.json(JSON.stringify({error:"no-subjtxt"}));
            // MSGs have userpin as well, to determine sender (they're 2-way)
            datajson = JSON.stringify({type: type, userpin: userpin, targetpin:targetpin, datetime: datetime, 
                subj:subj, txt:txt, expiry:expiry});
            break;
    }

    // Store the data and send it to server
    return new Promise(async () => {
        await readPSK().then(async function(psk){
            var error;
            if(psk!=null) {
                await sendData(psk,datajson).then(function(result){
                    switch(result){
                        case 'psk-err': error = 'Unpaired.'; break;
                        case 'rsk-err': error = 'Server concurrency issue. Please try again.'; break;
                        case 'server-err': error ='Internal server error.'; break;
                        case 'userpin-err': error ='No user PIN.'; break;
                        case 'success': error = null; break;
                        default: error=null;
                    }
                }).catch((err)=>{ error = err; });
            } else error = 'Unpaired.';

            if(error!=null){
                console.log("[!][addData]",error);
                res.json(JSON.stringify({error:error}));
            }
            else if(error==null){
                const dataSourceID = getDatasourceID(type);

                store.TSBlob.Write(dataSourceID, datajson).then(async() => {
                    console.log("[*][addData] Wrote new "+type+":", datajson);
                    res.json(datajson);
                }).catch((err)=>{
                    console.log("[!][addData] Write failure:",err);
                    res.json(JSON.stringify({error:err}));
                });
            }
        });

    });
});

// Use the 2-layer encryption scheme to send the new data to server
async function sendData(peerSessionKey, datajson){
    return new Promise(async (resolve,reject) => {
        await readPSK().then(async function(result) { 
            if(result==null) {
                resolve("psk-err"); 
            }
            else {
                // End-to-end encryption
                var encrypted_datajson = h.encryptBuffer(datajson,peerSessionKey);
                // Checksums for integrity
                var checksum = crypto.createHash('sha256').update(peerSessionKey+encrypted_datajson).digest('hex');
                
                var relaySessionKey;
                await h.establishRelaySessionKey(ecdh, publickey).then(function(result){relaySessionKey=result;});
                await readUserPIN().then(function(result){
                    if(result==null) resolve('userpin-err');
                    else{
                        var encrypted_PIN = h.encrypt(result,relaySessionKey);
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
                
            }
        });
    });
}
/*--------------------------------------------------------------------------*
|   Request data from server, decrypt,parse and store it to datastore
---------------------------------------------------------------------------*/
//Read latest HR, BP values and number of new messages for notification badge
app.get('/readLatest',async (req,res)=>{
    var targetPIN, latestHR, latestBP;
    await readTargetPIN().then(async function(result){
        if(result!=null) {
            targetPIN = result;
            store.TSBlob.Latest(getDatasourceID('HR')).then((result) => {
                if(result==[] || result[0]==undefined || result[0].data==undefined) latestHR = 'N/A';
                else{
                    const entry = result[0].data;
                    if (entry.targetpin!=targetPIN) latestHR = 'N/A';
                    if(entry.desc!=undefined) latestHR = entry.desc;
                    else if(entry.hr!=undefined) latestHR = entry.hr;
                    else latestHR = 'N/A';
                }
                return store.TSBlob.Latest(getDatasourceID('BP'));
            }).then((result) => {
                if(result==[] || result[0]==undefined || result[0].data==undefined) latestBP = 'N/A';
                else{
                    const entry = result[0].data;
                    if (entry.targetpin!=targetPIN) latestBP = 'N/A';
                    else if(entry.desc!=undefined) latestBP = entry.desc;
                    else if(entry.bps!=undefined && entry.bpd!=undefined) latestBP = entry.bps + ':' + entry.bpd;
                    else latestBP = 'N/A';
                }
                res.json(JSON.stringify({hr:latestHR,bp:latestBP, msgs: newMessages}));
            }).catch((err) => {
                console.log("[!][ReadAll] Read Error:", err);
                res.json({ error: err});
            });
        }
        else {
            res.json({ error: 'no-tpin'});
        }
    });
});

// Handle refresh button (force check on server for new data)
app.get('/refresh', async (req,res)=>{
    newMessages = 0;
    await requestNewData().then(async function(result){
        switch(result){
            case "empty": console.log("[!][refresh] Nothing found"); res.redirect('/'); break;
            case "psk-err": console.log("[!][refresh] No PSK!"); res.redirect('/'); break;
            case "rsk-err": console.log("[!][refresh] RSK establishment failure. No attempt removed."); res.redirect('/'); break;
            case "no-targetpin": console.log("[!][refresh] No targetPIN."); res.redirect('/'); break;
            default: 
                await readNewData(result).then(function(result){
                    if(result=='unlinked') res.redirect('ui');
                });
        }
    });
    res.end();
});

// Request new data from server
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
                            arr.forEach(encrypted_entry =>{
                                if (encrypted_entry=='EOF') { resolve("empty"); }
                                else {

                                    var entry;
                                    try { 
                                        entry = JSON.parse(h.decrypt(encrypted_entry,relaySessionKey));
                                    } catch(err){
                                        console.log("[!][requestNewData] Fatal RSK error...");
                                        return;
                                    }

                                    var checksum = entry.checksum;
                                    var encrypted_data = entry.data; 
                
                                    // Checksum verification
                                    var verification = crypto.createHash('sha256').update(peerSessionKey+encrypted_data).digest('hex');
                                    if(verification == checksum){
                                        // End-to-end Decryption
                                        try {
                                            var decrypted_data = h.decrypt(encrypted_data,peerSessionKey);
                                        } catch(err){
                                            console.log("[!][requestNewData] Outdated entries with old PSK detected. These will be deleted next run. Skipping for now...");
                                            return;
                                        }
                                        var json_data = JSON.parse(decrypted_data);
                                        resultsArr.push(json_data);
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

// Handles each entry received from the caretaker
function readNewData(dataArr){
    return new Promise(async (resolve,reject)=>{
        if(dataArr!='empty'){
            for (const entry of dataArr) {
                if(entry.type=='UNLNK') {
                    await followUnlink().then(function(){
                        resolve('unlinked');
                    });
                }
                else await saveData(entry);
            }
            resolve('success');
        }
        else resolve('empty')
    });
}

// Saves the entries to corresponding datastores
function saveData(data){
    return new Promise(async(resolve, reject) => {
        if(!(h.isJSON(data))) resolve('not-json');

        const type = data.type;
        const dataSourceID = getDatasourceID(type);

        store.TSBlob.Write(dataSourceID, data).then(() => {
            console.log("[*][saveData] Wrote new "+type+":", data);
            if(type=='MSG') newMessages+=1; // For notification badge :)
            resolve("success");
        }).catch((err) => {
            console.log(type,"[*][saveData] Write failure:", err);
            resolve('err');
        });
    });
}


/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
||      (5)                 LOAD UI WITH DATA                              ||
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
/*--------------------------------------------------------------------------*
|   Read data from specified datastore
---------------------------------------------------------------------------*/
// Respond to request for reading the data in specified datastore
app.post('/readDatastore', async (req,res)=>{
    const type = req.body.type;
    const page = req.body.page;

    var targetpin; // No targetPIN no nothing
    await readTargetPIN().then(function(result){
        if(result!=null) targetpin = result;
        else res.json(JSON.stringify({error:'no-tpin'}));
    });

    var userpin; // No userPIN no nothing
    await readUserPIN().then(function(result){
        if(result!=null) userpin = result;
        else res.json(JSON.stringify({error:'no-upin'}));
    });

    await getDatastore(type,page,userpin,targetpin).then((records)=>{
        if(records=='empty') { 
            console.log("[-][saveData>readDS] Empty");
            res.json(JSON.stringify({empty:1}));
        }
        else if (records == 'error') {
            console.log("[!][saveData>readDS] Error");
            res.json(JSON.stringify({error:'read-err'}));
        }
        else{
            res.json(JSON.stringify(records));
        }
    });
});

// Populate array to return with non-expired datastore entries
function getDatastore(type,page,userpin,targetpin){
    return new Promise(async (resolve)=>{
        const dataSourceID = getDatasourceID(type);
        const recordsRequested = page * 10;
        store.TSBlob.LastN(dataSourceID,recordsRequested).then(async(results)=>{
            var records = [];
            var recordsRead = 0;
            results.forEach(function(entry){
                const json = entry.data;
                const type = json.type;
                const expiry = json.expiry;
                const tpin = json.targetpin;

                // Filter data, regarding whether they should be displayed or not;
                // Expired/Invalid checks
                if(Date.now()<expiry){
                    if(type=='MSG'){
                        const upin = json.userpin;
                        if(upin==targetpin && tpin==userpin // inbox
                            || upin==userpin && tpin==targetpin) //sent 
                                { recordsRead+=1; records.push(json); }
                    } else if(tpin == targetpin) { recordsRead+=1; records.push(json); }
                }
            });

            if(records.length==0) resolve('empty');
            else {
                const ordered_records = jsonArraySort(records,'datetime');
                const real_order = ordered_records.reverse();
                // Send acknowledgement of end of records (to know when to stop going forward)
                if(recordsRead<recordsRequested)real_order.push({eof:true});
                resolve(real_order);
            }
        }).catch((err)=>{resolve('error');});
    });
}
/*--------------------------------------------------------------------------*
|   Login/Singup Process
---------------------------------------------------------------------------*/
// Check if there is no current secure association
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

// Load establishment form with data and send to JS to open it
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

// Handle the input data from the form
app.post("/handleForm", async function(req,res){
    const tPIN = req.body.targetPIN;
    await saveTargetPIN(tPIN).then(function (result){
        if(result=='success'){
            res.json(JSON.stringify({result:true}));
        } else res.json(JSON.stringify({result:false}));
            
    });
});

// Pass userPIN and targetPIN to JS for comparisons 
// => (MSG in/out separation, autofill after failed establish)
app.get('/getPINs', async(req,res)=>{
    await readPINs().then(async function(result){
        if(result=='no-userpin'){ // No userPIN (should never be the case but hey)
            console.log('[!][getPINs] No user PIN?!')
            res.json(JSON.stringify({error:'err-userpin'}));
        }

        else if (result=='error' || result==null){
            console.log('[!][getPINs] Arbitrary read PINs error, not opening form.')
            res.json(JSON.stringify({error:'err-read'}));
        }

        else if (result.length == 1){ // No targetPIN to fill in
            const userPIN = result[0];
            res.json(JSON.stringify({hasTargetPIN:false,userpin:userPIN}));
        }

        else {
            const userPIN = result[0];
            const targetPIN = result[1];
            res.json(JSON.stringify({hasTargetPIN:true,userpin:userPIN,targetpin:targetPIN}));
        }
    });
});

// TESTING ONLY - delete user PIN (basically hard reset)
app.get('/deleteUserPIN', async function(req,res){
    await deleteUserPIN().then(function (result){
        if(result!='error') res.redirect('/');
    });
});


/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
||      (6)                  LINK STATUS/UNLINK                            ||
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
// Respond to unlink request
app.get("/unlink", async function(req,res){
    console.log("[?][unlink] hello");
    await initiateUnlink().then(function(result){
        console.log("[?][unlink] returned from initiateUnlink");
        if(result!='success') res.json(JSON.stringify({result:result}));
        else res.render('index');
    });
});

// Check if there is a current association
app.get("/linkStatus", async function (req, res) {
    var linkStatus;
    await readPSK().then(function(result){
        if(result!=null) linkStatus = 1;
        else linkStatus = 0;
        res.json(JSON.stringify({link: linkStatus}));
    });
});

// Soft-Unlink (local-only): just delete the PSK.
async function softUnlink(res,err){
    await savePSK(null).then(async function (){
        res.json(JSON.stringify({established:false,err:err})); 
    });
}

// Nullify local link, send the UNLNK message to relay
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

// Comply when the association is already severed on the other end. 
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


/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
||      (7)                  USERPREFS - GET/SET                           ||
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
// Save PSK to datastore
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

// Read PSK from datastore
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

// Create and save a new random User PIN to datastore
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

// Read User PIN from datastore
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

// TESTING ONLY - delete user PIN (basically mass reset)
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

// Save Target PIN to datastore
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

// Read Target PIN from datastore
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

// Read User and Target PINs from datastore
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

// Save user age to datastore
app.post('/saveAge', async (req,res)=>{
    const age = req.body.age;
    await saveAge(age).then(function(result){
        if(result=='error' || result==undefined || result!=null) res.json(JSON.stringify({error:true}));
        else res.json(JSON.stringify({success:true}));
    })
});
function saveAge(age){
    return new Promise(async(resolve,reject)=>{
        store.KV.Write(userPreferences.DataSourceID, "age", { value: age}).then(function(){
            resolve('ok');
        }).catch((err) => {
            resolve("error");
        });
    });
}

// Read user age from datastore
app.get('/readAge', async (req,res)=>{
    await readAge().then(function(result){
        if(result=='error' || result==undefined || result==null) res.json(JSON.stringify({error:true}));
        else res.json(JSON.stringify({age:result}));
    });
});
function readAge(){
    return new Promise(async(resolve,reject)=>{
        store.KV.Read(userPreferences.DataSourceID, "age").then((result) => {
            resolve(result.value);
        }).catch((err) => {
            resolve('error');
        });
    });
}

// Update settings in datastore
app.post("/saveSettings", async function(req,res){
    const ttlSetting = req.body.ttl;
    const filterSetting = req.body.filter;
    
    store.KV.Write(userPreferences.DataSourceID, "ttl", { value: ttlSetting }).then(() => {
        store.KV.Write(userPreferences.DataSourceID, "filter", { value: filterSetting }).then(()=>{
            res.json(JSON.stringify({success:true}));
        }).catch((err) => {
            console.log("FLTR settings update failed", err);
            res.json(JSON.stringify({error:true}));
        });
    }).catch((err) => {
        console.log("TTL/FLTR settings update failed", err);
        res.json(JSON.stringify({error:true}));
    });
});

// Get current settings from UI
app.get("/readSettings", async function(req,res){
    await readPrivacyPrefs().then(async function(result){
        if(result!='error'){
            const ttl=result[0];
            const filter=result[1];
            await readAge().then(function(age){
                if(age!='error') res.json(JSON.stringify({ttl:ttl, filter:filter, age:age, error:0}));
                else res.json(JSON.stringify({ttl:ttl, filter:filter, error:'no-age'}));
            });
        }
        else res.json(JSON.stringify({error:'no-priv'}));
    }).catch((err)=>{res.json(JSON.stringify({error:'no-priv'}));});
});

// Read privacy settings from datastore
function readPrivacyPrefs(){
    return new Promise(async(resolve,reject)=>{
        var results = [];
        store.KV.Read(userPreferences.DataSourceID, "ttl").then((result) => {
            results.push(result.value);
            return store.KV.Read(userPreferences.DataSourceID, "filter");
        }).then((result) => {
            results.push(result.value);
            resolve(results);
        }).catch((err) => {
            console.log("[!][readPrivacyPrefs] Read Error", err);
            resolve('error');
        });
    });
}

// Use TURN to discover IP address (NAT/Firewall traversal)
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


/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
||      (8)                       HELPERS                                  ||
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
// Get datasource ID
function getDatasourceID(type){
    var dataSourceID;
    switch(type){
        case 'HR': dataSourceID = heartRateReading.DataSourceID; break;
        case 'BP': dataSourceID = bloodPressureReading.DataSourceID; break;
        case 'MSG': dataSourceID = messages.DataSourceID; break;
        default: dataSourceID = null; break;
    }
    return dataSourceID;
}

// Sort a json array based on given attribute
// Based on: https://stackoverflow.com/questions/21131224/sorting-json-object-based-on-attribute
function jsonArraySort(array, key) {
    return array.sort(function(a, b) {
        return ((a[key] < b[key]) ? -1 : ((a[key] > b[key]) ? 1 : 0));
    });
}