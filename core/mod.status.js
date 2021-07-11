// System status monitoring

const frostybot_module = require('./mod.base')
const frostybot_nodeinfo = require('../classes/classes.nodeinfo')
const { execSync } = require('child_process');

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
            'status:clusterips':'get|/status/clusterips',              // Get list of cluster IP addresses
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions); // Defined in mod.base.js
        }
        
    }

    // Initialize module

    async initialize() {

        // Start node info datasource

        await this.register_nodes_datasource();

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

    // Get all IP addresses in the cluster

    async clusterips() {
        var nodes = await this.nodes();
        var ip = [];
        for (var i = 0; i< nodes.length; i++) {
            var ips = nodes[i].ip;
            for (var j = 0; j < ips.length; j++) {
                if (!ip.includes(ips[j])) ip.push(ips[j]);
            }
        }
        return ip;
    }

    // Get information about all the nodes participating in this instance

    async nodes() {
        return await this.mod.datasource.select('node:info', {});
    }

    // Refresh node info datasource

    async get_node_info() {
        const os = require('os');
        const cpu = os.cpus()
        var cpuinfo = {
            qty: cpu.length,
            model: cpu[0].model,
            speed: cpu[0].speed
        }
        var info = {
            hostname:   os.hostname().toLowerCase(),
            os:         os.release(),
            uptime:     os.uptime(),
            cpu:        cpuinfo,
            memory: {
                total:  os.totalmem(),
                free:   os.freemem(),
            },     
        }

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
        try {
            const stdout = execSync('dig +short myip.opendns.com @resolver1.opendns.com');
            var publicIp = String(stdout).trim();
            if (this.mod.utils.is_ip(publicIp)) 
                ips.push(publicIp);
        } catch (e) {   
        }
        info['ip'] = ips;
        var obj = new frostybot_nodeinfo(info.hostname, info.os, info.uptime, info.cpu, info.memory, info.ip);
        await this.mod.datasource.update_data('node:info', [obj])
        return [obj];
    }

    // Poll node for status information

    async register_nodes_datasource() {
        var indexes = {
            unqkey  : ['hostname'],
            idxkey1 : 'hostname'
        }
        this.mod.datasource.register('* * * * *', 'node:info', indexes, async() => {
            return await this.mod.status.get_node_info();
        }, 60);
    }


}