// API Permissions Handling

const frostybot_module = require('./mod.base')
var context = require('express-http-context');

// Module

module.exports = class frostybot_permissions_module extends frostybot_module {

      constructor() {
        super()
        this.description = 'Security and Permissions Handler'
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
            'permissions:get':  [
                                    'get|/permissions',              // Retrieve all configured permissions
                                    'get|/permissions/:cmd',         // Retrieve permissions for a specific command
                                    'get|/permissions/:cmd/:type',   // Retrieve permissions for a specific command and permission set
                                ],
            'permissions:add':      'post|/permissions/:cmd/:type',   // Add permissions for a specific command and permission set
            'permissions:delete':   'delete|/permissions/:cmd/:type', // Remove permissions for a specific command and permission set
            'permissions:reset':    'delete|/permissions',           // Reset all permissions back to default
            'permissions:set_type': 'post|/permissions/type',        // Set the permission set that is being uysed by the instance (standard / provider)
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions); // Defined in mod.base.js
        }
        
    }

    // Check permissions for the command for the specified lockdown type

    async check(type, params) {
        params = params.hasOwnProperty('body') ? params.body : params;
        var command = params.hasOwnProperty('command') ? params.command : undefined;
        var ip = context.get('srcIp');

        var acl = {};
        //acl['ip'] = ip;
        
        acl['any'] = true;
        var uuidparams = await this.mod.user.uuid_from_params(params);
        if (uuidparams != false) {
            acl['core']  = uuidparams.type == 'core'  ? true : false;
            acl['user']  = uuidparams.type == 'user'  ? true : false;
            acl['token'] = uuidparams.type == 'token' ? true : false;
        }

        var clusterips = await this.mod.status.clusterips();
        if (!Array.isArray(clusterips)) clusterips = [];
        acl['local'] = (clusterips.concat(['127.0.0.1','::1','<cluster>'])).includes(ip) ? true : false;
        acl['cluster'] = (clusterips.concat(['<cluster>'])).includes(ip) ? true : false;
        acl['remote'] = !acl.local;
        acl['multiuser'] = await this.mod.user.multiuser_isenabled();
        acl['singleuser'] = !acl.multiuser;

        if (params.hasOwnProperty('_loopbacktoken_')) {
          if (!global.frostybot.hasOwnProperty('_loopbacktokens_')) global.frostybot['_loopbacktokens_'] = [];
          if (global.frostybot['_loopbacktokens_'].includes(params['_loopbacktoken_'])) {
            var loopbacktoken = params['_loopbacktoken_'];
            global.frostybot['_loopbacktokens_'] = global.frostybot['_loopbacktokens_'].filter(lbt => lbt != loopbacktoken);
            acl['loopback'] = true;
          }
        }

        // If this is a signal, then make sure the provider is whitelisted

        if (String(command).toLocaleLowerCase() == 'signals:send') {
          var provider = params.hasOwnProperty('provider') ? params.provider : undefined;
          if (provider != undefined) {
            acl['providerwhitelist'] = await this.mod.signals.check_ip(provider, ip);
          }
        }
   
        var def = global.frostybot.commands[command].permissions;
        var permissions = await this.mod.settings.get('permissions', command, def);
        var perms = [];
        if (permissions.hasOwnProperty(type))
            var perms = permissions[type];
        
        if (Array.isArray(perms)) {
            for (var i = 0; i < perms.length; i++) {
                var check = (perms[i] + ',').split(',').filter((v) => v != '');
                var result = true;
                for (var j = 0; j < check.length; j++) {
                    var entry = check[j];
                    if (!acl.hasOwnProperty(entry) || acl[entry] === false) {
                        result = false;
                        break;
                    }
                }
                if (result === true) {
                    //this.mod.output.debug('permission_granted', [type, command, check]);
                    //this.mod.output.debug('custom_object', ['Required Permissions', perms]);
                    //var currentperms = Object.keys(acl).filter(key => acl[key] == true)
                    //this.mod.output.debug('custom_object', ['Current Permissions', currentperms]);
                    return true;
                }
            }
        }

        this.mod.output.debug('permission_denied', [type, command, perms]);
        this.mod.output.debug('custom_object', ['Required Permissions', perms]);
        var currentperms = Object.keys(acl).filter(key => acl[key] == true)
        this.mod.output.debug('custom_object', ['Current Permissions', currentperms]);
        //this.mod.output.debug(acl);
        //return true;
        return false;
        
    }

    // Get permissions for the command for the specified lockdown type

    async get(params) {

        var schema = {
            type:  { optional: 'string', format: 'lowercase', oneof: ['standard','provider'] },
            cmd:   { optional: 'string', format: 'lowercase' },
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [type, command] = this.mod.utils.extract_props(params, ['type', 'cmd']);   
        var def = default_perm.hasOwnProperty(command) ? default_perm[command] : {
            standard: [],    
            provider: []     
        }
        var permissions = await this.mod.settings.get('permissions', command);
        if (permissions == null) return def;
        if (type == undefined) {
            if (this.mod.utils.is_object(permissions)) {
                var sorted = {};
                Object.keys(permissions).sort((a,b) => a > b ? 1 : -1).forEach(key => {
                    sorted[key] = permissions[key];
                })
                permissions = sorted;
            }
            return permissions;
        } else {
            if (permissions.hasOwnProperty(type)) {
                return permissions[type];
            }        
        }
        return def; 
    }

    // Add permissions for the command for the specified lockdown type

    async add(params) {

        var schema = {
            type:  { required: 'string', format: 'lowercase', oneof: ['standard','provider'] },
            cmd:   { required: 'string', format: 'lowercase' },
            perms: { required: 'string', format: 'lowercase' }
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [type, command, perms] = this.mod.utils.extract_props(params, ['type', 'cmd', 'perms']);   
        var def = global.frostybot.commands[command].permissions;

        var perms = (perms + ',').replace(/ /g,'')
                     .split(',')
                     .sort((a, b) => (a < b ? -1 : 1))
                     .filter((v) => v != '')
                     .join(',')
        var permissions = await this.mod.settings.get('permissions', command, def);
        if (!permissions.hasOwnProperty(type)) {
            permissions[type] = [];
        }
        if (!permissions[type].includes(perms)) {
            permissions[type].push(perms)
            if (await this.mod.settings.set('permissions', command, permissions)) {
                return this.mod.output.success('permissions_add', [type, command, perms]);
            } else {
                return this.mod.output.error('permissions_add', [type, command, perms]);
            }
        } else {
            return this.mod.output.success('permissions_add', [type, command, perms]);
        }
    }

    // Delete permissions for the command for the specified lockdown type

    async delete(params) {

        var schema = {
            type:  { required: 'string', format: 'lowercase', oneof: ['standard','provider'] },
            cmd:   { required: 'string', format: 'lowercase' },
            perms: { required: 'string', format: 'lowercase' }
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [type, command, perms] = this.mod.utils.extract_props(params, ['type', 'cmd', 'perms']);   
        var def = global.frostybot.commands[command].permissions;

        var perms = (perms + ',').replace(/ /g,'')
                     .split(',')
                     .sort((a, b) => (a < b ? -1 : 1))
                     .filter((v) => v != '')
                     .join(',')
        var permissions = await this.mod.settings.get('permissions', command, def);
        if (!permissions.hasOwnProperty(type)) {
            permissions[type] = [];
        }
        if (permissions[type].includes(perms)) {
            permissions[type] = permissions[type].filter((v) => v != perms);
            if (await this.mod.settings.set('permissions', command, permissions)) {
                return this.mod.output.success('permissions_delete', [type, command, perms]);
            } else {
                return this.mod.output.error('permissions_delete', [type, command, perms]);
            }
        } else {
            return this.mod.output.success('permissions_delete', [type, command, perms]);
        }
    }

    // Reset permissions

    async reset() {

      return await this.mod.settings.delete('permissions');

    }




}