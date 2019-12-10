var https = require("https");
var http = require("http");
var express = require("express");
var bodyParser = require("body-parser");
var databox = require("node-databox");

const DATABOX_ARBITER_ENDPOINT = process.env.DATABOX_ARBITER_ENDPOINT || 'tcp://127.0.0.1:4444';
const DATABOX_ZMQ_ENDPOINT = process.env.DATABOX_ZMQ_ENDPOINT || "tcp://127.0.0.1:5555";
const DATABOX_TESTING = !(process.env.DATABOX_VERSION);
const PORT = process.env.port || '8080';

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

const bloodPressureReading = {
    ...databox.NewDataSourceMetadata(),
    Description: 'BP reading',
    ContentType: 'application/json',
    Vendor: 'Databox Inc.',
    DataSourceType: 'bloodPressureReading',
    DataSourceID: 'bloodPressureReading',
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
    store.RegisterDatasource(bloodPressureReading);
    console.log("registered bp");

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

// how to read two things
app.get("/ui", function (req, res) {
    store.KV.Read(heartRateReading.DataSourceID, "hrreading").then((result) => { //result1 untrackable ?
        console.log("result:", heartRateReading.DataSourceID, result);
        return store.KV.Read(bloodPressureReading.DataSourceID, "bpreading");
    }).then((result2) => {
        res.render('index', { hrreading: result.value, bpreading: result2.value });
    }).catch((err) => {
        console.log("get error", err);
        res.send({ success: false, err });
    });
});

// Write new HR reading into datastore -- POST
app.post('/ui/setHR', (req, res) => {

    const hrreading = req.body.hrreading;

    return new Promise((resolve, reject) => {
        store.KV.Write(heartRateReading.DataSourceID, "config", 
                { key: heartRateReading.DataSourceID, value: hrreading }).then(() => {
            console.log("Wrote new HR: ", hrreading);
            resolve();
        }).catch((err) => {
            console.log("HR write failed", err);
            reject(err);
        });
    }).then(() => {
        res.send({ success: true });
    });
});

app.post('/ui/setBP', (req, res) => {

    const bpreading = req.body.bpreading;

    return new Promise((resolve, reject) => {
        store.KV.Write(bloodPressureReading.DataSourceID, "config", { key: bloodPressureReading.DataSourceID, value: bpreading }).then(() => {
            console.log("Wrote new BP: ", bpreading);
            resolve();
        }).catch((err) => {
            console.log("BP write failed", err);
            reject(err);
        });
    }).then(() => {
        res.send({ success: true });
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
