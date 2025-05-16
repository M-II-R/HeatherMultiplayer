# How to use?
## First step: install the server.
You need Node.js to run this server.
1. Download source code from GitHub.
2. If you've downloaded from .zip, extract files in a folder.
3.  Open folder in a terminal.
4. In terminal, type in **npm i** to install dependencies.
5. Type in **npm start** or **node index.js** to start the server.

The server is ready to use. Now you need to know how to interact with it.

## Interaction
Every message sended to server must be created using a template: it must be a JSON string, representing a structure. General view of the structure: {data, type}, where data consists of numerous elements containing information about the message. You can create a message by converting the structure to JSON.

Example of the structure:

{
id: 0,
passw: 12345,
type: "Password"
}

To interact with server, client must send a password to it. (To learn how to set up a password, see below.)
## Continuation will be here.
