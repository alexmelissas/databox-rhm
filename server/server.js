const LISTENING_PORT = 8000;

var express = require('express');
var app = express();
var https = require('https');

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

app.post('/requestKey', (req,res) => {
  var client_id = req.body.id;
  var token = randomToken();
  res.send("Given token: "+token+"\n");
  console.log('Sent token: '+ token+" to client id: "+client_id);
});

const server = https.createServer(options,app);

server.listen(LISTENING_PORT, () =>{
   console.log('server bind ok');
});

//var socket = require('socket.io');
//const stun = require('stun');
// socket.on('ipaddr', function(ipaddr) {
//   stun.request("stun.l.google.com:19302", (err, res) => {
//     if (err) {
//       console.error(err);
//     } else {
//       const { address } = res.getXorAddress();
//       //socket.emit
//       console.log('Server IP address is: ' + address);
//     }
//   })
// });

function randomToken() {
  return Math.floor((1 + Math.random()) * 1e16).toString(16).substring(1);
}