// Redis Module

const frostybot_module = require(__dirname.substr(0, __dirname.lastIndexOf( '/' ) ) + '/core/mod.base')

const asyncredis = require("async-redis");

module.exports = class frostybot_redis_module extends frostybot_module {

    constructor() {
        super()
        this.description = 'Redis Cache Handler'
        const fs = require('fs');
        const dir = __dirname.substr(0, __dirname.lastIndexOf( '/' ) );
        const cfgfile = dir + '/.rediscfg';
        this.connected = false;
        try {
            if (fs.existsSync(cfgfile)) {
                var rediscfgjson = fs.readFileSync(cfgfile, {encoding:'utf8', flag:'r'}); 
                if (rediscfgjson.length > 0) {
                    var rediscfg = JSON.parse(rediscfgjson);
                    this.host = rediscfg.host
                    this.port = rediscfg.port
                    this.client = asyncredis.createClient(this.port, this.host, {socket_keepalive: true});
                    var _this = this
                    this.client.on("error", function(error) {
                        _this.mod.output.error('redis_error', [error])
                    });    
                    this.client.on("ready", function(error) {
                        _this.connected = true;
                        //_this.mod.output.success('redis_ready', [_this.host + ':' + _this.port])
                    });    
                }
            }
        } catch(err) {
            this.mod.output.warning('redis_disabled')
        }
    }

    // Register methods with the API (called by init_all() in core.loader.js)

    register_api_endpoints() {

        // Permissions are the same for all methods, so define them once and reuse
        var permissions = {
            'standard': ['local'],
            'provider': ['local'],
        }

        // API method to endpoint mappings
        var api = {
            'redis:monitor':  'get|/redis/monitor',      // Monitor Redis
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions); // Defined in mod.base.js
        }
        
    }

    // Check if redis is connected

    is_connected() {
        return this.connected == true ? true : false;
    }

    // Make regex safe

    escape_regex(string) {
        return string.replace(/[.*+\-?^${}()|[\]\\]/g, '\\$&'); // $& means the whole matched string
    }

    // ReplaceAll function

    replace_all(str, find, replace) {
        return str.replace(new RegExp(this.escape_regex(find), 'g'), replace);
    }

    // Cleanup key

    normalize_key(value) {
        var remove = ['-','/','_',' ']
        var value = String(value).toLowerCase();
        remove.forEach(char => {
            value = this.replace_all(value, char, '');
        })
        return value;
    }
    

    // Set value

    async set(key, value, ttl = null) {
        if ([null, undefined].includes(value)) {
            return await this.del(key)
        } else {
            if (ttl == null)
                return await this.client.set(this.normalize_key(key), JSON.stringify(value));
            else 
                return await this.client.setex(this.normalize_key(key), ttl, JSON.stringify(value));
        }
    }

    // Get value

    async get(key) {
        var get = await this.client.get(this.normalize_key(key));
        try {
            var result = JSON.parse(get)
        } catch (e) {
            var result = get;
        }
        return result;
    }

    // Delete key

    async del(key) {
        await this.client.del(this.normalize_key(key));
        return true;
    }

    // Wildcard Key Search

    async search(search) {
        var keys = await this.client.keys(this.normalize_key(search));
        var result = {};
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            result[key] = await this.get(key);
        }
        return result;
    }

    // Delete keys using wilcard

    async wildcarddel(search) {
        var keys = await this.client.keys(this.normalize_key(search));
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            await this.client.unlink(key)
        }
        return true;
    }

    // Monitor

    monitor() {
        return this.client.monitor();
    }

}

