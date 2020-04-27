# Secure Remote Health Monitoring using Databox
A complete software solution for a Remote Health Monitoring system. Comprises of two databox drivers as the user endpoints, and a relay server as the intermediary of communication and establisher of secure associations between drivers.

# Use the system

## Databox driver setup
**Prerequisites** 
- Linux / macOS local machine
- Docker Engine: https://docs.docker.com/engine/install/
- nodejs & npm - https://nodejs.org/en/download/package-manager/
- Other npm dependencies handled automatically

**Install/Start databox**
- Have docker running on local machine
- Run ***/scripts/start.sh*** to startup databox
	- First run will take a while, docker will need to download databox
	- If you get the "*This node is already part of a swarm*" error, run ***/scripts/swarmleave.sh*** and try again
	- If you get any random error/repeating and failing dns updating/crash while starting databox, run ***/scripts/stop.sh*** and try again

**Install the drivers**
- Have docker running on local machine
- Run ***/scripts/start.sh*** to startup databox
	- [!] First run will take a while, docker will need to download databox
	- A password will be printed on screen when databox starts, copy it for use in a bit
- Run ***/scripts/build.sh*** to build the driver images
	- [!] First run will take a while, large amount of dependencies downloaded 
- Navigate to *127.0.0.1* on a web browser
- Enter the password given to you in the ***start*** script shell window
- Navigate to the App Store, press the cog icon (top right).
- At the "Upload local Manifest" menu, select ***patient/src/databox-manifest.json*** and click "Add manifest"
- Repeat for ***caretaker/src/databox-manifest.json***
- Return to the databox app-store
- Click on the ***srhm-patient*** icon and click "INSTALL" in the page that opens
- Repeat for ***shrm-caretaker***

**Run the drivers**
- From the databox homescreen, just click on the tile of the driver you want to use

# Work on the system
There are two sections of the project on which you could want to work on. You could either work on the databox drivers, which are the frontend of the system, or on the relay server, if you're more interested in the system's backend.

### Understanding the Code
Whichever part of the system you want to work on, there are ***docco*** (http://ashkenas.com/docco/) documents to help you better understand the source code. Just look for the ***docs*** folder in the root folder of the driver/server folder you're working on. The docco files are the ones written in HTML.
- Patient Driver - ***patient/src/docs***
- Caretaker Driver - ***caretaker/src/docs***
- Patient Driver - ***server/docs***

## Work on the drivers
**Dependencies**
- nodejs & npm - https://nodejs.org/en/download/package-manager/
- Other npm dependencies handled automatically

**Languages used**
- **nodeJS**: Main driver functionality
- **HTML & CSS**: Driver frontend design
- **JS**: Raw JS for dynamic functionality in the frontend

**Code Files**
- **main.js**: Core databox driver functionality
- **helpers.js**: Constants and function definitions
- **views/*.ejs**: HTML definitions of specific screen, eg. *settings.ejs*
- **views/*.js**: Dynamic element handling for specific screen, eg. *settings.js*
- **views/style.css**: Style sheet
- **test/unit.test.js**: Unit tests *[Patient only]* 

**Testing your code**
- When you're done coding, run ***/scripts/build.sh*** to build the driver images
- Uninstall the driver from databox
	- Launch the driver, click on the context menu (top right) -> Uninstall
- Follow the normal installation procedure to re-install the new image
- To view the driver's logs, run ***/scripts/patient_logs.sh*** or ***/scripts/caretaker_logs.sh*** accordingly

## Work on the relay server code

**Dependencies**
- nodejs & npm - https://nodejs.org/en/download/package-manager/
- Other npm dependencies handled automatically

**Languages used**
- **nodeJS**: Entire server functionality

**Code Files**
- **server.js**: Entire server functionality

**Testing your code**
 - Run  `node server.js`

## Setup your own relay server 

**Dependencies**
- Hosted instance with some flavour of Linux
- nodejs & npm - https://nodejs.org/en/download/package-manager/
- mysql - https://www.npmjs.com/package/mysql
- coturn - https://github.com/coturn/coturn
- hkdf - https://www.npmjs.com/package/node-hkdf
- express - https://www.npmjs.com/package/express
- body-parser - https://www.npmjs.com/package/body-parser

 **Setup**
 - Copy the **server** folder to your instance
 - Setup coturn - useful guide: https://www.webrtc-experiment.com/docs/TURN-server-installation-guide.html#coturn
	 - This should leave you with a new folder, eg. *turnserver-4.5.0.8*
 - Create new folder **server/cert**
 - Create a self-signed certificate and private RSA key in that folder : 
	 - server.crt  
	 - server.key
 - Install any missing dependencies for the **server/server.js** file, as specified above

**Run your relay server**
 - Navigate to the folder created during coturn setup 
 - Run `sudo turnserver -o -a -f -r <realm_name> --cert <server.crt location> --pkey <server.key location> --pkey-pwd <password>`
 - You now have the TURN daemon running
 - Navigate back to the **server** folder
 - Run  `node server.js`
