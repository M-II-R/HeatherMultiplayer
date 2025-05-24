//(c) M-II-R 2025 - MIT license.
//In this project I used some code from OxeyMultiplayer of Oxey405 (https://github.com/oxey405/OxeyMultiplayer).
console.log("HeatherMultiplayer (c) M-II-R 2025 - Under MIT license.");
console.log("You can find source code at https://github.com/M-II-R/HeatherMultiplayer");

//Importing all modules
const WebSocket = require("ws");
const crypto = require("crypto");
const express = require("express");
require("dotenv").config();
const DB = process.env.STORAGE && process.env.STORAGE != "NONE" ? require("./storage") : undefined;
let USEDB = false;
if (process.env.STORAGE && process.env.STORAGE != "NONE") {
    USEDB = true;
}
const INDEX = '/index.html';
const names = process.env.NAMES != undefined ? JSON.parse(process.env.NAMES) : ["Dark Knight", "Dancing Devil", "Crasy Scientist", "Carefree Angel", "Rose With Gun", "Annihilator", "Sly"]; // Auto-names for players.
const passw = process.env.PASSWORD || "MyPassword836";
const time = process.env.TIME != undefined ? Number(process.env.TIME) : 86400000; // Default - 24 hours.
const MAXTIME = process.env.MAXTIME != undefined ? Number(process.env.MAXTIME) : 2678400000;

let language = Intl.DateTimeFormat().resolvedOptions().locale.substring(0, 2);
const i18n = require('./i18n');
const localisation = i18n[language];

var wcl = []; // Waiting clients
var rcl = {}; // Ready clients. A structure with arrays of players, sorted by type of game. {type : {"players", "plnumb", "plinteam", "data"}}. Type - string. In data: fill: bool. 
var games = []; // Games

const server = express()
    .disable("x-powered-by")
    .use((req, res) => res.sendFile(INDEX, { root: __dirname }))
    .listen(process.env.PORT || 3000, () => {
        console.log(localisation["webapp-start"])
    });
function isEqual(name1 = "", name2 = "") {
    if (name2.startsWith(name1)) {
        let numb = Number(name2.substring(name1.length));
        return numb;
    }
    else {
        return -1;
    }
}
async function CreateName(nm = "Player") {
    let namenumber = 1;
    let arrhelp = new Set();
    if (USEDB) {
        const namesarr = await DB.Names();
        namesarr.forEach(name => {
            let eqn = isEqual(nm, name);
            if (eqn > 0) {
                arrhelp.add(eqn);
            }
            else if (eqn == 0) {
                arrhelp.add(1);
            }
        });
    }
    wcl.forEach(cl => {
        let eqn = isEqual(nm, cl.name);
        if (eqn > 0) {
            arrhelp.add(eqn);
        }
        else if (eqn == 0) {
            arrhelp.add(1);
        }
    });
    for (let key in rcl) {
        if (rcl[key]) {
            rcl[key].players.forEach(player => {
                let eqn = isEqual(nm, player.name)
                if (eqn > 0) {
                    arrhelp.add(eqn);
                }
                else if (eqn == 0) {
                    arrhelp.add(1);
                }
            });
        }
    }
    games.forEach(game => {
        for (let i = 0; i < game.clients.length; i++) {
            let client = game.clients[i];
            let eqn = isEqual(nm, client.name)
            if (eqn > 0) {
                arrhelp.add(eqn);
            }
            else if (eqn == 0) {
                arrhelp.add(1);
            }
        }
    });
    if (arrhelp.size == 0) {
        return nm;
    }
    else {
        let arr = [...arrhelp];
        arr.sort((a, b) => a - b);
        let r = false;
        for (let i = 0; i < arr.length && !r; i++) {
            let num = arr[i];
            if (namenumber < num) {
                r = true;
            }
            else {
                namenumber += 1;
            }
        }
        return nm + String(namenumber);
    }
}

class Message {
    constructor() { }
    static Create(data, type) {
        let mess = new Message();
        mess.type = type;
        mess.id = data.id
        if (type == "NewPlayer") { // For player.
            mess.name = data.name; // Automatically created name.
        }
        else if (type == "Password") { // For server.
            mess.passw = data.passw;
        }
        else if (type == "Action") { // For server and players. Client's action (for example, walking). Only if player is in the game.
            mess.name = data.name;
            mess.data = data.data;
            mess.gid = data.gid; // gid - Game ID.
        }
        else if (type == "SetName") { // For server. Only if the player is is not ready. Change player's name. Name must be unique.
            mess.name = data.name;
        }
        else if (type == "Name") { // For player. Name changed. If player wanted to set already used by other player name, system will append number to it. E. g.: Player -> Player4 
            mess.name = data.name;
        }
        else if (type == "Invite") { // Invite player to team. Only if player is not ready. For server.
            mess.name = data.name; // Name of invitated client.
            mess.invname = data.invname; // Name of inviting client.
        }
        else if (type == "AcceptInv") { // Accept player's invitation. Only if player is not ready. For server.
            mess.name = data.name; // Name of invitated client.
            mess.invname = data.invname; // Name of inviting client.
        }
        else if (type == "DeclineInv") { // Decline player's invitation. Only if player is not ready. For server or for player.
            mess.name = data.name; // Name of invitated client.
            mess.invname = data.invname; // Name of inviting client.
        }
        else if (type == "ErrInv") { // For player.
            mess.name = data.name;
            mess.err = data.err;
        }
        else if (type == "Join") { // Player joins team. For player.
            mess.jname = data.jname; // Name of joining client.
            mess.name = data.name; // Name of client he joined.
        }
        else if (type == "Ready") { // Player is ready. For server. "plnumb" - a number of players in the game; "plinteam" - a number of players in team; "team" - number of players in team.
            mess.gametype = data.gametype;
            mess.plnumb = data.plnumb;
            mess.plinteam = data.plinteam;
            mess.team = data.team; // Team - number of players in team.
            mess.data = data.data; // data.fill.
        }
        else if (type == "ReadyErr") { // For player.
            mess.err = data.err;
        }
        else if (type == "NReady") { // Player is not ready. For server.
            //mess.team = data.team;
        }

        // Now is not realised.

        /*else if (type == "Get") { // Client wants to get some data. For server.
            mess.what = data.what;
            //mess.ingame = data.ingame; // ingame: is player in game? In what game? 
        }*/

        else if (type == "AnswGet") { // Data for client.
            mess.what = data.what;
            mess.data = data.data;
            //mess.ingame = data.ingame;
        }
        else if (type == "GameStart") { // Game is starting. For player. Send message to client. "plnumb" - a number of players in the game; "plinteam" - a number of players in team; "team" - an array with IDs of players in team.
            mess.gametype = data.gametype;
            mess.players = data.players; // IDs and names.
            mess.plnumb = data.plnumb;
            mess.plinteam = data.plinteam;
            //mess.team = data.team; // Clients already know their teams.
            mess.data = data.data;
            mess.gid = data.gid; // gid - Game ID.
        }
        else if (type == "LeaveTeam") { // For server and for players. Only if player is not ready.
            //mess.gametype = data.gametype;
            //mess.team = data.team; // Names.
            mess.name = data.name;
        }
        else if (type == "LeaveGame") { // For server and for players.
            mess.gid = data.gid; // gid - Game ID.
            mess.name = data.name;
            //mess.team = data.team;
        }
        else if (type == "Send") { // For server and for player.
            mess.name = data.name; // Name of receiver.
            mess.data = data.data; // Data to send.
        }
        else if (type == "Register") { // For server. Only if player is not ready.
            mess.name = data.name;
            mess.passw = data.passw;
        }
        else if (type == "LogIn") { // For server. Only if player is not ready.
            mess.name = data.name;
            mess.passw = data.passw;
        }
        else if (type == "RemoveAcc") { // For server. Only if player is not ready.
            mess.name = data.name;
            mess.passw = data.passw;
            mess.data = data.data;
        }
        else if (type == "LoggedIn") { // For player.
            mess.success = data.success;
        }
        else if (type == "Read") { // For server. Read data from storage.
            mess.name = data.name;
            mess.what = data.what; // Type of data (e. g. score).
        }
        else if (type == "Write") { // For server. Write data to storage.
            mess.name = data.name;
            mess.what = data.what;
            mess.data = data.data; // Data to write.
        }
        else { // If the message is incorrect.
            mess.type = "Invalid";
        }
        return mess;
    }
}

class Client {
    constructor(id, socket, clname = "Player", data) {
        this.id = id;
        this.socket = socket;
        this.name = clname;
        this.data = data; // Team, game etc.
        this.isClient = true;
        if (!this.data.team) {
            this.data.team = []; // Array with clients. 
        }
    }
}
class Game {
    constructor(clients, type, plnumb, plinteam) {
        this.clients = clients;
        this.type = type;
        this.plnumb = plnumb;
        this.plinteam = plinteam;
        this.GameID = crypto
            .createHash("sha256")
            .update(crypto.randomBytes(16))
            .digest()
            .toString("hex")
            .substring(0, 16);
    }
}

function LeaveTeam(pla, cmess) {
    for (let i = pla.data.team.length - 1; i >= 0; i--) {
        pla.data.team[i].socket.send(JSON.stringify(cmess));
    }
    pla.data.team.forEach(memb => {
        let r = false;
        for (let i = 0; i < memb.data.team.length && !r; i++) {
            if (memb.data.team[i].id == pla.id) {
                memb.data.team.splice(i, 1); r = true;
            }
        }
    });
    pla.data.team = [];
}

function OnConnection(client) {
    let ID = 0;
    let arrhelp = [];

    wcl.forEach(cl => {
        arrhelp.push(cl.id);
    });
    for (let key in rcl) {
        if (rcl[key]) {
            rcl[key].players.forEach(player => {
                arrhelp.push(player.id);
            });
        }
    }
    games.forEach(game => {
        for (let i = 0; i < game.clients.length; i++) {
            let client = game.clients[i];
            arrhelp.push(client.id);
        }
    });

    arrhelp.sort((a, b) => a - b);
    let ready = false;
    for (let i = 0; i < arrhelp.length && !ready; i++) {
        if (ID != arrhelp[i]) {
            ready = true;
        }
        else {
            ID += 1;
        }
    }
    let name = "";
    let numb = crypto.randomInt(0, names.length - 1);
    if (numb < names.length) {
        name = names[numb];
    }
    else {
        if (names[0]) {
            name = names[0];
        }
        else {
            name = "Player";
        }
    }
    let namee = CreateName(name);
    namee.then(name => {
        let nclient = new Client(ID, client, name, {});
        wcl.push(nclient);
        console.log(localisation["player-connect"] + ID + ")");
        let stms = Message.Create({ 'id': ID, 'name': name }, "NewPlayer");
        client.send(JSON.stringify(stms));
        client.passwiscorrect = true;
    });
}

const wss = new WebSocket.Server({ server });

wss.on("connection", (client) => {
    // Create client only if password is correct.

    client.on("message", (message) => {
        /**
         * Error codes:
         * 1: Cannot format input.
         * 2: No data recieved.
         * 3: Invalid data.
         * 4: Wrong origin (sender).
         * 5: Packet too heavy.
         */
        if ((message.length > 1024)) {
            client.send(`{"error":5, "type":"error"}`);
            return;
        }
        else if (message.length == 0) {
            client.send(`{"error":2, "type":"error"}`);
            return;
        }
        let mess;
        try {
            mess = JSON.parse(message);
        }
        catch (err) {
            client.send(`{"error":1,"type":"error"}`);
            console.log(err);
            return;
        }
        let cmess = Message.Create(mess, mess.type);
        if (cmess.type == "Password") {
            if (cmess.passw == passw) {
                OnConnection(client);
            }
            else {
                client.close();
            }
        }
        else if (client.passwiscorrect) {
            switch (cmess.type) {
                case "Invalid":
                    client.send(`{"error":3,"type":"error"}`);
                    console.log(localisation["invalid-msg"]);
                    break;
                case "SetName": // Name changing.
                    for (let i = 0, r = false; i < wcl.length && !r; i++) {
                        let cl = wcl[i];
                        if (cl.socket == client) { // Find sender.
                            if (cl.id != cmess.id) {
                                client.send(`{"error":4,"type":"error"}`);
                                console.log(localisation["invalid-id"]); r = true;
                                return;
                            }
                            else {
                                let newnamee = CreateName(cmess.name);
                                newnamee.then(newname => {
                                    cl.name = newname;
                                    let namemess = Message.Create({ id: cmess.id, name: newname }, "Name");
                                    client.send(JSON.stringify(namemess));
                                });
                                r = true;
                            }
                        }
                    }
                    break;
                case "Invite":
                    var ready = false;
                    wcl.forEach(cl => { // Find sender.
                        if (cl.socket == client) {
                            if (cl.id != cmess.id) {
                                client.send(`{"error":4,"type":"error"}`);
                                console.log(localisation["invalid-id"]);
                                return;
                            }
                        }
                    });
                    for (let i = 0; i < wcl.length && !ready; i++) {
                        if (wcl[i].name == cmess.name) {
                            wcl[i].socket.send(JSON.stringify(cmess));
                            ready = true;
                        }
                    }
                    if (ready == false) {
                        let errmess = Message.Create({ id: cmess.id, name: cmess.invname, err: "Cannot find player: " + cmess.name }, "ErrInv");
                        client.send(JSON.stringify(errmess));
                    }
                    break;
                case "AcceptInv": // Player don't must be ready.
                    var ready = false;
                    let pl;
                    for (let i = 0; i < wcl.length && !ready; i++) {
                        if (wcl[i].socket == client) { // Find sender.
                            if (wcl[i].id == cmess.id) {
                                pl = wcl[i];
                            }
                            else {
                                client.send(`{"error":4,"type":"error"}`);
                                console.log(localisation["invalid-id"]);
                                return;
                            }
                        }
                    }
                    for (let i = 0; i < wcl.length && !ready; i++) {
                        if (wcl[i].name == cmess.invname) {
                            wcl[i].socket.send(JSON.stringify(cmess));
                            if (pl) {
                                //setTimeout(() => {
                                for (let a = 0; a < wcl[i].data.team.length; a++) { // Add player to team.
                                    wcl[i].data.team[a].team.push(pl);
                                    let jm = Message.Create({ id: cmess.id, jname: pl.name, name: wcl[i].data.team[a].name }, "Join");
                                    wcl[i].data.team[a].socket.send(JSON.stringify(jm));
                                    pl.team.push(wcl[i].data.team[a]);
                                    pl.socket.send(JSON.stringify(Message.Create({ id: cmess.id, jname: wcl[i].data.team[a].name, name: pl.name }, "Join")));
                                }
                                //}, 500);
                                wcl[i].data.team.push(pl);
                                wcl[i].socket.send(JSON.stringify(Message.Create({ id: cmess.id, jname: pl.name, name: wcl[i].name }, "Join")));
                                pl.data.team.push(wcl[i]);
                                pl.socket.send(JSON.stringify(Message.Create({ id: cmess.id, jname: wcl[i].name, name: pl.name }, "Join")));
                            }
                            ready = true;
                        }
                    }
                    if (ready == false) {
                        let errmess = Message.Create({ id: cmess.id, name: cmess.name, err: "Cannot find player: " + cmess.invname }, "ErrInv");
                        client.send(JSON.stringify(errmess));
                    }
                    break;
                case "DeclineInv":
                    var ready = false;
                    wcl.forEach(cl => {
                        if (cl.socket == client) {
                            if (cl.id != cmess.id) { // Find sender.
                                client.send(`{"error":4,"type":"error"}`);
                                console.log(localisation["invalid-id"]);
                                return;
                            }
                        }
                    });
                    for (let i = 0; i < wcl.length && !ready; i++) {
                        if (wcl[i].name == cmess.invname) {
                            wcl[i].socket.send(JSON.stringify(cmess));
                            ready = true;
                        }
                    }
                    for (let key in rcl) {
                        if (rcl[key]) {
                            for (let i = 0; i < rcl[key].players.length && !ready; i++) {
                                if (rcl[key].players[i].name == cmess.invname) {
                                    rcl[key].players[i].socket.send(JSON.stringify(cmess));
                                    ready = true;
                                }
                            }
                        }
                    }
                    if (ready == false) {
                        let errmess = Message.Create({ id: cmess.id, name: cmess.name, err: "Cannot find player: " + cmess.invname }, "ErrInv");
                        client.send(JSON.stringify(errmess));
                    }
                    break;
                case "Ready":
                    let cli;
                    if (cmess.plinteam < cmess.team + 1) { // Team + player.
                        client.send(JSON.stringify(Message.Create({ id: cmess.id, err: "Too big team" }, "ReadyErr")));
                        return;
                    }
                    else {
                        var ready = false;
                        for (let i = 0; i < wcl.length && !ready; i++) {
                            if (wcl[i].socket == client) {
                                if (wcl[i].id == cmess.id) {
                                    cli = wcl[i];
                                    ready = true;
                                }
                                else {
                                    client.send(`{"error":4,"type":"error"}`);
                                    console.log(localisation["invalid-id"]);
                                    return;
                                }
                            }
                        }
                        if (ready && cli) {
                            let read = true;
                            if (cli.data.team.length > 0) {
                                for (let a = 0; a < cli.data.team.length && read; a++) {
                                    if (!cli.data.team[a].data.ready) {
                                        read = false;
                                    }
                                }
                            }
                            cli.data.ready = true;
                            if (read) {
                                if (rcl[cmess.gametype]) {
                                    rcl[cmess.gametype].players.push(cli);
                                    cli.data.team.forEach(pla => {
                                        rcl[cmess.gametype].players.push(pla);
                                        for (let i = 0, r = false; i < wcl.length && !r; i++) {
                                            if (wcl[i].socket == pla.socket) {
                                                wcl.splice(i, 1); r = true;
                                            }
                                        }
                                    });
                                    for (let i = 0, r = false; i < wcl.length && !r; i++) {
                                        if (wcl[i].socket == cli.socket) {
                                            wcl.splice(i, 1); r = true;
                                        }
                                    }
                                }
                                else {
                                    rcl[cmess.gametype] = { "players": [], "plnumb": cmess.plnumb, "plinteam": cmess.plinteam, "data": cmess.data };
                                    rcl[cmess.gametype].players.push(cli);
                                    cli.data.team.forEach(pla => {
                                        rcl[cmess.gametype].players.push(pla);
                                        for (let i = 0, r = false; i < wcl.length && !r; i++) {
                                            if (wcl[i].socket == pla.socket) {
                                                wcl.splice(i, 1); r = true;
                                            }
                                        }
                                    });
                                    for (let i = 0, r = false; i < wcl.length && !r; i++) {
                                        if (wcl[i].socket == cli.socket) {
                                            wcl.splice(i, 1); r = true;
                                        }
                                    }
                                }

                                if (rcl[cmess.gametype].players.length >= rcl[cmess.gametype].plnumb) {
                                    console.log(rcl[cmess.gametype].players.length);
                                    let plwtt = []; // Players without team.
                                    let plwt = []; // Players with team.
                                    let pwst = []; // Players with small team.
                                    rcl[cmess.gametype].players.forEach(pla => {
                                        if (pla.data.team.length == 0) {
                                            plwtt.push(pla);
                                        }
                                        else {
                                            plwt.push(pla);
                                        }
                                    });
                                    let parr = [];
                                    if (plwt.length == 0) {
                                        parr = parr.concat(rcl[cmess.gametype].players.slice(0, rcl[cmess.gametype].plnumb));
                                        rcl[cmess.gametype].players.splice(0, rcl[cmess.gametype].plnumb);
                                        if (rcl[cmess.gametype].players.length == 0) {
                                            delete rcl[cmess.gametype];
                                        }
                                    }
                                    else {
                                        let pln1 = plwtt.length; // plwtt.
                                        let pln2; // plwt.
                                        let pln3; // pwst.
                                        let tn; // Number of teams.
                                        let ntn; // Number of teams we need.
                                        for (let i = plwt.length - 1; i >= 0; i--) { // Fill array with players having small team.
                                            if (plwt[i].data.team.length + 1 < rcl[cmess.gametype].plinteam) {
                                                pwst.push(plwt[i]);
                                                plwt.splice(i, 1);
                                            }
                                        }
                                        pln2 = plwt.length; pln3 = pwst.length; ntn = rcl[cmess.gametype].plnumb / rcl[cmess.gametype].plinteam;
                                        if (pln1 == 0) {
                                            if (pln2 == rcl[cmess.gametype].plnumb) {
                                                for (let i = 0; i < pln2; i++) {
                                                    let p = plwt[i]; let r = false;
                                                    for (let a = 0; a < rcl[cmess.gametype].players.length && !r; a++) {
                                                        if (rcl[cmess.gametype].players[a].id == p.id) {
                                                            r = true;
                                                            rcl[cmess.gametype].players.splice(a, 1);
                                                            parr.push(p);
                                                        }
                                                    }
                                                }
                                            }
                                            else {
                                                let plwt2 = [];
                                                let pwst2 = [];
                                                for (let i = plwt.length - 1; i >= 0; i--) {
                                                    let arr = [];
                                                    let p = plwt[i];
                                                    arr.push(p);
                                                    p.data.team.forEach(pl => {
                                                        let r = false;
                                                        for (let a = 0; a < plwt.length && !r; a++) {
                                                            if (pl.id == plwt[a].id) {
                                                                r = true;
                                                                plwt.splice(a, 1);
                                                            }
                                                        }
                                                        arr.push(pl);
                                                    });
                                                    i = plwt.length - 1;
                                                    plwt2.push(arr);
                                                }
                                                for (let i = pwst.length - 1; i >= 0; i--) {
                                                    let arr = [];
                                                    let p = pwst[i];
                                                    arr.push(p);
                                                    p.data.team.forEach(pl => {
                                                        let r = false;
                                                        for (let a = 0; a < pwst.length && !r; a++) {
                                                            if (pl.id == pwst[a].id) {
                                                                r = true;
                                                                pwst.splice(a, 1);
                                                            }
                                                        }
                                                        arr.push(pl);
                                                    });
                                                    i = pwst.length - 1;
                                                    pwst2.push(arr);
                                                }
                                                // Now we have two arrays with lists of commands.
                                                tn = plwt2.length;
                                                // tn != ntn: plwt.length != plnumb.
                                                if (tn >= ntn) {
                                                    let ntn2 = ntn - ntn % 1;
                                                    if (rcl[cmess.gametype].data.fill) {
                                                        if (ntn2 < ntn) {
                                                            ntn2 += 1;
                                                        }
                                                        if (tn >= ntn2) {
                                                            for (let i = 0; i < ntn2; i++) {
                                                                plwt2[i].forEach(pl => {
                                                                    parr.push(pl);
                                                                });
                                                            }

                                                            parr.forEach(pl => {
                                                                let r = false;
                                                                for (let i = 0; i < rcl[cmess.gametype].players.length && !r; i++) {
                                                                    if (pl.id == rcl[cmess.gametype].players[i].id) {
                                                                        r = true;
                                                                        rcl[cmess.gametype].players.splice(i, 1);
                                                                    }
                                                                }
                                                            });
                                                        }
                                                    }
                                                    else {
                                                        if (tn >= ntn2) {
                                                            for (let i = 0; i < ntn2; i++) {
                                                                plwt2[i].forEach(pl => {
                                                                    parr.push(pl);
                                                                });
                                                            }

                                                            parr.forEach(pl => {
                                                                let r = false;
                                                                for (let i = 0; i < rcl[cmess.gametype].players.length && !r; i++) {
                                                                    if (pl.id == rcl[cmess.gametype].players[i].id) {
                                                                        r = true;
                                                                        rcl[cmess.gametype].players.splice(i, 1);
                                                                    }
                                                                }
                                                            });
                                                        }
                                                    }
                                                }
                                            }
                                            // If there are no players without team, we can't fill teams.
                                            if (rcl[cmess.gametype].players.length == 0) {
                                                delete rcl[cmess.gametype];
                                            }
                                        }
                                        else { // pln != 0; pln2 + pln3 != 0.
                                            let plwt2 = [];
                                            let pwst2 = [];
                                            for (let i = plwt.length - 1; i >= 0; i--) {
                                                let arr = [];
                                                let p = plwt[i];
                                                arr.push(p);
                                                p.data.team.forEach(pl => {
                                                    let r = false;
                                                    for (let a = 0; a < plwt.length && !r; a++) {
                                                        if (pl.id == plwt[a].id) {
                                                            r = true;
                                                            plwt.splice(a, 1);
                                                        }
                                                    }
                                                    arr.push(pl);
                                                });
                                                i = plwt.length - 1;
                                                plwt2.push(arr);
                                            }
                                            for (let i = pwst.length - 1; i >= 0; i--) {
                                                let arr = [];
                                                let p = pwst[i];
                                                arr.push(p);
                                                p.data.team.forEach(pl => {
                                                    let r = false;
                                                    for (let a = 0; a < pwst.length && !r; a++) {
                                                        if (pl.id == pwst[a].id) {
                                                            r = true;
                                                            pwst.splice(a, 1);
                                                        }
                                                    }
                                                    arr.push(pl);
                                                });
                                                i = pwst.length - 1;
                                                pwst2.push(arr);
                                            }
                                            pln2 = plwt2.length;
                                            pln3 = pwst2.length;
                                            let ntn2 = ntn - ntn % 1;
                                            if (rcl[cmess.gametype].data.fill && ntn2 < ntn) {
                                                ntn2 += 1;
                                            }
                                            let arr1 = plwt2.slice(0, plwt2.length);
                                            let arr2 = pwst2.slice(0, pwst2.length); let arr22 = pwst2.slice(0, pwst2.length);
                                            let arr3 = plwtt.slice(0, plwtt.length);
                                            let th = ntn2 / 3 - ntn2 / 3 % 1; // 1/3 of ntn2.
                                            let ap1 = [];
                                            let ap2 = [];
                                            let ap3 = [];
                                            if (arr1.length >= th) {
                                                ap1 = arr1.slice(0, th); arr1.splice(0, th);
                                            }
                                            else {
                                                ap1 = arr1; arr1 = [];
                                            }
                                            for (let i = 0; i < arr2.length && i < th; i++) {
                                                let a = arr2[i];
                                                let ah = a.slice(0, a.length);
                                                if (rcl[cmess.gametype].plinteam - a.length > 1) {
                                                    let r = false;
                                                    for (let b = i + 1; b < arr2.length && !r; b++) {
                                                        if (arr2[b].length + ah.length < rcl[cmess.gametype].plinteam) {
                                                            ah = ah.concat(arr2[b]);
                                                            arr2.splice(b, 1);
                                                        }
                                                        else if (arr2[b].length + ah.length == rcl[cmess.gametype].plinteam) {
                                                            ah = ah.concat(arr2[b]);
                                                            arr2.splice(b, 1);
                                                            r = true;
                                                        }
                                                    }
                                                }
                                                if (rcl[cmess.gametype].plinteam - ah.length == 1 && arr3.length > 0) {
                                                    ah.push(arr3[0]);
                                                    arr3.splice(0, 1);
                                                }
                                                if (ah.length == rcl[cmess.gametype].plinteam) {
                                                    arr2.splice(i, 1); i--;
                                                    ap2.push(ah);
                                                    arr22 = arr2.slice(0, arr2.length);
                                                }
                                                else {
                                                    arr2 = arr22.slice(0, arr22.length);
                                                }
                                            } // First and second arrays are filled.
                                            let n = ntn2 - ap1.length - ap2.length;
                                            if (arr3.length / rcl[cmess.gametype].plinteam - (arr3.length / rcl[cmess.gametype].plinteam % 1) >= n) {
                                                for (let i = 0; i < n; i += rcl[cmess.gametype].plinteam) {
                                                    let ah = arr3.slice(i, i + rcl[cmess.gametype].plinteam);
                                                    ap3.push(ah);
                                                }
                                            }
                                            else {
                                                let a1 = [], a2 = [];
                                                for (let i = 0; i < arr2.length && i < n; i++) {
                                                    let a = arr2[i];
                                                    let ah = a.slice(0, a.length);
                                                    if (rcl[cmess.gametype].plinteam - a.length > 1) {
                                                        let r = false;
                                                        for (let b = i + 1; b < arr2.length && !r; b++) {
                                                            if (arr2[b].length + ah.length < rcl[cmess.gametype].plinteam) {
                                                                ah = ah.concat(arr2[b]);
                                                                arr2.splice(b, 1);
                                                            }
                                                            else if (arr2[b].length + ah.length == rcl[cmess.gametype].plinteam) {
                                                                ah = ah.concat(arr2[b]);
                                                                arr2.splice(b, 1);
                                                                r = true;
                                                            }
                                                        }
                                                    }
                                                    if (rcl[cmess.gametype].plinteam - ah.length == 1 && arr3.length > 0) {
                                                        ah.push(arr3[0]);
                                                        arr3.splice(0, 1);
                                                    }
                                                    if (ah.length == rcl[cmess.gametype].plinteam) {
                                                        arr2.splice(i, 1); i--;
                                                        a1.push(ah);
                                                        arr22 = arr2.slice(0, arr2.length);
                                                    }
                                                    else {
                                                        arr2 = arr22.slice(0, arr22.length);
                                                    }
                                                }
                                                ap2 = ap2.concat(a1);
                                                if (a1.length < n) {
                                                    a2 = arr1.slice(0, n - a1.length); arr1.splice(0, n - a1.length);
                                                    ap1 = ap1.concat(a2);
                                                }
                                            }
                                            let ap4 = [].concat(ap1, ap2, ap3);
                                            if (ap4.length == ntn2) {
                                                ap4.forEach(tm => {
                                                    tm.forEach(memb => {
                                                        parr.push(memb);
                                                        for (let i = 0; i < tm.length; i++) {
                                                            if (tm[i].socket != memb.socket && memb.data.team.find(obj => obj.socket == tm[i].socket) == undefined) {
                                                                memb.data.team.push(tm[i]); tm[i].data.team.push(memb);
                                                                memb.socket.send(JSON.stringify(Message.Create({ "name": memb.name, "jname": tm[i].name, "id": cmess.id }, "")));
                                                                tm[i].socket.send(JSON.stringify(Message.Create({ "name": tm[i].name, "jname": memb.name, "id": cmess.id }, "")));
                                                            }
                                                        }
                                                    });
                                                });
                                                let r = false;
                                                for (let i = 0; i < parr.length; i++) {
                                                    for (let a = 0; a < rcl[cmess.gametype].players.length && !r; a++) {
                                                        if (rcl[cmess.gametype].players[a].id == parr[i].id) {
                                                            rcl[cmess.gametype].players.splice(a, 1);
                                                            r = true;
                                                        }
                                                    }
                                                }
                                                if (rcl[cmess.gametype].players.length == 0) {
                                                    delete rcl[cmess.gametype];
                                                }
                                            }
                                        }
                                    }
                                    if (parr.length != 0) {
                                        let game = new Game(parr, cmess.gametype, cmess.plnumb, cmess.plinteam);
                                        games.push(game);
                                        let clfmess = [];
                                        for (let i = 0; i < game.clients.length; i++) {
                                            let cl = game.clients[i];
                                            let clie = {
                                                "id": cl.id,
                                                "name": cl.name
                                            };
                                            clfmess.push(clie);
                                        }
                                        console.log(localisation["all-connected"] + game.GameID);
                                        for (let i = 0; i < game.clients.length; i++) {
                                            let cl = game.clients[i];
                                            cl.socket.send(JSON.stringify(Message.Create({ "id": cmess.id, "players": clfmess, "plnumb": cmess.plnumb, "plinteam": cmess.plinteam, /*"team":*/ "data": "", "gid": game.GameID }, "GameStart")));
                                        }
                                    }
                                }
                            }
                        }
                        else {
                            client.send(JSON.stringify(Message.Create({ id: cmess.id, err: "Can't find player" }, "ReadyErr")));
                            return;
                        }
                    }
                    break;
                case "NReady":
                    cli = undefined;
                    for (let key in rcl) {
                        if (rcl[key]) {
                            for (let i = 0; i < rcl[key].players.length && !ready; i++) {
                                if (rcl[key].players[i].socket == client) {
                                    if (rcl[key].players[i].id != cmess.id) {
                                        client.send(`{"error":4,"type":"error"}`);
                                        console.log(localisation["invalid-id"]);
                                        return;
                                    }
                                    cli = rcl[key].players[i]; cli.data.ready = false;
                                    rcl[key].players.splice(i, 1);
                                    if (cli.data.team.length != 0) {
                                        for (let a = 0; a < cli.data.team.length; a++) {
                                            let r = false;
                                            for (let b = 0; b < rcl[key].players.length && !r; b++) {
                                                if (cli.data.team[a].socket == rcl[key].players[b].socket) {
                                                    rcl[key].players.splice(b, 1);
                                                    r = true;
                                                }
                                            }
                                            if (rcl[key].players.length == 0) {
                                                delete rcl[key];
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                    if (cli) {
                        cli.data.ready = false;
                    }
                    break;
                case "LeaveTeam":
                    var ready = false;
                    let pla;
                    for (let i = 0; i < wcl.length && !ready; i++) {
                        if (wcl[i].socket == client) { // Find sender.
                            if (wcl[i].id == cmess.id) {
                                pla = wcl[i];
                                LeaveTeam(pla, cmess);
                            }
                            else {
                                client.send(`{"error":4,"type":"error"}`);
                                console.log(localisation["invalid-id"]);
                                return;
                            }
                        }
                    }
                    break;
                case "LeaveGame":
                    var id = cmess.gid;
                    for (let i = 0; i < games.length; i++) {
                        if (games[i].GameID == id) {
                            let clind = games[i].clients.findIndex(obj => obj.socket == client);
                            if (clind != -1) {
                                let cl = games[i].clients[clind];
                                if (cl && cl.id == cmess.id) {
                                    LeaveTeam(cl, Message.Create({ "id": cmess.id, "name": cmess.name }, "LeaveTeam"));
                                    games[i].clients.forEach(cli => {
                                        if (cli.id != cl.id) {
                                            cli.socket.send(JSON.stringify(cmess));
                                        }
                                    });
                                    games[i].clients.splice(clind, 1);
                                    if (games[i].clients.length == 0) {
                                        games.splice(i, 1);
                                    }
                                    wcl.push(cl);
                                }
                                else {
                                    client.send(`{"error":4,"type":"error"}`);
                                    console.log(localisation["invalid-id"]);
                                    return;
                                }
                            }
                        }
                    }
                    break;
                case "Action":
                    var id = cmess.gid;
                    for (let i = 0; i < games.length; i++) {
                        if (games[i].GameID == id) {
                            let clind = games[i].clients.findIndex(obj => obj.socket == client);
                            if (clind != -1) {
                                let cl = games[i].clients[clind];
                                if (cl && cl.id == cmess.id) {
                                    games[i].clients.forEach(cli => {
                                        if (cli.id != cl.id) {
                                            cli.socket.send(JSON.stringify(cmess));
                                        }
                                    });
                                }
                                else {
                                    client.send(`{"error":4,"type":"error"}`);
                                    console.log(localisation["invalid-id"]);
                                    return;
                                }
                            }
                        }
                    }
                    break;
                case "Send":
                    var ready = false;
                    for (let i = 0; i < wcl.length && !ready; i++) {
                        if (wcl[i].name == cmess.name) {
                            wcl[i].socket.send(JSON.stringify(cmess)); ready = true;
                        }
                    }
                    if (!ready) {
                        for (let key in rcl) {
                            for (let i = 0; i < rcl[key].players.length && !ready; i++) {
                                if (rcl[key].players[i].name == cmess.name) {
                                    rcl[key].players[i].socket.send(JSON.stringify(cmess)); ready = true;
                                }
                            }
                        }
                    }
                    if (!ready) {
                        for (let i = 0; i < games.length && !ready; i++) {
                            for (let b = 0; b < games[i].clients.length && !ready; b++) {
                                if (games[i].clients[b].name == cmess.name) {
                                    games[i].clients[b].socket.send(JSON.stringify(cmess)); ready = true;
                                }
                            }
                        }
                    }
                    break;
                case "Register":
                    for (let i = 0, r = false; i < wcl.length && !r; i++) {
                        let cl = wcl[i];
                        if (cl.socket == client) { // Find sender.
                            if (cl.id != cmess.id) {
                                client.send(`{"error":4,"type":"error"}`);
                                console.log(localisation["invalid-id"]);
                                return;
                            }
                            else {
                                if (USEDB) {
                                    let successful = DB.Reg(cmess.name, cmess.passw);
                                    successful.then(result => {
                                        if (!result.isErr) {
                                            client.send(JSON.stringify(Message.Create({ id: cmess.id, success: result }, "LoggedIn")));
                                        }
                                        else {
                                            client.send(JSON.stringify(Message.Create({ id: cmess.id, success: false }, "LoggedIn")));
                                        }
                                    });
                                }
                                else {
                                    client.send(JSON.stringify(Message.Create({ id: cmess.id, success: false }, "LoggedIn")));
                                }

                            }
                        }
                    }
                    break;
                case "LogIn":
                    for (let i = 0, r = false; i < wcl.length && !r; i++) {
                        let cl = wcl[i];
                        if (cl.socket == client) { // Find sender.
                            if (cl.id != cmess.id) {
                                client.send(`{"error":4,"type":"error"}`);
                                console.log(localisation["invalid-id"]);
                                return;
                            }
                            else {
                                if (USEDB) {
                                    let successful = DB.LogIn(cmess.name, cmess.passw);
                                    successful.then(result => {
                                        if (!result.isErr) {
                                            client.send(JSON.stringify(Message.Create({ id: cmess.id, success: result }, "LoggedIn")));
                                        }
                                        else {
                                            client.send(JSON.stringify(Message.Create({ id: cmess.id, success: false }, "LoggedIn")));
                                        }
                                    });
                                }
                                else {
                                    client.send(JSON.stringify(Message.Create({ id: cmess.id, success: false }, "LoggedIn")));
                                }
                            }
                        }
                    }
                    break;
                case "RemoveAcc":
                    for (let i = 0, r = false; i < wcl.length && !r; i++) {
                        let cl = wcl[i];
                        if (cl.socket == client) { // Find sender.
                            if (cl.id != cmess.id) {
                                client.send(`{"error":4,"type":"error"}`);
                                console.log(localisation["invalid-id"]);
                                return;
                            }
                            else {
                                if (USEDB) {
                                    DB.Rem(cmess.name, cmess.passw);
                                }
                            }
                        }
                    }
                    break;
                case "Write": // Maybe I should check if player writes his data or not?
                    if (USEDB) {
                        DB.Write(cmess.name, cmess.what, cmess.data);
                    }
                    /*let sender;
                    for (let i = 0; i < wcl.length && !sender; i++) {
                        if (wcl[i].socket == client) {
                            if (wcl[i].id == cmess.id) {
                                sender = wcl[i];
                            }
                            else {
                                client.send(`{"error":4,"type":"error"}`);
                                console.log(localisation["invalid-id"]);
                                return;
                            }
                        }
                    }
                    if (!sender) {
                        for (let key in rcl) {
                            for (let i = 0; i < rcl[key].players.length && !sender; i++) {
                                if (rcl[key].players[i].socket == client) {
                                    rcl[key].players[i].socket.send(JSON.stringify(cmess));
                                }
                            }
                        }
                    }
                    if (!sender) {
                        for (let i = 0; i < games.length && !sender; i++) {
                            for (let b = 0; b < games[i].clients.length && !sender; b++) {
                                if (games[i].clients[b].name == cmess.name) {
                                    games[i].clients[b].socket.send(JSON.stringify(cmess)); sender = true;
                                }
                            }
                        }
                    }*/
                    break;
                case "Read":
                    if (USEDB) {
                        let answ = DB.Read(cmess.name, cmess.what);
                        answ.then(result => {
                            client.send(JSON.stringify(Message.Create({ id: cmess.id, what: cmess.what, data: result }, "AnswGet")));
                        });
                    }
                    break;
                default:
                    break;
            }
        }
    });
    client.on('close', () => {
        let cl;
        if (client.passwiscorrect) {
            let ready = false;
            for (let i = 0; i < wcl.length && !ready; i++) {
                if (wcl[i].socket == client) {
                    cl = wcl[i]; ready = true;
                    LeaveTeam(cl, Message.Create({ "id": cl.id, "name": cl.name }, "LeaveTeam"));
                    wcl.splice(i, 1);
                }
            }
            if (!ready) {
                for (let key in rcl) {
                    for (let i = 0; i < rcl[key].players.length && !ready; i++) {
                        if (rcl[key].players[i].socket == client) {
                            cl = rcl[key].players[i]; ready = true;
                            LeaveTeam(cl, Message.Create({ "id": cl.id, "name": cl.name }, "LeaveTeam"));
                            rcl[key].players.splice(i, 1);
                        }
                    }
                    if (rcl[key].players.length == 0) {
                        delete rcl[key];
                    }
                }
            }
            if (!ready) {
                for (let i = 0; i < games.length && !ready; i++) {
                    for (let b = 0; b < games[i].clients.length && !ready; b++) {
                        if (games[i].clients[b].socket == client) {
                            cl = games[i].clients[b]; ready = true;
                            LeaveTeam(cl, Message.Create({ "id": cl.id, "name": cl.name }, "LeaveTeam"));
                            //setTimeout(() => {
                            games[i].clients.forEach(cli => {
                                if (cli.id != cl.id) {
                                    cli.socket.send(JSON.stringify(Message.Create({ "id": cl.id, "name": cl.name, "gid": games[i].GameID }, "LeaveGame")));
                                }
                            });
                            //}, 500);
                            games[i].clients.splice(i, 1);

                        }
                    }
                    if (games[i].clients.length == 0) {
                        games.splice(i, 1);
                    }
                }
            }
            if (ready) {
                console.log(localisation["client-deleted"] + cl.id);
            }
        }
        else {
            console.log(localisation["client-deleted"] + "Not autorized");
        }
    });
});

let wsState = "closed";
wss.on("listening", () => {
    wsState = "listening";
});

wss.on("close", () => {
    wsState = "closed";
});

let timerId;
if (USEDB) {
    timerId = setInterval(() => {
        DB.Clean(MAXTIME);
    }, time);
}

process.on("exit", (code) => {
    // Close the server.
    wss.close();
    if (USEDB) {
        clearInterval(timerId);
    }
    wcl = [];
    rcl = {};
    games = [];
    // Exit message.
    console.log(localisation["closed-server"] + code);
});