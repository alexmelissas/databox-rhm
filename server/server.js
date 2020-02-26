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
var pikachu = [
" ,@@@@@@@@@@,,@@@@@@@%  .#&@@@&&.,@@@@@@@@@@,      %@@@@@@%*   ,@@@%     .#&@@@&&.  *&@@@@&(  ,@@@@@@@%  %@@@@@,     ,@@,         ",
"     ,@@,    ,@@,      ,@@/   ./.    ,@@,          %@%   ,&@# .&@&@@(   .@@/   ./. #@&.  .,/  ,@@,       %@%  *&@&.  ,@@,          ",
"     ,@@,    ,@@&%%%%. .&@@/,        ,@@,          %@%   ,&@# %@& /@@,  .&@@/,     (@@&%(*.   ,@@&%%%%.  %@%    &@#  ,@@,          ",
"     ,@@,    ,@@/,,,,    ./#&@@@(    ,@@,          %@@@@@@%* /@@,  #@&.   ./#&@@@(   *(%&@@&. ,@@/,,,,   %@%    &@#  .&&.          ",
"     ,@@,    ,@@,      ./,   .&@#    ,@@,          %@%      ,@@@@@@@@@% ./.   .&@# /*.   /@@. ,@@,       %@%  *&@&.   ,,           ",
"     ,@@,    ,@@@@@@@% .#&@@@@&/     ,@@,          %@%     .&@#     ,@@/.#&@@@@&/   /%&@@@@.  ,@@@@@@@%  %@@@@@.     ,@@,          ",
",*************,,*/(((((//,,*(#%%%%%%%%%%%%%%%#(*,,,****************************************************,*/(((((((((/((((////****/((##%%%%%% ",
",*************,,//((((((//,,*(%%%%%%%%%%%%%%%%%##/*****************************************************,,*/(///(//////****//((##%%%%%%%%%%% ",
",************,,*/(((((((//***/#%%%%%%%%%%%%%%%%%%%#(/***************************************************,*//////////*//((#%%%%%%%%%%%%%%%%% ",
",***********,,*////////////***/##%%%%%%%%%%%%%%%%%%%##(*,***********************************************,,*////////(###%%%%%%%%%%%%%%%%%%%% ",
",**********,,,*/*******//////**/(#%%%%%%%%%%%%%%%%%%%%%#(/**********************************************,,,***/(##%%%%%%%%%%%%%%%%%%%%%%%%% ",
",*********,,,,*************///***/(#%%%%%%%%%%%%%%%%%%%%%%#(/***********************************,****,****/((#%%%%%%%%%%%%%%%%%%%%%%%%%%%%# ",
",*********,,,***************//****/(##%%%%%%%%%%%%%%%%%%%%%%##//**************//////////////////////((#####%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#( ",
",********,,,,***********************/(#%%%%%%%%%%%%%%%%%%%%%%%##################%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%##(/ ",
",*******,..,***********************,,*/##%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%###((// ",
",*******,.,,***********************,,,,*(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%##(//**// ",
",******,.,,,************************,,,,*/(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#(//******* ",
",*****,,,,,********,***,,,,,,,,,,,,*,,,,,,*/(######%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%##(/********** ",
",*****,..,*******,,,,,,,,,,,,,,,,,,,,,,*,,,,*///((#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%###(/************ ",
",*****,,,*******,,,,,*,,,,,,,,,,,,,,,,,****,,,*/(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#######(//************** ",
",****,.,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,,**,,,/(%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#((//****************** ",
",***,..,,,,,,,,,,,,,,,,,,,,,,,,,,,,,..,,,,,,,*(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#(/******************* ",
",**,,.,,,,,,,,,,,,,,,,,,,,,,,,,,.......,,,,,,/#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#####%%%%%%%%%%%%%%%%#(/****************** ",
",**,..,,,,,,,,,,,,,,,,,,,,,,,,,......,,,*,,,*(#%%%%%%%%##(((/(##%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%##(((/*/((#%%%%%%%%%%%%%%#(/***************** ",
",*,..,,,,,,,,,,,,,,,,,,,,,,,,,,,.....,,**,,*/#%%%%%%%##((((*,**/#%%%%%%%%%%%%%%%%%%%%%%%%%%%%##((##/,,,*(#%%%%%%%%%%%%%%#(***************** ",
".*,.,,,**,,,,,,,,,,,,,,,,,,,,,,,,,,*****,,,/(%%%%%%%%#(//(#/,..*/#%%%%%%%%%%%%%%%%%%%%%%%%%%%#(//(#/,..,/(#%%%%%%%%%%%%%%#/*****/////////// ",
".,..,,,,,,,,,,,,,,,,,,,,,,,,,,*,,*******,,,(#%%%%%%%%#(*,,,....,/#%%%%%%%%%%%%%%%%%%%%%%%%%%%#(*,,,....,/(#%%%%%%%%%%%%%%#(*,**//////////// ",
".,..,,,,,,,,,...........,,,,,,*,********,,*(#%%%%%%%%%#(/*,,...,/#%%%%%%%%%%%%%%%%%%%%%%%%%%%%#(/*,,..,*/##%%%%%%%%%%%%%%%#(***//////////// ",
"...,,,,,,,................,,*,**********,,/#%%%%%%%%%%%%#((////((#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%##((///(#%%%%%%%%%%%%%%%%%%(/**//////////// ",
"...,,,,,,.................,,,**********,,*(#%%%%%%%%%%%%%%%%%%#%%%%%%%%#((///((#%%%%%%%%%%%%%%%%%%%%%#%%%%%%%%%%%%%%%%%%%%%#/**//////////// ",
".,,,,,,,,.................,,***********,,/(####%%%%%%%%%%%%%%%%%%%%%%%%#(/*,,,*(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#(/*//////////// ",
".,***,,,,,,..............,,,**********,..,***//((##%%%%%%%%%%%%%%%%%%%%%%%##((##%%%%%%%%%%%%%%%%%%%%%%%%%##(((((((((###%%%%%#/**/////////// ",
".*****,,,,,,,,,,,,,,,,,,,*************,..,*******/(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%##///*//////((#%%%%%#(**/////////// ",
".****************/******/***////*****,.,*///////**/#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#(////////////(#%%%%%#/**////////// ",
".***********************/////*******,..,*//////////(#%%%%%%%%%%%%%%%%%%%%##########%%%%%%%%%%%%%%%%%%%%#(///////////*/(#%%%%%#(***///////// ",
".************************///********,..,*//////////#%%%%%%%%%%%%%%%%%%#(//*****///(((##%%%%%%%%%%%%%%%%#(///////////**/##%%%%##/***//////// ",
".***********************************,.,,***///////(#%%%%%%%%%%%%%%%%#(/*,,,*//((((////(#%%%%%%%%%%%%%%%#((////////////(#%%%%%%#(*********// ",
",***********,,,*,,*,,**************,,,*//******//(#%%%%%%%%%%%%%%%%%#(*,,*/(((#####(((((#%%%%%%%%%%%%%%%##///////////(#%%%%%%%%#(***/////// ",
",*************,,**,,,************,,,,,/(##((((####%%%%%%%%%%%%%%%%%%%(/**/(((#((((#((//(#%%%%%%%%%%%%%%%%%#(((((((((##%%%%%%%%%%#/**/////// ",
",******************************,,,,,,,*(#%#%%%%%%%%%%%%%%%%%%%%%%%%%%#(**/((#(#(((#((//(#%%%%%%%%%%%%%%%%%%%%%%%#%#%%%%%%%%%%%%%#(**/////// ",
",*************,**************,****,,,,,/(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%#(/*/((((#((((///(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%(/*/////// ",
",*************************************,*/#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%##(////////////(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#/**/////* ",
",******////****///////////////////////***/#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%####(((((((###%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#(******** ",
".,*,****///////////////////////////////***/#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%#(/******* ",
".,,,,*****//////////////////////////*******(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%##(******* ",
".,,,,,,***********/////////////////********/(#%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%%(******* "
          ].join("\n").yellow;

const server = https.createServer(options,app);

var sqlConnection = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'xelALQS17!',
  database : 'databoxrhm'
});

// var createTableQuery = "CREATE TABLE IF NOT EXISTS LoginSessions (" + 
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
* REST
****************************************************************************/
// Establish the session key using ECDH & HKDF
app.post('/establishSessionKey', (req,res) => {
  const aliceKey = Buffer.from(req.body.alicekey);
  const bob = crypto.createECDH('Oakley-EC2N-3');
  const bobKey = bob.generateKeys();
  res.send(bobKey);
  const bobSecret = bob.computeSecret(aliceKey);
  
  var hkdf = new HKDF('sha256', 'saltysalt', bobSecret);
  hkdf.derive('info', 4, function(key) {
    console.log('SessionKey: ', key.toString('hex'));
    sessionKey = key; // need to think where / how long to store this also what about many clients same time
  });
});

// Receive and decrypt client IP
app.post('/clientInfo', (req,res) => {

  //TODO: handle null session key

  client_type = decryptString('aes-256-cbc', sessionKey, Buffer.from(req.body.type));
  client_pin = decryptString('aes-256-cbc', sessionKey, Buffer.from(req.body.pin));
  target_pin = decryptString('aes-256-cbc', sessionKey, Buffer.from(req.body.targetpin));
  client_ip = decryptString('aes-256-cbc', sessionKey, Buffer.from(req.body.ip));
  client_public_key = decryptString('aes-256-cbc', sessionKey, Buffer.from(req.body.publickey));

  if(isValidIP(client_ip)){

    // Check for duplicates
    var sql = "SELECT pin FROM LoginSessions WHERE pin=" +client_pin+";";
    sqlConnection.query(sql, function(err, result) {
      if(err) throw err;
      //If duplicate PIN, skip insert
      if (result.length > 0 ) console.log("Duplicate PIN, no new entry created.");
      else {
        // Store this LoginSession entry
        var sql = "INSERT INTO LoginSessions (pin, targetPIN, publickey, ip, usertype) " 
            +"VALUES (" + client_pin + ","+ target_pin + ",'" + client_public_key + "','" + client_ip + "','" + client_type + "')";
        sqlConnection.query(sql, function (err, result) {
          if (err) throw err;
          console.log('Saved login info of a', client_type, 'with PIN:', client_pin, 'who wishes to connect to PIN:'
                  ,target_pin,'publicKey:',client_public_key,'with IP:',client_ip);
        });
      }
    });

    //Check if someone else is matching
    
    // this is for all pairs - could be used periodically by server
    var any_match_sql = "select ls1.pin as ownPIN, ls2.ip as peerIP, ls2.publickey as peerPublicKey from LoginSessions as ls1 " +
                "inner join LoginSessions as ls2 on ls1.pin = ls2.targetPIN and ls1.targetPIN = ls2.pin " +
              "group by ls1.pin, ls1.targetPIN "+
              "order by ls1.pin, ls1.targetPIN;";
    // this one to check current client - to check only when new client comes up
    var client_match_sql = "select ls1.pin as ownPIN, ls2.ip as peerIP, ls2.publickey as peerPublicKey from LoginSessions as ls1 " +
              "inner join LoginSessions as ls2 on ls2.pin = "+target_pin+" and ls2.targetPIN = "+client_pin+" " +
            "group by ls1.pin, ls1.targetPIN "+
            "order by ls1.pin, ls1.targetPIN;";
    sqlConnection.query(client_match_sql, function (err, result, fields) {
      if (err) throw err;
      // Match found
      if(result.length > 0 ) {
        console.log("Found matches:",result);

        // TODO: Exchange the info to the peers so they can establish a sessionKey - they store it 'permanently' in datastores
        // TODO: Delete their LoginSession entries

      }
      
    });

    res.send('OK');

  } else {
    console.log("Invalid IP");
    res.send('ERROR');
  }
});

app.get('/pikachu', (req,res) => {
  var encrypted_pikachu = encryptBuffer('aes-256-cbc',sessionKey,pikachu+"\n");
  res.send(encrypted_pikachu);
});

/****************************************************************************
* Encrypt / Decrypt
****************************************************************************/
//based on https://lollyrock.com/posts/nodejs-encryption/
function decryptString(algorithm, key, data) {
  var decipher = crypto.createDecipher(algorithm, key)
  var decrypted_data = decipher.update(data,'hex','utf8')
  decrypted_data += decipher.final('utf8');
  return decrypted_data;
}
function decryptBuffer(algorithm, key, data){
  var decipher = crypto.createDecipher(algorithm,key);
  var decrypted_data = Buffer.concat([decipher.update(data) , decipher.final()]);
  return decrypted_data;
}

function encryptString(algorithm, key, data) {
  var cipher = crypto.createCipher(algorithm, key)
  var encrypted_data = cipher.update(data,'utf8','hex')
  encrypted_data += cipher.final('hex');
  return encrypted_data;
}
function encryptBuffer(algorithm, key, data) {
  var cipher = crypto.createCipher(algorithm,key)
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