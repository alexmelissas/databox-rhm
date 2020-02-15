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

const SERVER_IP = '18.130.114.63';
const TLS_PORT = 8000;
const SERVER_URI = "https://"+SERVER_IP+":"+TLS_PORT+"/";
const TURN_USER = 'alex';
const TURN_CRED = 'donthackmepls';

// >> IT CAN'T READ THE FILE?
 const tlsConfig = {
     ca: [ fs.readFileSync('client.crt') ]
   };

var iceConfig = {"iceServers": [
    {"url": "stun:stun.l.google.com:19302"},
    {"url":"turn:"+TURN_USER+"@"+SERVER_IP, "credential":TURN_CRED}
  ]};

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
* Communication with Signalling Server
****************************************************************************/

//set up webserver to serve driver endpoints
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.set('views', './views');
app.set('view engine', 'ejs');

app.get("/", function (req, res) {
    res.redirect("/ui");
});

//Read latest HR and BP values from datastores
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
    }).catch((err) => {
        console.log("Read Error", err);
        res.send({ success: false, err });
    });
}

//Initial Loading of UI
app.get("/ui", function (req, res) {
    readAll(req,res);
});

//Try connecting with TLS to server
app.get('/ui/tryTLS',(req,res)=>{
    console.log("Trying TLS connection");
    socket = tls.connect(TLS_PORT, SERVER_IP, tlsConfig, () => {
        console.log('TLS connection established and ', socket.authorized 
            ? 'authorized' : 'unauthorized');
      
        //TODO: initial checks eg if already registered etc - stuff
      
        request.get(SERVER_URI+'charizard').on('data', function(d) {
          console.log(d);
          res.render('index', { hrreading: d, bphreading: 'times', bplreading: 'ahead' });
        });

        stun.request("turn:"+TURN_USER+"@"+SERVER_IP, (err, res) => {
          if (err) {
            console.error(err);
          } else {
            const { address } = res.getXorAddress();
            request.post(SERVER_URI+'requestKey')
                    .form({id:address})
                    .on('data', function(d) {
                      console.log(d);
                    }); 
          }
        });
      });
});

// Write new HR reading into datastore -- POST
app.post('/ui/setHR', (req, res) => {

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

app.post('/ui/setBPL', (req, res) => {

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

app.post('/ui/setBPH', (req, res) => {

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

app.get("/ui/settings", function(req,res){
    res.render('settings');
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
* Helper functions
****************************************************************************/

function randomToken() {
    return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}
