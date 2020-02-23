var express = require('express');
var app = express();
var https = require('https');
const crypto = require('crypto');
const HKDF = require('hkdf');

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
var charizard = [
      "                 .”-,.__                                                                                             ",
      "                 `.     `.  ,                                                                            ",
      "              .--'  .._,'“-' `.                                                                                  ",
      "             .    .'         `'                                                                                  ",
      "             `.   /          ,'                                                                                  ",
      "               `  '--.   ,-“'                                                                                    ",
      "                `“`   |  \                                                                                               ",
      "                   -. \, |                                                                                               ",
      "                    `--Y.'      ___.                                                                             ",
      "                         \     L._, \                                                                            ",
      "               _.,        `.   <  <\                _                                            ",
      "             ,' '           `, `.   | \            ( `                                           ",
      "          ../, `.            `  |    .\`.           \ \_                                 ",
      "         ,' ,..  .           _.,'    ||\l            )  '“.                              ",
      "        , ,'   \           ,'.-.`-._,'  |           .  _._`.                             ",
      "      ,' /      \ \        `' ' `--/   | \          / /   ..\                            ",
      "    .'  /        \ .         |\__ - _ ,'` `        / /     `.`.                          ",
      "    |  '          ..         `-...-“  |  `-'      / /        . `.                        ",
      "    | /           |L__           |    |          / /          `. `.                      ",
      "   , /            .   .          |    |         / /             ` `                      ",
      "  / /          ,. ,`._ `-_       |    |  _   ,-' /               ` \             ",
      " / .           \“`_/. `-_ \_,.  ,'    +-' `-'  _,        ..,-.    \`.            ",
      ".  '         .-f    ,'   `    '.       \__.---'     _   .'   '     \ \           ",
      "' /          `.'    l     .' /          \..      ,_|/   `.  ,'`     L`           ",
      "|'      _.-““` `.    \ _,'  `            \ `.___`.'“`-.  , |   |    | \          ",
      "||    ,'      `. `.   '       _,...._        `  |    `/ '  |   '     .|          ",
      "||  ,'          `. ;.,.---' ,'       `.   `.. `-'  .-' /_ .'    ;_   ||          ",
      "|| '              V      / /           `   | `   ,'   ,' '.    !  `. ||          ",
      "||/            _,-------7 '              . |  `-'    l         /    `||          ",
      ". |          ,' .-   ,' ||               | .-.        `.      .'     ||          ",
      " `'        ,'    `“.'    |               |    `.        '. -.'       `'          ",
      "          /      ,'      |               |,'    \-.._,.'/'                                       ",
      "          .     /        .               .       \    .''                                        ",
      "        .`.    |         `.             /         :_,'.'                                 ",
      "          \ `...\   _     ,'-.        .'         /_.-'                                           ",
      "           `-.__ `,  `'   .  _.>----''.  _  __  /                                                        ",
      "                .'        /“'          |  “'   '_                                                        ",
      "               /_|.-'\ ,“.             '.'`__'-( \                                                       ",
      "                 / ,“'“\,'               `/  `-.|“                                                       "
          ].join("\n").red;

const server = https.createServer(options,app);

server.listen(LISTENING_PORT, () =>{
    console.log('server bind ok');
});

// Established with ECDH and HKDF
var sessionKey;

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
  client_username = decryptString('aes-256-cbc', sessionKey, Buffer.from(req.body.username));
  client_ip = decryptString('aes-256-cbc', sessionKey, Buffer.from(req.body.ip));

  //TODO: store these somewhere?
  console.log('Connected to a', client_type, 'named', client_username, 'with IP:',client_ip);

  if(isValidIP(client_ip)){
    console.log("VALID IP");
    res.send('OK');
  } else {
    console.log("Invalid IP");
    res.send('ERROR');
  }
});

app.get('/charizard', (req,res) => {
  var encrypted_charizard = encryptBuffer('aes-256-cbc',sessionKey,charizard+"\n");
  res.send(encrypted_charizard);
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