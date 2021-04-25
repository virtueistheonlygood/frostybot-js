// System status monitoring

const frostybot_module = require('./mod.base')

module.exports = class frostybot_status_module extends frostybot_module {

   // Constructor

    constructor() {
        super()
        this.description = 'System Status Monitoring'
    }

    // Register methods with the API (called by init_all() in core.loader.js)

    register_api_endpoints() {

        // Permissions are the same for all methods, so define them once and reuse
        var permissions = {
            'standard': [ 'local', 'loopback' ],
            'provider': [ 'local', 'loopback' ],
        }

        // API method to endpoint mappings
        var api = {
            'status:up':      [
                                'get|/status',                         // For backwards compatibility
                                'get|/status/up',                      // Check if node is up (used by load balancer monitoring)
                              ],
            'status:update':    'post|/status/update',                 // Trigger this node to update it's status information
            'status:nodes':     'get|/status/nodes',                   // Get information about all the nodes participating in this instance
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions); // Defined in mod.base.js
        }
        
    }

    // Return HTTP 200 if node status is up (used for load balancer monitoring)
    
    async up() {
        return true;
    }

    // Update node status information for this node (used in a cron task)

    async update() {
        const os = require('os');
        const host = os.hostname().toLowerCase();
        const nets = os.networkInterfaces();
        const ips = [];
        for (const name of Object.keys(nets)) {
            for (const net of nets[name]) {
                // Skip over non-IPv4 and internal (i.e. 127.0.0.1) addresses
                if (net.family === 'IPv4' && !net.internal) {
                    ips.push(net.address);
                }
            }
        }
        var d = new Date();
        var ts = d.getTime();
        var hostinfo = {
            hostname: host,
            ip: ips,
            timestamp: ts
        }
        await this.mod.settings.set('node', host, hostinfo);
        return true;
    }

    // Get information about all the nodes participating in this instance

    async nodes() {
        var nodes = await this.mod.settings.get('node');
        return nodes;
    }


}