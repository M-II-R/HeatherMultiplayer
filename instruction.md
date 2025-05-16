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
<pre>
{
   
   id: 0,

   passw: 12345,

   type: "Password"

}
</pre>
To interact with server, client must send a password to it. (To learn how to set up a password, see below.) The example of message with password is above. You don't have to send the id in the message with the password, but it is required for all other messages.

After checking the password client will get a message with JSON structure:
<pre>
{
   id: number,
   name: string,
   type: "NewPlayer"
}
</pre>
In this message, id is an identificator for client. Send this ID in every message. If it is incorrect, you will get this message: {"error":004,"type":"error"}. Name it is auto-created name for the client. It is used to search other players by their names. You can change the name by sending a message with type "SetName". You can find a list of types of messages in messages.md.
## Environment variables
This server uses some environment variables. With it you can configure the password for server and default names list. Just add some environment variables to Node.js process:
1. PASSWORD: string.
2. NAMES: JSON string representing an array of names (strings).
