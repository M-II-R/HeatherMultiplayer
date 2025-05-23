let storage = {
    Read: async function (name, data) { },
    Write: async function (name, what, data) { },
    Rem: async function (name, data) { },
    Reg: async function (name, passw) { },
    LogIn: async function (name, passw) { },
    Names: async function () { },
    End: async function () { },
    Clean: async function (MAXTIME) { },
    db: undefined
}
var stbackend;
switch (process.env.STORAGE) {
    case "REDIS":
        stbackend = require("redis");
        storage.db = stbackend.createClient();
        storage.db.on('error', (err) => console.log('Redis Client Error', err));
        storage.db.connect();
        storage.End = async function () { await this.db.quit() };
        storage.Read = async function (name, data) {
            try {
                return await this.db.hGet(name, data);
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        };
        storage.Write = async function (name, what, data) {
            try {
                if (await this.db.exists(name)) {
                    await this.db.hSet(name, what, data);
                }
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        };
        storage.Reg = async function (name, passw) {
            try {
                if (await this.db.exists(name)) {
                    return false;
                }
                else {
                    await this.db.hSet(name, "passw", passw, "lastserverlogin", Date.now());
                    return true;
                }
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        }
        storage.LogIn = async function (name, passw) {
            try {
                if (!await this.db.exists(name)) {
                    return false;
                }
                else {
                    let password = await this.db.hGet(name, "passw");
                    if (passw == password) {
                        this.db.hSet(name, "lastserverlogin", Date.now());
                        return true;
                    }
                    else {
                        return false;
                    }
                }
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        }
        storage.Rem = async function (name, data) {
            try {
                if (data) {
                    await this.db.hDel(name, data);
                }
                else {
                    await this.db.hDel(name);
                }
                return undefined;
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        }
        storage.Names = async function () {
            try {
                let arrn = [];
                const scanIterator = this.db.scanIterator({
                    MATCH: '*',
                    COUNT: 400
                });

                for await (const key of scanIterator) {
                    arrn.push(key);
                }
                return arrn;
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        }
        storage.Clean = async function (MAXTIME) {
            try {
                const scanIterator = this.db.scanIterator({
                    MATCH: '*',
                    COUNT: 400
                });
                for await (const key of scanIterator) {
                    let pl = this.db.hGetAll(key);
                    if (Number(pl.lastserverlogin) + MAXTIME < Date.now()) {
                        this.Rem(key);
                        console.log ("Removed " + key + ". Last login: " + pl.lastserverlogin);
                    }
                }
            }
            catch (err) {
                console.log(err);
            }
        }
        break;
    case "LEVEL":
        const {Level} = require("level");
        stbackend = Level;
        storage.db = new Level('./players-db', { valueEncoding: 'json' });
        storage.Read = async function (name, data) {
            try {
                return await this.db.get(name)[data];
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        };
        storage.Write = async function (name, what, data) {
            try {
                let pl = await this.db.get(name);
                pl[what] = data;
                await this.db.put(name, pl);
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        };
        storage.Reg = async function (name, passw) {
            try {
                await this.db.get(name);
                return false
            }
            catch (err) {
                if (err.notFound) {
                    this.db.put(name, { passw: passw, lastserverlogin: Date.now() });
                    return true;
                }
                else {
                    console.log(err);
                    err.isErr = true;
                    return (err);
                }
            }
        };
        storage.LogIn = async function (name, passw) {
            try {
                let pl = this.db.get(name); pl.lastserverlogin = Date.now();
                if (pl.passw == passw) {
                    this.db.put(pl);
                    return true;
                }
                else {
                    return false;
                }
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        }
        storage.Rem = async function (name, data) {
            try {
                if (data) {
                    let pl = this.db.get(name);
                    delete pl[data];
                    this.db.put(name, pl);
                }
                else {
                    await this.db.del(name);
                }
                return undefined;
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        }
        storage.Names = async function () {
            try {
                let arrn = [];
                for await (const [name, data] of this.db.iterator()) {
                    arrn.push(name);
                }
                return arrn;
            }
            catch (err) {
                console.log(err);
                err.isErr = true;
                return (err);
            }
        }
        storage.Clean = async function (MAXTIME) {
            try {
                for await (const [name, data] of this.db.iterator()) {
                    let pl = data;
                    if (Number(pl.lastserverlogin) + MAXTIME < Date.now()) {
                        this.Rem(name);
                        console.log ("Removed " + name + ". Last login: " + pl.lastserverlogin);
                    }
                }
            }
            catch (err) {
                console.log(err);
            }
        }
        break;
    case "NONE":
        break;
}
module.exports = storage;