// Main program loader

module.exports = {

    async load_all() {
        const fs = require('fs');
        const dir = __dirname.substr(0, __dirname.lastIndexOf( '/' ) ) + '/core';
        global.frostybot = {
            classes   : {},
            modules   : {},
            settings  : {},
            api       : {},
            commands  : {},
            methodmap : {}
        };
        this.db();
        global.frostybot.classes = require('./core.classes');
        fs.readdirSync( dir ).forEach( file => {
            if ((file.indexOf('mod.') == 0) && (file.indexOf('mod.base.') < 0)) {
                var module = file.split('.')[1];
                this.load(module)
            }
        });
        this.map_modules();
        this.init_modules();
        this.map_loader();
        this.init_webhook();
    },

    db() {
        const fs = require('fs');
        const dir = __dirname.substr(0, __dirname.lastIndexOf( '/' ) );
        const dbcfgfile = dir + '/.dbcfg';
        var dbcfgjson = fs.readFileSync(dbcfgfile, {encoding:'utf8', flag:'r'}); 
        if (dbcfgjson.length > 0) {
            var dbcfg = JSON.parse(dbcfgjson);
            var dbtype = (dbcfg.hasOwnProperty('type') ? dbcfg.type : 'sqlite').toLowerCase();
            var mod = require(dir + '/core/core.database.' + dbtype)
            var obj = (typeof(mod) == 'function') ? new mod() : mod
            global.frostybot.modules['database'] = obj
        }
    },

    load(module) {
        if (!global.hasOwnProperty('frostybot')) global.frostybot = {}
        if (!global.frostybot.hasOwnProperty('modules')) global.frostybot.modules = {}
        var mod = require('./mod.' + module)
        var obj = (typeof(mod) == 'function') ? new mod() : mod
        global.frostybot.modules[module] = obj
    },

    map_modules() {
        Object.keys(global.frostybot.modules).forEach(module => {
            global.frostybot.modules[module].mod_map();
            //if (typeof(global.frostybot.modules[module]['module_maps']) == 'function') {
                //global.frostybot.modules[module].module_maps()
            //}
        })
    },

    init_modules() {
        Object.keys(global.frostybot.modules).forEach(module => {
            if (typeof(global.frostybot.modules[module]['initialize']) == 'function') {
                global.frostybot.modules[module].initialize()
            }
            if (typeof(global.frostybot.modules[module]['register_api_endpoints']) == 'function') {
                global.frostybot.modules[module].register_api_endpoints()
            }  
            //if (typeof(global.frostybot.modules[module].description) == 'string') {
            //    global.frostybot.modules.output.notice('loaded_module', [global.frostybot.modules[module].description]);
            //}
        })
    },

    map_loader() {
        this['mod'] = global.frostybot.modules;
        this['classes'] = global.frostybot.classes;
        this['database'] = global.frostybot.modules['database'];
    },

    init_webhook() {
        /*
            var webhook = await this.mod.config.get('core:webhook');
            if (webhook == false) webhook = '/frostybot'
        */
       var webhook = '/frostybot'
        if (global.frostybot.api[webhook] == undefined) global.frostybot.api[webhook] = {
            'post|/'      : 'this:execute',     // Catch-all router for /frostybot Webhook
            'post|/:uuid' : 'this:execute',     // Catch-all router for /frostybot/:uuid Webhook (Multi User)
        };
    }

}