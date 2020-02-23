const LISTENING_PORT = 8000;

var express = require('express');
var app = express();
var https = require('https');
const crypto = require('crypto');
const HKDF = require('hkdf');

var bodyParser = require('body-parser')
app.use( bodyParser.json() );       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
  extended: true
}));

var tls = require('tls'),
    fs = require('fs'),
    colors = require('colors');
var options = {
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

app.get('/charizard', (req,res) => {
  console.log('sent charizard');
  res.send(charizard+"\n");
});

app.post('/ECDH', (req,res) => {
  var reqJSON = req.body;
  const client_ip = reqJSON.ip;
  const aliceKeyJSON = reqJSON.alicekey;
  const aliceKey = Buffer.from(aliceKeyJSON);


  console.log("Received aliceKey: ",aliceKey.toString('hex'));

  const bob = crypto.createECDH('Oakley-EC2N-3');
  const bobKey = bob.generateKeys();
  //console.log("\nBob private key:\t",bob.getPrivateKey().toString('hex'));
  //console.log("Bob public key:\t",bobKey.toString('hex'));

  res.send(bobKey);
  console.log('Sent (public) bobKey: '+ bobKey.toString('hex') + " to client id: "+client_ip);

  const bobSecret = bob.computeSecret(aliceKey);
  console.log("Bob shared key:\t\t",bobSecret.toString('hex'));

  var hkdf = new HKDF('sha256', 'saltysalt', bobSecret);
  hkdf.derive('info', 42, function(key) {
    // key is a Buffer, that can be serialized however one desires
    console.log('HKDF: ', key.toString('hex'));
  });

});

const server = https.createServer(options,app);

server.listen(LISTENING_PORT, () =>{
   console.log('server bind ok');
});