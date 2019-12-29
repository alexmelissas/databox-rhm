var https = require("https");
var http = require("http");
var express = require("express");
var bodyParser = require("body-parser");
var databox = require("node-databox");

const DATABOX_ARBITER_ENDPOINT = process.env.DATABOX_ARBITER_ENDPOINT || 'tcp://127.0.0.1:4444';
const DATABOX_ZMQ_ENDPOINT = process.env.DATABOX_ZMQ_ENDPOINT || "tcp://127.0.0.1:5555";
const DATABOX_TESTING = !(process.env.DATABOX_VERSION);
const PORT = process.env.port || '8080';
const SERVER_IP = 'http://3.8.209.36';
const SERVER_PORT = '3000';
const SERVER_URI = SERVER_IP+':'+SERVER_PORT+'/';
const request = require('request');

const store = databox.NewStoreClient(DATABOX_ZMQ_ENDPOINT, DATABOX_ARBITER_ENDPOINT, false);

//get the default store metadata
const metaData = databox.NewDataSourceMetadata();

// Define a datastore with specified schema 
// for saving heart-rate key/value data
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

//create store schema for an actuator (i.e a store that can be written to by an app)
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

///now create our stores using our clients.
store.RegisterDatasource(heartRateReading).then(() => {
    console.log("registered hr");
    store.RegisterDatasource(bloodPressureLowReading);
    console.log("registered bpl");
    store.RegisterDatasource(bloodPressureHighReading);
    console.log("registered bph");
    //now register the actuator
    return store.RegisterDatasource(alexTestActuator)
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
       bplResult = result2;
       return store.KV.Read(bloodPressureLowReading.DataSourceID, "value");
    }).then((result3) => {
        console.log("result3:", bloodPressureLowReading.DataSourceID, result3.value);
        res.render('index', { hrreading: hrResult.value, bphreading: bplResult.value, bplreading: result3.value });
    }).catch((err) => {
        console.log("get error", err);
        res.send({ success: false, err });
    });
}

// Read data from datastores
app.get("/ui", function (req, res) {
    readAll(req,res);
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
    // 1. POST it to the server with full data (time, blah, blah)
    // 2. server will send it to redis and then read from redis based on privacy settings
    // 3. then send privacy-filtered data to caretaker

        // function callback(error, response, body){
        //     if (!error && response.statusCode == 200){
        //         console.log(body);
        //     }
        // }
        request.post(SERVER_URI+'setHR').form({message:hrreading});
        res.redirect('/ui');
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
        request.post(SERVER_URI+'setBPL').form({message:bplreading});
        res.redirect('/ui');
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
        request.post(SERVER_URI+'setBPH').form({message:bphreading});
        res.redirect('/ui');
    });
});

app.get("/status", function (req, res) {
    res.send("active");
});

//when testing, we run as http, (to prevent the need for self-signed certs etc);
if (DATABOX_TESTING) {
    console.log("[Creating TEST http server]", PORT);
    http.createServer(app).listen(PORT);
} else {
    console.log("[Creating https server]", PORT);
    const credentials = databox.GetHttpsCredentials();
    https.createServer(credentials, app).listen(PORT);
}
