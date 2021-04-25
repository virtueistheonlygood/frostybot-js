// Caching Subsystem

md5 = require('md5');
const NodeCache = require( "node-cache" )
const cache = new NodeCache( { stdTTL: 30, checkperiod: 120 } )

const frostybot_module = require('./mod.base')

module.exports = class frostybot_cache_module extends frostybot_module {

    // Constructor

    constructor() {
        super()
        this.description = 'Cache Handler'
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
            'cache:flush':  'delete|/cache/flush',      // Flush the cache
            'cache:stats':  'get|/cache/stats',         // Get cache hit statistics
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions); // Defined in mod.base.js
        }
        
    }

    // Set an item in cache

    set( key, result, time ) {
        return cache.set(key, result, time);
    }

    // Get an item from cache

    get( key ) {
        return cache.get(key);
    }

    // Get cache stats

    stats() {
        var stats = cache.getStats()
        var total = stats.hits + stats.misses;
        var ratio = (total > 0 ? Math.round((stats.hits / total) * 100) : 0);
        var result = {
            hit: stats.hits,
            miss: stats.misses,
            total: total,
            ratio: ratio
        };
        this.mod.output.success('cache_stats', this.mod.utils.serialize(result))
        return result
    }

    
    // Flush cache

    flush(quiet = false) {
        var stats = cache.getStats()
        var total = stats.hits + stats.misses;
        cache.flushAll();
        if (quiet === true)
            this.mod.output.debug('cache_flush', total)
        else
            this.mod.output.success('cache_flush', total)
        return total;
    }

    
    // Cache auto flush (garbage collection)

    gc() {
        var cachegcpct = 20;
        var randomgc = Math.random() * 100;
        if (randomgc >= (100 - cachegcpct)) {
            this.flush();
        }
    }

}