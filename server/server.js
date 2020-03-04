var express = require('express');
var app = express();
var https = require('https');
const crypto = require('crypto');
const HKDF = require('hkdf');
var mysql = require('mysql');

/****************************************************************************
* Server Setup
****************************************************************************/
const LISTENING_PORT = 8000;

var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

var tls = require('tls'),
    fs = require('fs'),
    colors = require('colors');

const options = {
  key: fs.readFileSync('cert/server.key'),
  cert: fs.readFileSync('cert/server.crt'),
  passphrase: 'alexdataboxrhm',
  rejectUnauthorized: true
};

const server = https.createServer(options,app);

var sqlConnection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'xelALQS17!',
  database : 'databoxrhm'
});

// var createTableQuery = "CREATE TABLE IF NOT EXISTS sessions (" + 
//                         "pin int(4) NOT NULL," + 
//                         "targetPIN int(4) DEFAULT NULL," +
//                         "publickey varchar(200) DEFAULT NULL," +
//                         "ip varchar(15) DEFAULT NULL," +
//                         "usertype varchar(50) DEFAULT NULL," +
//                         "date DATE DEFAULT NULL," +
//                         "PRIMARY KEY(pin)" +
//                        ");"

sqlConnection.connect(function(err) {
  if (err) throw err;
  console.log("Connected to MySQL database. \n\n");
});


server.listen(LISTENING_PORT, () =>{
    console.log('Server listening...');
});

// Established with ECDH and HKDF
var sessionKey;

server.emit('end', () =>{
  console.log("will delete entry");
});

/****************************************************************************
* Security / Sessions
****************************************************************************/
// Establish the session key using ECDH & HKDF
app.post('/establishSessionKey', (req,res) => {
  const publickey = Buffer.from(req.body.publickey);
  const bob = crypto.createECDH('Oakley-EC2N-3');
  const bobKey = bob.generateKeys();
  res.send(bobKey);
  const bobSecret = bob.computeSecret(publickey);
  
  var hkdf = new HKDF('sha256', 'saltysalt', bobSecret);
  hkdf.derive('info', 4, function(key) {
    console.log('+====================================+\nSessionKey: ', key.toString('hex'));
    sessionKey = key; // need to think where / how long to store this also what about many clients same time
  });
});

// Receive and decrypt client IP
app.post('/register', async (req,res) => {

  //TODO: handle null session key

  var client_type = decrypt(Buffer.from(req.body.type), sessionKey);
  var client_pin = decrypt(Buffer.from(req.body.pin), sessionKey);
  var target_pin = decrypt(Buffer.from(req.body.targetpin), sessionKey);
  var client_ip = decrypt(Buffer.from(req.body.ip), sessionKey);
  var client_public_key = decrypt(Buffer.from(req.body.publickey), sessionKey);

  if(isValidIP(client_ip)){

    // Check for duplicates
    var sql = "SELECT pin FROM sessions WHERE pin=" +client_pin+";";
    sqlConnection.query(sql, function(err, result) {
      if(err) throw err;

      //If duplicate PIN, delete the existing entry - because publickey/ip might have changed
      if (result.length > 0 ) {
        console.log("Duplicate PIN, updating entry.");
        plainSQL("DELETE FROM sessions WHERE pin="+client_pin+";");
      }

      // Store this session entry
      var sql = "INSERT INTO sessions (pin, targetPIN, publickey, ip, usertype) " 
          +"VALUES (" + client_pin + ","+ target_pin + ",'" + client_public_key + "','" + client_ip + "','" + client_type + "')";
      sqlConnection.query(sql, function (err, result) {   
        if (err) throw err;
        console.log('[+] Added session:\n      PIN:', client_pin, '\n     tPIN:', target_pin, '\n     Type:',client_type,
                    '\n      PBK:',client_public_key,'\n       IP:',client_ip, '\n');

        var match_pin, match_ip, match_pbk;

        checkForMatch(client_pin,target_pin,client_type).then((match) =>{
          if(match!=null){
            match_pin = match[0];
            match_ip = match[1];
            match_pbk = match[2];
          
            var encrypted_match_pin = encrypt(match_pin.toString(),sessionKey);
            var encrypted_match_ip = encrypt(match_ip.toString(),sessionKey);
            var encrypted_match_pbk = encrypt(match_pbk.toString(),sessionKey);

            console.log("[->] Sending:\n      PIN: "+encrypted_match_pin.toString('hex')+
                  "\n       IP: "+encrypted_match_ip.toString('hex')+"\n      PBK: "+encrypted_match_pbk.toString('hex')+'\n');

            plainSQL("DELETE FROM sessions WHERE pin="+target_pin+";");
            res.json({ pin: encrypted_match_pin, ip: encrypted_match_ip, pbk: encrypted_match_pbk });

            // CANCELLED?: Exchange the info to the peers so they can establish a sessionKey - they store it 'permanently' in datastores
            // OK for this peer he's connected.. what about the other peer? i have his IP sure, but how do i actually CONNECT
            // maybe enforce that he has to be connected (TCP) but then ok how do i find him while he's connected [session/cookies?]
          }
        }).catch(error => {
          console.log(error);
          if(error=="No match found"){
            res.send("AWAITMATCH");
          }
        });

      });
      
    });
  } else {
    console.log("Invalid IP");
    res.send('ERROR');
  }
});

app.post('/awaitMatch', async (req,res) => {
  var client_type = decrypt(Buffer.from(req.body.type), sessionKey);
  var client_pin = decrypt(Buffer.from(req.body.pin), sessionKey);
  var target_pin = decrypt(Buffer.from(req.body.targetpin), sessionKey);

  await checkForMatch(client_pin,target_pin,client_type).then((match) => {

    if(match.length==3){
      match_pin = match[0];
      match_ip = match[1];
      match_pbk = match[2];
    
      var encrypted_match_pin = encrypt(match_pin.toString(),sessionKey);
      var encrypted_match_ip = encrypt(match_ip.toString(),sessionKey);
      var encrypted_match_pbk = encrypt(match_pbk.toString(),sessionKey);

      console.log("[->] Sending:\n      PIN: "+encrypted_match_pin.toString('hex')+
            "\n       IP: "+encrypted_match_ip.toString('hex')+"\n      PBK: "+encrypted_match_pbk.toString('hex')+'\n');

      plainSQL("DELETE FROM sessions WHERE pin="+target_pin+";");
      res.json({ pin: encrypted_match_pin, ip: encrypted_match_ip, pbk: encrypted_match_pbk });

    }
    else res.send("NOMATCH"); //this might cause issues with databoxui

  }).catch(error => {
      console.log(error);
      res.send("ERROR");
  });
    
});

app.post('/deleteSessionInfo', (req,res) => {
  var client_pin = decrypt(Buffer.from(req.body.pin), sessionKey);
  plainSQL("DELETE FROM sessions WHERE pin="+client_pin+";");
  res.end();
});

/****************************************************************************
* Data Passing
****************************************************************************/
app.post('/retrieve', (req,res) =>{
  // caretaker: retrieve all records with targetPIN
  // upon successful decryption, ct will send back OK to server
  // upon OK delete these records from server
  var pin = decrypt(Buffer.from(req.body.pin), sessionKey);
  var results = sqlConnection.query("SELECT data FROM databoxrhm WHERE pin=?;", [pin], function (err, result) {
    var encrypted_result = encrypt(results,sessionKey);
    res.json(encrypted_result);
  });
  sqlConnection.query("DELETE FROM databoxrhm WHERE pin=?;",[pin]);
});

app.post('/store', (req,res) =>{
  var pin = decrypt(Buffer.from(req.body.pin),sessionKey);
  //var ttl = decrypt('aes-256-cbc', sessionKey, Buffer.from(req.body.ttl));
  var data = Buffer.from(req.body.data); //dont try to decrypt - crashes cause doesnt have peerkey

  var sql = "INSERT INTO databoxrhm (pin, data) VALUES (" + pin + ",'"+ data + "')";
  sqlConnection.query(sql, function (err, result) { 
    console.log('[+] Added data:\n      PIN:', pin, '\n     data:', data);
  });
});

/****************************************************************************
* Encrypt / Decrypt
****************************************************************************/
//based on https://lollyrock.com/posts/nodejs-encryption/
function decrypt(data, key) {
  var decipher = crypto.createDecipher('aes-256-cbc', key);
  //decipher.setAutoPadding(false);
  var decrypted_data = decipher.update(data,'hex','utf8');
  decrypted_data += decipher.final('utf8');
  return decrypted_data;
}
function decryptBuffer(data, key){
  var decipher = crypto.createDecipher('aes-256-cbc',key);
  var decrypted_data = Buffer.concat([decipher.update(data) , decipher.final()]);
  return decrypted_data;
}

function encryptBuffer(data, key) {
  var cipher = crypto.createCipher('aes-256-cbc', key);
  var encrypted_data = cipher.update(data,'utf8','hex');
  encrypted_data += cipher.final('hex');
  return encrypted_data;
}
function encrypt(data, key) {
  var cipher = crypto.createCipher('aes-256-cbc',key);
  var encrypted_data = Buffer.concat([cipher.update(data),cipher.final()]);
  return encrypted_data;
}
/****************************************************************************
* Helpers
****************************************************************************/
// from https://stackoverflow.com/questions/4460586/javascript-regular-expression-to-check-for-ip-addresses
// Regex check for valid IP address
function isValidIP(ip) {  
  if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip))  
    return (true);
  return (false);
}  

function plainSQL(sql){
  sqlConnection.query(sql, function (err) {
    if(err) throw err;
  });
}

function checkForMatch(client_pin, target_pin, client_type){
  return new Promise((resolve,reject) =>{
    //Check if someone else is matching
    var peerType = (client_type=='patient') ? 'caretaker' : 'patient';
    // this is for all pairs - could be used periodically by server - NEEDS FIXING TO DISTINGUISH WHO IS WHO
    var any_match_sql = "select ls1.pin as ownPIN, ls2.ip as peerIP, ls2.publickey as peerPublicKey from sessions as ls1 " +
                        "inner join sessions as ls2 on ls1.pin = ls2.targetPIN and ls1.targetPIN = ls2.pin and ls1.usertype != ls2.usertype " +
                      "group by ls1.pin, ls1.targetPIN "+
                      "order by ls1.pin, ls1.targetPIN;";
    // this one to check current client - to check only when new client comes up
    var current_match_sql = "select pin, ip, publickey from sessions " +
                        "where pin="+target_pin+" AND targetPIN="+client_pin+" AND usertype='"+peerType+"';"
    sqlConnection.query(current_match_sql, function (err, result, fields) {
      if (err) reject(err);
      // Match found
      if(result.length > 0 ) {
        var match_pin = result[0].pin;
        var match_ip = result[0].ip;
        var match_pbk = result[0].publickey;
        console.log("[=] Found match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
        var match = [];
        match.push(match_pin);
        match.push(match_ip);
        match.push(match_pbk);

        //delete all data from databoxrhm table with these PINs cause the encryption is invalid now
        //sqlConnection.query("DELETE FROM databoxrhm WHERE pin="+client_pin+"OR pin="+match_pin+";");

        resolve(match);
      }
      else reject ("No match found");
    });
  });
}

// Simple check if passed data is JSON
function isJSON(data) {
  try { var testobject = JSON.parse(data); } catch (err) { return false; } return true;
}