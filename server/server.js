const port =3000; //idk why

var express = require('express');
var app = express();

var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

var redis = require("ioredis");
var cluster = new redis.Cluster( [
        {
        port      : 6379,
        host : 'databox-rhm-redis-0001-001.becsin.0001.euw2.cache.amazonaws.com'
        },
        {
        port : 6379,
        host : 'databox-rhm-redis-0001-002.becsin.0001.euw2.cache.amazonaws.com'
        },
        {
        port : 6379,
        host : 'databox-rhm-redis-0001-003.becsin.0001.euw2.cache.amazonaws.com'
        }
]);

//client.on("error",function(err){
//      console.log("Redis error " + err);
//});

app.get('/', (req,res)=>{
        cluster.get('hr',function(err,reply){
                cluster.get('bpl',function(err1,reply1){
                        cluster.get('bph',function(err2,reply2){
                                var response = "HR: "+reply+"\nBPH: "+reply2+"\nBPL: "+reply1;
                                console.log("New connection opened.\n"+response);
                                res.send(response);
                        });
        //res.send(reply);
        //console.log('new connection accepted, redis = '+ reply);
                });
        });
});

app.post('/setHR', (req,res) => {
        var message = req.body.message;
        cluster.set('hr',message);
        cluster.get('hr',function(err,reply){
                res.send(reply);
                console.log('Wrote HR: '+ reply);
        });
});

app.post('/setBPL', (req,res) => {
        var message = req.body.message;
        cluster.set('bpl',message);
        cluster.get('bpl',function(err,reply){
                res.send(reply);
                console.log('Wrote BPL: '+ reply);
        });
});

app.post('/setBPH', (req,res) => {
        var message = req.body.message;
        cluster.set('bph',message);
        cluster.get('bph',function(err,reply){
                res.send(reply);
                console.log('Wrote BPH: '+ reply);
        });
});

app.listen(port, () => console.log('Server setup on port 3000'));