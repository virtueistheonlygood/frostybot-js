
// Whitelist Module for IP Access Control 

const frostybot_module = require('./mod.base')

module.exports = class frostybot_whitelist_module extends frostybot_module {

    // Constructor

    constructor() {
        super()
        this.description = 'Whitelist Verification and Management'
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
            'whitelist:get':    [
                                  'get|/whitelist',                      // Get all whitelist entries
                                  'get|/whitelist/:ip',                  // Get whitelist entry for specific IP address or range (CIDR notation should be urlencoded)
                                ],
            'whitelist:add':    [
                                  'post|/whitelist',                     // Add a whitelist entry (IP address or CIDR range)
                                  'put|/whitelist',                      // Update a whitelist entry
                                ],
            'whitelist:delete'  : 'delete|/whitelist/:ip',               /// Delete whitelist entry for specific IP address or CIDR range CIDR notation should be urlencoded)
            'whitelist:verify'  : 'get|/whitelist/verify/:ip',           // Verify that an IP or CIDR range is whitelisted (CIDR notation should be urlencoded)
            'whitelist:enable'  : 'post|/whitelist/enable',              // Globally enable whitelist verification
            'whitelist:disable' : 'post|/whitelist/disable',             // Globally disable whitelist verification
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions); // Defined in mod.base.js
        }
        
    }

    // Add TradingView IPs

    tradingview() {
        var data = {
            ip: '52.32.178.7',
            description: 'TradingView Server Address',
            canDelete: 0
        }
        this.mod.settings.set('whitelist', data.ip, data)
        data.ip = '54.218.53.128'
        this.mod.settings.set('whitelist', data.ip, data)
        data.ip = '34.212.75.30'
        this.mod.settings.set('whitelist', data.ip, data)
        data.ip = '52.89.214.238'
        this.mod.settings.set('whitelist', data.ip, data)
        data.ip = '127.0.0.1'
        data.description = 'localhost'
        this.mod.settings.set('whitelist', data.ip, data)
    }
    

    // Get whitelist

    async get(params) {

        var schema = {
            ip: {
                optional: 'ip',
                format:   'lowercase',
            },
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [ip, ipAddress] = this.mod.utils.extract_props(params, ['ip','ipAddress']);
        ip = (ip != undefined ? ip : ipAddress);
        //this.tradingview();
        var result = (ip == undefined ? await this.mod.settings.get('whitelist') : await this.mod.settings.get('whitelist', ip, false));
        if (result !== false) {
            if (result.hasOwnProperty('ip') || result.hasOwnProperty('ipAddress') ) {
                var ip = result.ip !== undefined ? result.ip : (result.ipAddress != undefined ? result.ipAddress : false);
                this.mod.output.debug('whitelist_get', [ip, result.description]);
            } else {
                result = this.mod.utils.remove_values(result, [false, undefined]);
                Object.values(result).forEach(val => {
                    var ip = (val.ip !== undefined ? val.ip : val.ipAddress);
                    var description = String(val.description).toLowerCase() == 'localhost' ? 'localhost' : val.description;
                    var canDelete = val.canDelete;
                    val = {
                        ip: ip,
                        description: description,
                        canDelete: canDelete
                    }
                    result[ip] = val;
                    this.mod.output.debug('whitelist_get', [ip , description]);
                });
            }
            return result;
        } 
        return this.mod.output.error('whitelist_get', ip);
    }


    // Add IP to whitelist

    async add(params) {

        var schema = {
            ip: {
                required: 'ip',
                format: 'lowercase',
            },
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [ip, description] = this.mod.utils.extract_props(params, ['ip', 'description']);
        if (!await this.mod.settings.get('whitelist', ip)) {
            var data = {
                ip: ip,
                description: description,
                canDelete: 1
            }
            if (this.mod.settings.set('whitelist', ip, data)) {
                return this.mod.output.success('whitelist_add', ip);
            }
            return this.mod.output.error('whitelist_add', ip);
        }
        return this.mod.output.success('whitelist_add', ip);
    }


    // Delete IP from whitelist

    async delete(params) {
        
        var schema = {
            ip: {
                required: 'ip',
                format: 'lowercase',
            },
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var ip = this.mod.utils.extract_props(params, 'ip');
        var acl = await this.mod.settings.get('whitelist', ip);
        if (acl) {
            if (acl.canDelete == 1) {
                if (this.mod.settings.delete('whitelist', ip)) {
                    return this.mod.output.success('whitelist_delete', ip);
                }
            } else {
                return this.mod.output.error('whitelist_delete', ip + ' (protected)');
            }
        }
        return this.mod.output.error('whitelist_delete', ip + ' (not found)');
    }


    // Enable whitelist verification

    async enable() {
        if (await this.mod.settings.set('whitelist', 'enabled', true)) {
            return this.mod.output.success('whitelist_enable')
        }
        return this.mod.output.error('whitelist_enable')
    }


    // Disable whitelist verification
    
    async disable() {
        if (await this.mod.settings.set('whitelist', 'enabled', false)) {
            return this.mod.output.success('whitelist_disable')
        }
        return this.mod.output.error('whitelist_disable')
    }


    // Check if whitelist is enabled

    async is_enabled() {
        var result = await this.mod.settings.get('whitelist', 'enabled', true);
        if (result == true) {
            this.mod.output.notice('whitelist_enabled')
            return true;
        }
        this.mod.output.notice('whitelist_disabled')
        return false
    }

    // Verify IP in whitelist

    async verify(ip) {
        if (ip == '<cluster>') return true;
        if (await this.is_enabled()) {
            if (this.mod.utils.is_object(ip) && (ip.hasOwnProperty('ip') || ip.hasOwnProperty('ipaddress')))
              ip = ip.ip != undefined ? ip.ip : ip.ipaddress;
            var acl = await this.mod.settings.get('whitelist', ip);
            if (acl) {
                this.mod.output.notice('whitelist_verify', ip);
                return true
            }
            return this.mod.output.error('whitelist_verify', ip);
        } else {
            //this.mod.output.notice('whitelist_disabled')
            return true
        }
    }




};