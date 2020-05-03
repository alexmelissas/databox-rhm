# Secure Remote Health Monitoring using Databox

A complete software solution for a Secure Remote Health Monitoring system. Comprises of two databox drivers as the user endpoints, and a relay server as the intermediary of communication and establisher of secure associations between drivers.

# Use the system
## Databox driver setup

**Prerequisites**
- Linux / macOS local machine
- Docker Engine: https://docs.docker.com/engine/install/
- nodejs & npm - https://nodejs.org/en/download/package-manager/
	- `sudo apt-get install nodejs`
	- `sudo apt-get install npm`
- Other npm dependencies handled automatically

 
**Install/Start databox**

- Have docker running on local machine
- Run ***/scripts/start.sh*** to startup databox
	-  [!] First run will take a while, docker will need to download and install databox
	-  [!] *Default settings for docker mean you might have to run the scripts as sudo*
	- If you get the "*This node is already part of a swarm*" error, run ***/scripts/swarmleave.sh*** and try again
	- If you get random errors/infinite DNS updating/crashes while starting databox, run ***/scripts/stop.sh*** and try again
- A password will be printed on screen when databox starts, copy it for use in a bit
- Navigate to *127.0.0.1* on a web browser
- Enter the password given to you in the ***start*** script shell window

  

**Install the drivers**  *[assuming databox is running]*
- Run ***/scripts/build.sh*** to build the driver images
	-  [!] First run will take a while, large amount of dependencies are installed	
	-  [!] *Default settings for docker mean you might have to run the scripts as sudo*
- Navigate to the App Store, press the cog icon (top right).
- At the *"Upload local Manifest"* menu, select ***/patient/src/databox-manifest.json*** and click *"Add manifest"*
- Repeat for ***/caretaker/src/databox-manifest.json***
- Return to the App Store
- Click on the ***srhm-patient*** icon and click *"INSTALL"* in the page that opens
- Repeat for ***shrm-caretaker***
  
**Run the drivers**  *[assuming databox is running]*
- From the databox homescreen, just click on the tile of the driver you want to use

  

# Work on the system
There are two sections of the project on which you might want to work on. You could either work on the databox drivers, which are the frontend of the system, or on the relay server, if you're more interested in the system's backend.

### Understanding the Code
Whichever part of the system you want to work on, there are ***docco*** (http://ashkenas.com/docco/) documents to help you better understand the source code. Just look for the ***docs*** folder in the ***src*** folder of the driver/server folder you're working on. The docco files are the ones written in HTML.

- Patient Driver - ***/patient/src/docs***
- Caretaker Driver - ***/caretaker/src/docs***
- Patient Driver - ***/server/docs***

  

## Work on the drivers

**Dependencies**
- Linux / macOS local machine
- Docker Engine: https://docs.docker.com/engine/install/
- nodejs & npm - https://nodejs.org/en/download/package-manager/
	- `sudo apt-get install nodejs`
	- `sudo apt-get install npm`
- Other npm dependencies handled automatically

**Languages used**
-  **nodeJS**: Main driver functionality
-  **HTML & CSS**: Driver frontend design
-  **JS**: Raw JS for dynamic functionality in the frontend

**Code Architecture**
-  **main.js**: Core databox driver functionality
-  **helpers.js**: Constants and function definitions
-  **views/*.ejs**: HTML definitions of specific screen, eg. *settings.ejs*
-  **views/*.js**: Dynamic element handling for specific screen, eg. *settings.js*
-  **views/style.css**: Style sheet
-  **test/unit.test.js**: Unit tests *[Patient only]*

**Adding new files**
- To add any new file to the driver, it has to be declared in the driver's ***/src/Dockerfile***
- This allows it to be recognised and included in the image

**Testing your code**
- When you're done coding, run ***/scripts/build.sh*** to build the driver images
	- [!] *Default settings for docker mean you might have to run the scripts as sudo*
- Uninstall the driver from databox:
	- Launch the driver, click on the context menu (top right) -> Uninstall
- Follow the normal installation procedure to re-install the new image
	- Restarting the driver to update its image works sometimes, but the full uninstall-reinstall process is more reliable
- To view the driver's logs, run ***/scripts/patient_logs.sh*** or ***/scripts/caretaker_logs.sh*** accordingly

  

## Work on the relay server code

**Dependencies**
- nodejs & npm - https://nodejs.org/en/download/package-manager/
	- `sudo apt-get install nodejs`
	- `sudo apt-get install npm`
- Other npm dependencies handled automatically

**Languages used**
-  **nodeJS**: Entire server functionality

**Code Architecture**
-  **server.js**: Entire server functionality

**Testing your code**
- Run `node server.js`

## Setup your own relay server

**Dependencies**
- Hosted instance with some flavour of Linux
- nodejs & npm - https://nodejs.org/en/download/package-manager/
	- `sudo apt-get install nodejs`
	- `sudo apt-get install npm`
- mysql (npm) - https://www.npmjs.com/package/mysql
- mysql (for linux) - https://itsfoss.com/install-mysql-ubuntu/
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
	-  *server.crt*
	-  *server.key*
- Setup mySQL: 
	- Create the **databoxrhm** database and access credentials
	- Create the **sessions** and **databoxrhm** tables:
		- SQL commands to create the tables can be found in ***/server/tables.sql***
- Install any missing dependencies for the **/server/server.js** file, as specified above

**Run your relay server**
- Navigate to the folder created during coturn setup
- Run `sudo turnserver -o -a -f -r <realm_name> --cert <server.crt> --pkey <server.key> --pkey-pwd <password>`
- You now have the TURN daemon running
- Navigate to the **server** folder
- Run `node server.js`