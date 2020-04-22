/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
*      (1)                        CORE SETUP                                *
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
var express = require('express');
var app = express();
var https = require('https');
const crypto = require('crypto');
const HKDF = require('hkdf');
var mysql = require('mysql');

/*--------------------------------------------------------------------------*
|   Server Setup
---------------------------------------------------------------------------*/
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

server.listen(LISTENING_PORT, () =>{
  console.log('Server listening...');
});

// Established with ECDH and HKDF
var sessionKey;

server.emit('end', () =>{
  console.log("Sending session end.");
});

/*--------------------------------------------------------------------------*
|   SQL Setup
---------------------------------------------------------------------------*/
var sqlConnection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'xelALQS17!',
  database : 'databoxrhm'
});

sqlConnection.connect(function(err) {
  if (err) throw err;
  console.log("Connected to MySQL database. \n\n");
});


/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
||      (2)             ESTABLISH SECURE ASSOCIATION                       ||
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
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
    sessionKey = key;
  });
});

// Register client as a session waiting to be matched
app.post('/register', async (req,res) => {
  var client_type = decrypt(Buffer.from(req.body.type), sessionKey);
  var client_pin = decrypt(Buffer.from(req.body.pin), sessionKey);
  var target_pin = decrypt(Buffer.from(req.body.targetpin), sessionKey);
  var client_ip = decrypt(Buffer.from(req.body.ip), sessionKey);
  var client_public_key = decrypt(Buffer.from(req.body.publickey), sessionKey);

  // Check for concurrency errors with the relay session key
  if (client_type == -1 || client_pin == -1 || target_pin == -1 || client_ip == -1  || client_public_key == -1) { 
    console.log("[!][Establish] RSK Concurrency Error"); 
    res.send("RSK Concurrency Error"); 
  }
  else {
    if(isValidIP(client_ip)){

      // Check for duplicates
      sqlConnection.query( "SELECT pin FROM sessions WHERE pin=?;", [client_pin], function(err, result) {
        if(err) throw err;
  
        //If duplicate PIN, delete the existing entry - because publickey/ip might have changed
        if (result.length > 0 ) {
          console.log("Duplicate PIN, updating entry.");
          sqlConnection.query("DELETE FROM sessions WHERE pin=?;",[client_pin]);
        }
  
        // Store this session entry
        sqlConnection.query("INSERT INTO sessions (pin, targetPIN, publickey, ip, usertype) VALUES (?,?,?,?,?);",
                            [client_pin, target_pin, client_public_key, client_ip, client_type], function (err, result) {   
          if (err) throw err;
          console.log('[+] Added session:\n      PIN:', client_pin, '\n     tPIN:', target_pin, '\n     Type:',client_type,
                      '\n      PBK:',client_public_key,'\n       IP:',client_ip, '\n');

          var match_pin, match_ip, match_pbk;
  
          // Check if a match has been found
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
  
              sqlConnection.query("DELETE FROM sessions WHERE pin=?;",[target_pin]);
              res.json({ pin: encrypted_match_pin, ip: encrypted_match_ip, pbk: encrypted_match_pbk });
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
  }
});

// Hold the client waiting for a match to be found, execute the attempts-based
// recurring match-finding process
app.post('/awaitMatch', async (req,res) => {
  var client_type = decrypt(Buffer.from(req.body.type), sessionKey);
  var client_pin = decrypt(Buffer.from(req.body.pin), sessionKey);
  var target_pin = decrypt(Buffer.from(req.body.targetpin), sessionKey);

  if (client_type == -1 || client_pin == -1 || target_pin == -1) {
    console.log("[!][awaitMatch] RSK Concurrency Error"); 
    res.send("RSK Concurrency Error");
  }
  else {
    await checkForMatch(client_pin,target_pin,client_type).then((match) => {

      if(match.length==3){
        match_pin = match[0];
        match_ip = match[1];
        match_pbk = match[2];
      
        var encrypted_match_pin = encrypt(match_pin.toString(),sessionKey);
        var encrypted_match_ip = encrypt(match_ip.toString(),sessionKey);
        var encrypted_match_pbk = encrypt(match_pbk.toString(),sessionKey);

        console.log("[->] Sending:"+
              "\n      PIN: "+encrypted_match_pin.toString('hex')+
              "\n       IP: "+encrypted_match_ip.toString('hex')+
              "\n      PBK: "+encrypted_match_pbk.toString('hex')+'\n');

        sqlConnection.query("DELETE FROM sessions WHERE pin=?;",[target_pin]);
        res.json({ pin: encrypted_match_pin, ip: encrypted_match_ip, pbk: encrypted_match_pbk });

      }
      else res.send("NOMATCH");

    }).catch(error => {
        console.log(error);
        res.send("ERROR");
    });
  }
});

// Delete session data from database
app.post('/deleteSessionInfo', (req,res) => {
  var client_pin = decrypt(Buffer.from(req.body.pin), sessionKey);
  if (client_pin == -1) { 
    console.log("[!][Delete] RSK Concurrency Error"); 
    res.send("RSK Concurrency Error");
  }
  else {
    sqlConnection.query("DELETE FROM sessions WHERE pin=?;",[client_pin]);
    console.log("Deleted session entry");
    res.end();
  }
});

// Check if a matching client is waiting for secure association establishment
function checkForMatch(client_pin, target_pin, client_type){
  return new Promise((resolve,reject) =>{
    //Check if someone else is matching
    var peerType = (client_type=='patient') ? 'caretaker' : 'patient';
    var current_match_sql = "select pin, ip, publickey from sessions " +
                        "where pin="+target_pin+" AND targetPIN="+client_pin+" AND usertype='"+peerType+"';"
    sqlConnection.query(current_match_sql, function (err, result, fields) {
      if (err) reject(err);
      if(result.length > 0 ) { // Match found
        var match_pin = result[0].pin;
        var match_ip = result[0].ip;
        var match_pbk = result[0].publickey;
        console.log("[=] Found match:\n      PIN: "+match_pin+"\n       IP: "+match_ip+"\n      PBK: "+match_pbk+'\n');
        var match = [];
        match.push(match_pin,match_ip,match_pbk);
        // Delete all data from databoxrhm table with these PINs because their past encryption is invalid now
        sqlConnection.query("DELETE FROM databoxrhm WHERE pin="+client_pin+"OR pin="+match_pin+";");
        resolve(match);
      }
      else reject ("No match found");
    });
  });
}


/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
||      (3)                   DATA HANDLING                                ||
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
// Return new data from requested PIN
app.post('/retrieve', (req,res) =>{
  var pin = decrypt(Buffer.from(req.body.pin), sessionKey);
  if (pin==-1) { 
    console.log("[!][Retrieve] RSK Concurrency Error"); 
    res.send("RSK Concurrency Error");
  }
  else {
    sqlConnection.query("SELECT data, checksum, timestamp FROM databoxrhm WHERE pin=?" +
                         "ORDER BY timestamp ASC;", [pin], function (err, rows) {
      if(rows!=null && rows!=[] && rows.length>0){
        var result = [];
        for (var i = 0;i < rows.length; i++) {
          var data = rows[i].data;
          var checksum = rows[i].checksum;
          var timestamp = rows[i].timestamp;
          var entry = {timestamp,checksum,data};
          result.push(entry);
        }
        if(result.length == 0) res.send('No data found.'); // send EOF empty array
        
        console.log("Found data:",result);
        // SHOULD ENCRYPT? - but risky.. time passes RSK will corrupt probably
        res.send(result);
        sqlConnection.query("DELETE FROM databoxrhm WHERE pin=?;",[pin]);
      }
      else {
        var empty = [];
        empty.push('EOF');
        res.send(empty);
      }
    });
  }
});

// Store new data given
app.post('/store', (req,res) =>{
  var pin = decrypt(Buffer.from(req.body.pin),sessionKey);
  if (pin==-1) { 
    console.log("[!][Store] RSK Concurrency Error"); 
    res.send("RSK Concurrency Error");
  }
  else {
    var data = Buffer.from(req.body.data); //dont try to decrypt - crashes cause doesnt have peerkey
    var checksum = Buffer.from(req.body.checksum);
    sqlConnection.query("INSERT INTO databoxrhm (pin, checksum, data, ttl)"
                        +"VALUES (?, ?,?, ?);",
                         [pin,checksum,data,7], function (err, result) { 
      if (result!=null) console.log('[+] Added data:\n      PIN:', pin,
                                    '\n checksum:', checksum,
                                    '\n     data:', data);
    });
    res.send("ok");
  }
});


/*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*
||      (4)                       HELPERS                                  ||
*+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=+=*/
/*--------------------------------------------------------------------------*
|   Encrypt / Decrypt - Based on: https://lollyrock.com/posts/nodejs-encryption/
---------------------------------------------------------------------------*/
function decrypt(data, key) {
  var decipher = crypto.createDecipher('aes-256-cbc', key);
  var decrypted_data = decipher.update(data,'hex','utf8');
  try { decrypted_data += decipher.final('utf8');} 
  catch(err){ decrypted_data = -1; }
  return decrypted_data;
}

function encrypt(data, key) {
  var cipher = crypto.createCipher('aes-256-cbc',key);
  var encrypted_data = Buffer.concat([cipher.update(data),cipher.final()]);
  return encrypted_data;
}

/*--------------------------------------------------------------------------*
|   Generic Helpers
---------------------------------------------------------------------------*/
// Regex check for valid IP address
// Based on: https://stackoverflow.com/questions/4460586/javascript-regular-expression-to-check-for-ip-addresses
function isValidIP(ip) {  
  if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ip))  
    return (true);
  return (false);
}

// Simple check if data is JSON
function isJSON(data) { try { var testobject = JSON.parse(data); } catch (err) { return false; } return true; }

/*--------------------------------------------------------------------------*
|   Unused / Future Proofing
---------------------------------------------------------------------------*/
// Check for matches for all pairs - could be used periodically by server
var any_match_sql = "select ls1.pin as ownPIN, ls2.ip as peerIP, ls2.publickey as peerPublicKey from sessions as ls1 " +
"inner join sessions as ls2 on ls1.pin = ls2.targetPIN and ls1.targetPIN = ls2.pin and ls1.usertype != ls2.usertype " +
"group by ls1.pin, ls1.targetPIN "+
"order by ls1.pin, ls1.targetPIN;";