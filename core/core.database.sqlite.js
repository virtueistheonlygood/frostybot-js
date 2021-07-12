// Database Abstraction Layer

const sqlite3 = require('sqlite-async');
const frostybot_database_base_module = require('./core.database.base');

module.exports = class frostybot_database_sqlite_module extends frostybot_database_base_module {

    // Constructor

    constructor() {
        super()
        this.type = 'sqlite';
        const fs = require('fs');
        const dir = __dirname.substr(0, __dirname.lastIndexOf( '/' ) );
        const dbcfgfile = dir + '/.dbcfg';
        var dbcfgjson = fs.readFileSync(dbcfgfile, {encoding:'utf8', flag:'r'}); 
        if (dbcfgjson.length > 0) {
            var dbcfg = JSON.parse(dbcfgjson);
            var dbfile = (dbcfg.hasOwnProperty('file') ? dbcfg.file : '/usr/local/frostybot-js/database/database.db').toLowerCase();
        }
        this.db = null;
        //this.db.pragma('journal_mode = wal');
        this.name = dbfile;
    }

    // Open Database

    async open() {
        if (this.db == null) {
            this.db = await sqlite3.open(this.name);
        }
    }
    
    // Query data from the database

    async query(sql, values = []) {
        await this.open();
        try {
            var statement = await this.db.prepare(sql);
            return await statement.all(values);
        } catch (e) {
            /*
            console.log(e);
            console.log(sql);
            console.log(values);
            */
            return false;
        }
    }

    // Execute a SQL statement

    async exec(sql, values = []) {
        await this.open();
        try {
            var statement = await this.db.prepare(sql);
            return await statement.run(values);
        } catch (e) {
            /*
            console.log(e);
            console.log(sql);
            console.log(values);
            */
            return false;
        }
    }

    // Insert or Replace

    async insertOrReplace(table, data) {
        var sql = '';
        var colList = [];
        var valList = [];
        var vals = [];
        data = this.mod.utils.remove_values(data, [null, undefined]);
        for (var key in data) {
            colList.push(key);
            valList.push("?");
            vals.push(this.mod.utils.is_object(data[key]) ? JSON.stringify(data[key]) : data[key]);
        }
        sql = "INSERT OR REPLACE INTO `" + table + "` (`" + colList.join("`,`") + "`) VALUES (" + valList.join(",") + ");";
        return await this.exec(sql, vals);       
    }


}