// Central data management module for coordinated background refresh and caching

const frostybot_module = require('./mod.base')
var cron = require('node-cron');

module.exports = class frostybot_datasources_module extends frostybot_module {

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
            'datasources:refresh':  [],  // Refresh a datasource manually
            //'datasources:redistribute':   [],  // Redistribute datasources
            //'datasources:distribution':   [],  // Get datasource/node distribution
            //'datasources:data':     [],  // Get data from a datasource
            'datasources:start':    [],  // Start datasource autofresh
            'datasources:stop':     [],  // Stop datasource autorefresh
        }
        
        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions); // Defined in mod.base.js
        }
        
    }

    // Initialize module

    async initialize() {
        //var self = this;
        //setInterval(async function() {
        //    await self.stopstart()
        //}, 30000)
    }

    // Register a callback function as a datasource for the data hub, and optionally provide a 
    // crontab string for background refresh

    async register(name, indexes = {}, callback, cachetime = 60, distribute = true) {
        if (distribute) this.distributable.push(name);
        if ((this.datasources[name] != undefined)) {
            if (this.crontab[name] != undefined) {
                this.crontab[name].destroy();
                delete this.crontab[name];
                delete this.datasources[name];
            }
        }
        var ts = (new Date).getTime() / 1000;
        this.datasources[name] = {
            callback:   callback,
            cachetime:  cachetime,
            timestamp:  null,
            expiry:     null,
            indexes:    indexes
        }
        await this.redistribute();
        await this.refresh(name);
        this.mod.output.notice('datasource_registered', name);
    }

    // Redistribute jobs amongst active nodes

/*
    findleastused(jobqty) {
        var max = Math.max(...Object.values(jobqty));
        var hosts = Object.keys(jobqty);
        var leasthost = null;
        for (var i = 0; i < hosts.length; i++) {
            var host = hosts[i];
            if (jobqty[host] <= max) { leasthost = host; max = jobqty[host]; }
        }
        return leasthost;
    }

    async redistribute() {
        var thisnode = (await this.mod.status.get_node_info())[0].hostname;
        var distribution = await this.mod.settings.get('core','distributer',false);
        var nodes = await this.mod.status.nodes();
        var hosts = [];
        var jobqty = {};
        for (var i = 0; i < nodes.length; i++) {
            jobqty[nodes[i].hostname] = 0;
            hosts.push(nodes[i].hostname);
        }
        if (distribution == false) distribution = {};
        var alljobs = Object.keys(distribution);
        var jobs = this.distributable;
        for (var i = 0; i < jobs.length; i++) 
            if (!alljobs.includes(jobs[i])) 
                alljobs.push(jobs[i]) 
        for (var i = 0; i < alljobs.length; i++) {
            var jobname = alljobs[i];
            if (!distribution.hasOwnProperty(jobname)) distribution[jobname] = { available: [], active: []};
            var available = distribution[jobname].available;
            available = available.filter(host => hosts.includes(host));
            if ((!available.includes(thisnode)) && (this.distributable.includes(jobname))) available.push(thisnode);
            var leastused = this.findleastused(jobqty);
            jobqty[leastused]++;
            distribution[jobname] = {
                available: available,
                active: leastused
            }

        }
        await this.mod.settings.set('core', 'distributer', distribution);
    }

    // Get current distribution

    async distribution() {
        return await this.mod.settings.get('core','distributer',false);
    }

    // Check if this node is responsible for running a job

    async isactive(name) {
        return true;
        var distribution = await this.mod.settings.get('core','distributer',false);
        if (distribution == false) distribution = {};
        if (distribution.hasOwnProperty(name)) {
            var thisnode = (await this.mod.status.get_node_info())[0].hostname;
            var activenode = distribution[name].active;
            if (thisnode == activenode) return true;
        }
        return false;
    }

    // Stop or start jobs based on distribution

    async stopstart() {
        for (var i = 0; i < this.distributable; i++) {
            var name = this.distributable[i]
            var active = await this.isactive(name)
            if (active == true) {
                if (this.crontab[name] == undefined) {
                    this.mod.output.debug('custom_message', ['Starting job: ' + name])
                    await this.start(name, 120)
                }
            } else {
                if (this.crontab[name] != undefined) {
                    this.mod.output.debug('custom_message', ['Stopping job: ' + name])
                    await this.stop(name)
                }
            }
        }        
    }
*/
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

    async select(datasource, search = {}) {
        var query = {
            datasource: datasource,
        }
        var dsconfig = this.datasources[datasource];
        if (dsconfig != undefined) {
            var indexes = dsconfig.indexes;
            if (search[indexes['idxkey1']] != undefined) query['idxkey1'] = this.normalize_index(search[indexes['idxkey1']]);
            if (search[indexes['idxkey2']] != undefined) query['idxkey2'] = this.normalize_index(search[indexes['idxkey2']]);
            if (search[indexes['idxkey3']] != undefined) query['idxkey3'] = this.normalize_index(search[indexes['idxkey3']]);
            var result = await this.database.select('datasources', query);
            var data = []
            if (result.length > 0) {
                for (var i = 0; i < result.length; i++) {
                    var rowdata = JSON.parse(result[i].data);
                    var objectclass = result[i].objectclass.replace('frostybot_','');
                    var row = (new this.classes[objectclass]()).fromdatasource(rowdata);
                    data.push(row);
                }
            }
            if (datasource != 'node:info') this.mod.output.debug('datasource_results', [datasource, data.length])
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
            if (search[indexes['idxkey1']] != undefined) query['idxkey1'] = this.normalize_index(search[indexes['idxkey1']]);
            if (search[indexes['idxkey2']] != undefined) query['idxkey2'] = this.normalize_index(search[indexes['idxkey2']]);
            if (search[indexes['idxkey3']] != undefined) query['idxkey3'] = this.normalize_index(search[indexes['idxkey3']]);
            var result = await this.database.delete('datasources', query);
            //this.mod.output.debug('datasource_deleted', [datasource, result.changes])
            return true;
        } else {
            return this.mod.output.error('datasource_notfound', [datasource]);
        }
    }    

    // Normalize index

    normalize_index(value) {
        var remove = ['-','/','_',' ']
        var value = String(value).toLowerCase();
        remove.forEach(char => {
            value = value.replace(char,'');
        })
        return value;
    }

    // Data Update

    async update_data(name, data) {
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
                this.database.insertOrReplace('datasources', dbobj);
            }) 
    }

    // Refresh datasource from the callback function

    async refresh(params) {
        var name = (params.name != undefined ? params.name : params);
        if ((this.datasources[name] != undefined)) {
            if (name != 'node:info') {
                this.mod.output.debug('datasource_refreshing', [name])
            }
            try {
                var deleted = await this.database.exec('DELETE FROM datasources WHERE datasource=? AND expiry < ?', [ name, (new Date()).getTime()])
                if (deleted > 0) {
                    this.mod.output.debug('datasource_expired', [name, deleted]);
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

    start(name, interval) {
        if ((name.name != undefined) && (interval == undefined)) {
            name = name.name;
            interval = name.interval;
        }
        if (interval == undefined) interval = 180;
        if ((this.datasources[name] != undefined)) {
            if (this.mod.utils.is_numeric(interval)) {
                var self = this;
                this.crontab[name] = setInterval(async () =>  {
                    await self.refresh(name);
                }, interval * 1000);                   
                this.mod.output.notice('datasource_registered', [name]);
            }
        }
    }

    // Stop datasource autorefresh

    stop(name) {
        if (name.name != undefined) {
            name = name.name;
        }
        if ((this.crontab[name] != undefined)) {
            clearInterval(this.crontab[name]);
        }        
    }

}