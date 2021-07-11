// Central data management module for coordinated background refresh and caching

const frostybot_module = require('./mod.base')
var cron = require('node-cron');

module.exports = class frostybot_datasource_module extends frostybot_module {

    constructor() {
        super();
        this.description = 'Datasource Controller'
        this.datasources = {};
        this.crontab = {};
        this.distributable = []
    }

    // Register methods with the API (called by init_all() in core.loader.js)

    register_api_endpoints() {    

       // Permissions are the same for all methods, so define them once and reuse
        var permissions = {
            'standard': ['local' ],
            'provider': ['local' ]
        }

        // API method to endpoint mappings
        var api = {
            'datasource:refresh':  [],  // Refresh a datasource manually
            'datasource:start':    [],  // Start datasource autofresh
            'datasource:stop':     [],  // Stop datasource autorefresh
            'datasource:enable':   [],  // Enable datasource on this node
            'datasource:disable':  [],  // Disable datasource on this node
        }
        
        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions); // Defined in mod.base.js
        }
        
    }

    // Initialize module

    async initialize() {
    }

    // Register a callback function as a datasource for the data hub, and optionally provide a 
    // crontab string for background refresh

    async register(schedule, name, indexes = {}, callback, cachetime = 60) {
        if ((this.datasources[name] != undefined)) {
            if (this.crontab[name] != undefined) {
                this.crontab[name].destroy();
                delete this.crontab[name];
                delete this.datasources[name];
            }
        }
        var ts = (new Date).getTime() / 1000;
        if (this.datasources[name] != undefined) {
            this.datasources[name].task.stop();
            delete this.datasources[name];
        }
        this.datasources[name] = {
            callback:   callback,
            cachetime:  cachetime,
            timestamp:  null,
            expiry:     null,
            indexes:    indexes,
            task:       cron.schedule(schedule, () => {
                            this.refresh(name);
                        }, { scheduled: false })
        }
        await this.refresh(name);
        this.mod.output.notice('datasource_registered', name);
        await this.start(name);
    }

    // Get unique key for data object

    unqkey(keyfields, obj) {
        var keyparts = [];
        var objectclass = this.mod.utils.get_object_class(obj);
        if (!this.mod.utils.is_array(keyfields)) keyfields = [ keyfields ];
        for (var i = 0; i < keyfields.length; i++) {
            var keyfield = keyfields[i];
            var keyvalue = String(keyfield == 'objectclass' ? objectclass : (obj.hasOwnProperty(keyfield) ? String(obj[keyfield]) : '<null>')).toLowerCase();
            keyparts.push(keyvalue);
        }
        return keyparts.join(':');
    }

    // Get data from command

    async data(params) {
        var datasource = params.datasource;
        delete params.datasource;
        return this.select(datasource, params)
    }

    // Get data from datasource

    async select(datasource, search = undefined) {
        var query = {
            datasource: datasource,
        }
        var dsconfig = this.datasources[datasource];
        if (dsconfig != undefined) {
            var indexes = dsconfig.indexes;
            if (this.mod.redis.is_connected()) {
                // If we have Redis configured, then use it
                if (search != undefined) {
                    var keyparts = ['datasource:' + datasource];
                    for (var i = 0; i < indexes.unqkey.length; i++) {
                        var keyname = indexes.unqkey[i];
                        keyparts.push(search[keyname] != undefined ? this.normalize_index(search[keyname]) : '*');
                    }
                    var searchstr = keyparts.join(':');
                } else {
                    var searchstr = ['datasource', datasource, '*'].join(':')
                }
                var result = Object.values(await this.mod.redis.search(searchstr));
            } else {
                // Else failback to database
                if (search[indexes['idxkey1']] != undefined) query['idxkey1'] = this.normalize_index(search[indexes['idxkey1']]);
                if (search[indexes['idxkey2']] != undefined) query['idxkey2'] = this.normalize_index(search[indexes['idxkey2']]);
                if (search[indexes['idxkey3']] != undefined) query['idxkey3'] = this.normalize_index(search[indexes['idxkey3']]);
                var result = await this.database.select('datasources', query);
            }
            var data = []
            if (result.length > 0) {
                for (var i = 0; i < result.length; i++) {
                    if (result[i] !== null) {
                        var rowdata = JSON.parse(result[i].data);
                        var objectclass = result[i].objectclass.replace('frostybot_','');
                        var mod = require('../classes/classes.' + objectclass)
                        var obj = new mod();
                        var row = await obj.fromdatasource(rowdata);
                        data.push(row);
                    }
                }
            }
            return data;
        } else {
            return this.mod.output.error('datasource_notfound', [datasource]);
        }
    }

    // Delete data from datasource

    async delete(datasource, search = {}) {
        var query = {
            datasource: datasource,
        }
        var dsconfig = this.datasources[datasource];
        if (dsconfig != undefined) {
            var indexes = dsconfig.indexes;
            if (this.mod.redis.is_connected()) {
                // If we have Redis configured, then use it
                var keyparts = ['datasource:' + datasource];
                for (var i = 0; i < indexes.unqkey.length; i++) {
                    var keyname = indexes.unqkey[i];
                    keyparts.push(search[keyname] != undefined ? this.normalize_index(search[keyname]) : '*');
                }
                var searchstr = keyparts.join(':');
                await this.mod.redis.wildcarddel(searchstr);
            } else {
                // Else failback to database
                if (search[indexes['idxkey1']] != undefined) query['idxkey1'] = this.normalize_index(search[indexes['idxkey1']]);
                if (search[indexes['idxkey2']] != undefined) query['idxkey2'] = this.normalize_index(search[indexes['idxkey2']]);
                if (search[indexes['idxkey3']] != undefined) query['idxkey3'] = this.normalize_index(search[indexes['idxkey3']]);
                await this.database.delete('datasources', query);
            }
            return true;
        } else {
            return this.mod.output.error('datasource_notfound', [datasource]);
        }
    }    

    // Make regex safe

    escape_regex(string) {
        return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    // ReplaceAll function

    replace_all(str, find, replace) {
       return str.replace(new RegExp(this.escape_regex(find), 'g'), replace);
    }

    // Normalize index

    normalize_index(value) {
        var remove = ['-','/','_',' ']
        var value = String(value).toLowerCase();
        remove.forEach(char => {
            value = this.replace_all(value, char, '');
        })
        return value;
    }

    // Data Update

    async update_data(name, data) {
        if (this.datasources[name] != undefined) {
            this.datasources[name].data = data;
            var cachetime = this.datasources[name].cachetime;
            var timestamp = (new Date).getTime();
            var ttl = (cachetime * 1000)
            var expiry = timestamp + ttl;
            this.datasources[name].timestamp = timestamp
            this.datasources[name].expiry = expiry
            var objectclass = this.mod.utils.get_object_class(data[0]);
            var indexes = this.datasources[name].indexes;
            if (this.mod.utils.is_array(data) && data.length > 0)
                data.forEach(obj => {
                    var unqkey = this.unqkey(indexes.unqkey, obj);
                    var dbobj = {
                        datasource: name,
                        objectclass: objectclass,
                        timestamp: timestamp,
                        expiry: expiry,
                        ttl: ttl,
                        unqkey: unqkey,
                        idxkey1: obj.hasOwnProperty(indexes.idxkey1) ? this.normalize_index(obj[indexes.idxkey1]) : '<null>',
                        idxkey2: obj.hasOwnProperty(indexes.idxkey2) ? this.normalize_index(obj[indexes.idxkey2]) : '<null>',
                        idxkey3: obj.hasOwnProperty(indexes.idxkey3) ? this.normalize_index(obj[indexes.idxkey3]) : '<null>',
                        data: JSON.stringify(obj)
                    }  
                    if (this.mod.redis.is_connected()) {
                        // If we have Redis configured, then use it
                        var key = this.normalize_index('datasource:' + name + ':' + unqkey);
                        this.mod.redis.set(key, dbobj, ttl)
                    } else {
                        // Else failback to database
                        this.database.insertOrReplace('datasources', dbobj);
                    }
                }) 
        }
    }

    // Refresh datasource from the callback function

    async refresh(params) {
        var name = (params.name != undefined ? params.name : params);
        if ((this.datasources[name] != undefined)) {
            if (name != 'node:info') {
                this.mod.output.debug('datasource_refreshing', [name])
            }
            try {
                if (!this.mod.redis.is_connected()) {
                    var deleted = await this.database.exec('DELETE FROM datasources WHERE datasource=? AND expiry < ?', [ name, (new Date()).getTime()])
                    if (deleted > 0) {
                        this.mod.output.debug('datasource_expired', [name, deleted]);
                    }
                }
                var start = (new Date()).getTime();
                var data = await this.datasources[name].callback();
                //await this.update_data(name, data);
                var end =  (new Date()).getTime();
                var duration = (end - start) / 1000;
                var results = {
                    datasource: name,
                    records:    Array.isArray(data) ? data.length : 0,
                    duration:   duration + ' seconds'
                }
                if (name != 'node:info') {
                    this.mod.output.debug('datasource_refreshed', [name, (new Date()).getTime()])
                    this.mod.output.debug(results);
                }
                return true;
            } catch (e) {
                this.mod.output.exception(e);
            }
        }
        return false;
    }

    // Start datasource autorefresh

    async start(name) {
        if (name.name != undefined) {
            name = name.name;
        }
        if ((this.datasources[name] != undefined)) {
            var enabled = await this.is_enabled(name);
            if (enabled == true) {
                this.datasources[name].task.start();
                return this.mod.output.success('datasource_start', [name])
            } else {
                return this.mod.output.warning('datasource_disabled', [name])                
            }
        } else {
            return this.mod.output.error('datasource_notfound', [name])
        }
    }

    // Stop datasource autorefresh

    async stop(name) {
        if (name.name != undefined) {
            name = name.name;
        }
        if ((this.datasources[name] != undefined)) {
            this.datasources[name].task.stop();
            return this.mod.output.success('datasource_stop', [name])
        } else {
            return this.mod.output.error('datasource_notfound', [name])
        }
    }

    // Enable datasource on this node

    async enable(name) {
        if (name.name != undefined) {
            name = name.name;
        }
        const os = require('os')
        var nodename = os.hostname().toLowerCase();
        var subkey = ['disabled', nodename, name].join(':');
        await this.mod.settings.set('datasource', subkey, false);
        return this.start(name);
    }


    // Disable datasource on this node

    async disable(name) {
        if (name.name != undefined) {
            name = name.name;
        }
        const os = require('os')
        var nodename = os.hostname().toLowerCase();
        var subkey = ['disabled', nodename, name].join(':');
        await this.mod.settings.set('datasource', subkey, true);
        return this.stop(name);
    }

    // Check if datasource is enabled on this node

    async is_enabled(name) {
        if (name.name != undefined) {
            name = name.name;
        }
        const os = require('os')
        var nodename = os.hostname().toLowerCase();
        var subkey = ['disabled', nodename, name].join(':');
        var result = await this.mod.settings.get('datasource', subkey, false);
        return result == false ? true : false;
    }

}