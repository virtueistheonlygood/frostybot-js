// Accounts Handling Module

const frostybot_module = require('./mod.base')
var context = require('express-http-context');

module.exports = class frostybot_accounts_module extends frostybot_module {

    // Constructor

    constructor() {
        super()
        this.description = 'Accounts Managememnt Module'
    }

    // Register methods with the API (called by init_all() in core.loader.js)

    register_api_endpoints() {

        // Permissions are the same for all methods, so define them once and reuse
        var permissions = {
            'standard': [ 'core,singleuser', 'multiuser,user', 'token', 'local' ],
            'provider': [ 'token', 'local' ]
        }

        // API method to endpoint mappings
        var api = {
            'accounts:get': [
                                'get|/accounts',                          // Get all account information
                                'get|/accounts/:stub',                    // Get account information for specific stub
            ],
            'accounts:add':    [
                                'post|/accounts',                         // Add new account
                                'put|/accounts',                          // Update account
            ],
            'accounts:delete':  'delete|/accounts/:stub',                 // Delete account for specific stub
            'accounts:test':    'post|/accounts/:stub/test',              // Test API keys with the exchange

            'accounts:get_hedge_mode' : 'get|/accounts/:stub/hedgemode',  // Get Binance Futures Hedge Mode setting
            'accounts:enable_hedge_mode'  : 'post|/accounts/:stub/hedgemode', // Enable Binance Futures Hedge Mode setting
            'accounts:disable_hedge_mode' : 'delete|/accounts/:stub/hedgemode', // Disable Binance Futures Hedge Mode setting
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions);    // Defined in mod.base.js
        }
        
    }


    // Check if a user has any configured accounts

    async has_accounts(uuid) {
        var result = await this.stubs_by_uuid(uuid);
        return result.length == 0 ? false : true;
    }

    // Get account silently (no log output, used internally)

    async getaccount(stub) {
        var account = await this.mod.settings.get('accounts', stub);
        if (account !== null) {
            return await this.mod.utils.decrypt_values( this.mod.utils.lower_props(account), ['apikey', 'secret'])
        }
        return false;
    }

    // Get stubs for a specific account uuid (no log output, used internally)

    async stubs_by_uuid(uuid, stub = undefined) {
        var query = {
                uuid: uuid,
                mainkey: 'accounts'
        }
        if (stub != undefined) query['subkey'] = stub;
        var result = await this.database.select('settings', query);
        //console.log(result)
        var stubs = [];
        if (this.mod.utils.is_array(result) && result.length > 0) {
            for (var i = 0; i < result.length; i++) {
                var data = JSON.parse(result[i].value);
                data['uuid'] = uuid;
                stubs.push(data);
            }
        }      
        return (stub !== undefined && stubs.length == 1) ? stubs[0] : stubs;
    }

    // Get all uuids and stubs

    async all_uuids_and_stubs() {
        return await this.uuids_and_stubs({});
    }

    // Get uuid and stubs

    async uuids_and_stubs(filter = {}) {
        var query = {
            mainkey: 'accounts'
        }
        if (filter['user'] != undefined) query['uuid'] = filter['user'];
        if (filter['stub'] != undefined) query['subkey'] = filter['stub'];
        var result = await this.database.select('settings', query);
        var stubs = {}
        if (this.mod.utils.is_array(result) && result.length > 0) {
            for (var i = 0; i < result.length; i++) {
                var uuid = result[i].uuid;
                var data = JSON.parse(result[i].value);
                if (stubs[uuid] == undefined) stubs[uuid] = [];
                stubs[uuid].push(data);
            }
        }      
        return stubs;            
    }


    // Get account(s)

    async get(params) {
        if (params == undefined) {
            params = []
        }
        var stub = this.mod.utils.extract_props(params, 'stub');
        if ([undefined, false].includes(stub)) {
            var results = await this.mod.settings.get('accounts');
            if (results) {
                var accounts = {};
                if (this.mod.utils.is_object(results)) {
                    if (results.hasOwnProperty('stub')) {
                        var stub = results.stub;
                        accounts[stub] = results;
                    } else {
                        accounts = results;
                    }
                }
                //if (!this.mod.utils.is_array(results))
                //results = results.hasOwnProperty('stub') ? [results] : results;

                //var accounts = {};
                //for(var i = 0; i < results.length; i++) 
                //    accounts[results[i].stub] = this.mod.utils.lower_props(results[i]);
                
                //this.mod.output.success('account_retrieve', [ Object.values(accounts).length + ' accounts' ]);
                return await this.censored(accounts);
            } else return false; //this.mod.output.error('account_retrieve', ['No accounts configured']);
        }  else {
            var account = await this.mod.settings.get('accounts', stub);
            if (account) {
                var accounts = {};
                accounts[stub] = this.mod.utils.lower_props(account)
                //this.mod.output.success('account_retrieve', stub);
                return this.censored(accounts);
            }
            return false; //this.mod.output.error('account_retrieve', stub);
        }
    }


    // Censor account output

    async censored(accounts) {
        var result = {};
        if (accounts != false) {
            for (var [stub, account] of Object.entries(accounts)) {
                if (account != false) {
                    account = await this.mod.utils.decrypt_values(account, ['apikey', 'secret'])
                    account = await this.mod.utils.censor_props(account, ['secret'])
                }
                result[stub] = account;
            }
            return result;
        }
    }


    // Check if account stub exists

    async exists(stub) {
        var account = await this.mod.settings.get('accounts', stub, false);
        if (account) {
            return true;
        }
        return false;
    }


    // Extract CCXT Test Parameters 

    create_params(params) {
        const stub = params.stub.toLowerCase();
        const description = params.hasOwnProperty('description') ? params.description : params.exchange;
        const exchange = params.exchange.toLowerCase();
        const type = params.hasOwnProperty('type') ? params.type : undefined;
        delete params.stub;
        delete params.description;
        delete params.exchange;
        delete params.type;
        if (params.hasOwnProperty('token')) delete params.token;
        var data = {
            description: description,
            exchange: exchange,
            type: type,
            parameters: params,
        }
        return [stub, data];
    }


    // Add new account

    async add(params) {

        var schema = {
            stub: {        required: 'string', format: 'lowercase' },
            exchange: {    required: 'string', format: 'lowercase', oneof: ['ftx', 'ftxus', 'deribit', 'binance', 'binanceus', 'bitmex'] },
            description: { optional: 'string'  },
            apikey: {      required: 'string'  },
            secret: {      required: 'string'  },
            testnet: {     optional: 'boolean' },
            subaccount: {  optional: 'string'  },
            type: {        optional: 'string', format: 'lowercase', oneof: ['spot', 'margin', 'futures', 'coinm'] },
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        if ((params.exchange == 'binance') && (!params.hasOwnProperty('type'))) {
            return this.mod.output.error('binance_req_type')
        }

        if (!['deribit', 'binance', 'bitmex', 'binanceus'].includes(params.exchange)) {
            params.testnet = false;     // Testnet not supported
        }

        if (!['ftx', 'ftxus'].includes(params.exchange)) {
            delete params.subaccount;   // Subaccount not supported
        }

        var testparams = {
            exchange: params.exchange + (params.hasOwnProperty('type') ? '_' + params.type : ''),
            apikey: params.apikey,
            secret: params.secret,
            testnet: params.testnet
        }
        let testresult = await this.test(testparams);
        if (testresult) {
            var [stub, data] = this.create_params(params);
            data['stub'] = stub;
            data = await this.mod.utils.remove_props(data, ['tenant','token']);
            data = await this.mod.utils.encrypt_values(data, ['apikey', 'secret']);
            if (await this.mod.settings.set('accounts', stub, data)) {
                this.mod.output.success('account_create', stub);
                this.mod.datasource.refresh('exchange:positions', {user: context.get('uuid'), stub: stub});
                this.mod.datasource.refresh('exchange:balances', {user: context.get('uuid'), stub: stub});
                return true;
            }
            this.mod.output.error('account_create', stub);
        }
        return false;
    }

    // Update account

    async update(params) {
        var [stub, data] = this.create_params(params);
        let testresult = await this.test(data);
        if (testresult) {
            data['stub'] = stub;
            this.mod.output.success('account_test', stub);
            data = await this.mod.utils.remove_props(data, ['tenant','token'])
            data = await this.mod.utils.encrypt_values(data, ['apikey', 'secret'])
            if (await this.mod.settings.set('accounts', stub, data)) {
                this.mod.output.success('account_update', stub);
            }
            this.mod.output.error('account_update', stub);
        }
        this.mod.output.error('account_test', stub);
        return false;
    }


    // Delete account

    async delete(params) {

        var schema = {
            stub: { required: 'string', format: 'lowercase' }
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 


        var stub = (params.hasOwnProperty('stub') ? params.stub : null);
        if (stub != null) {
            if (await this.mod.settings.delete('accounts', stub)) {
                this.mod.output.success('account_delete', stub);
                return true;
            }
        }
        this.mod.output.error('account_delete', stub);
        return false;
    }


    // Alias for delete

    async remove(params) {
        return await this.delete(params);
    }


    // Get account connection info

    async format_params(account) {

        if (account.hasOwnProperty('uuid')) delete account.uuid;
        if (!account.hasOwnProperty('parameters')) {
            var stubs = Object.getOwnPropertyNames(account);
            if (stubs.length == 1) {
                account = account[stubs[0]];
            }
        }

        var testnet = account.parameters.hasOwnProperty('testnet') ? String(account.parameters.testnet) == "true" : false;
        var subaccount = account.parameters.hasOwnProperty('subaccount') ? account.parameters.subaccount : null;

        var result = {
            exchange: account.hasOwnProperty('exchange') ? account.exchange : null,
            description: account.hasOwnProperty('description') ? account.description : null,
            parameters: {
                apikey:     account.parameters.hasOwnProperty('apikey') ? await  this.mod.encryption.decrypt(account.parameters.apikey) : null,
                secret:     account.parameters.hasOwnProperty('secret') ? await this.mod.encryption.decrypt(account.parameters.secret) : null,
            },   
        }
        if (result.exchange == 'binance') {
            var type = (account.hasOwnProperty('type') ? account.type.replace('futures','future').replace('coinm','delivery') : 'future');
            if (!['spot', 'margin', 'future', 'delivery'].includes(type)) {
                return this.mod.output.error('param_val_oneof', ['type', this.serialize_array(['spot', 'margin', 'futures', 'coinm'])])
            } else {
                result.parameters['options'] = {
                    defaultType : type,
                };
            }
        }
        return result;
    }


    // Test account

    async test(params) {

        if (params.stub != undefined) {
            var account = await this.getaccount(params.stub);
            var newparams = {
                exchange: account.exchange + (account.hasOwnProperty('type') ? '_' + account.type : ''),
                apikey: account.parameters.apikey,
                secret: account.parameters.secret,
                testnet: String(account.parameters.testnet) == 'true' ? true : false
            }
            params = newparams
        }

        var schema = {
            exchange:{ required: 'string', format: 'lowercase' },
            apikey:  { required: 'string' },
            secret:  { required: 'string' },
            testnet: { optional: 'boolean', default: false }
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [exchange, apikey, secret, testnet] = this.mod.utils.extract_props(params, ['exchange', 'apikey', 'secret', 'testnet']);

        var exchmodule = require('../exchanges/exchange.' + exchange.replace('_','.'))
        var exchobj = new exchmodule();
        var result = await exchobj.test(apikey, secret, testnet);
        if (result == true) {
            return this.mod.output.success('account_test');
        } else {
            return this.mod.output.error('account_test')
        }
    }


    // Get exchange ID from stub

    async get_exchange_from_stub(stub) {
        var account = await this.getaccount(stub);
        if (account !== false) {
            var params = await this.format_params(account);
            return params.exchange;
        }
        return false;
    }


    // Get exchange shortname from stub

    async get_shortname_from_stub(stub) {
        var context = require('express-http-context');
        var uuid = context.get('uuid');
        var cachekey = uuid + ':' + stub;
        var cacheresult = this.mod.cache.get(cachekey);
        if (cacheresult == undefined) {
            var account = await this.getaccount(stub);
            if (account) {
                var result = account.exchange + (account.hasOwnProperty('type') ? '_' + account.type : '');
                this.mod.cache.set(cachekey, result, 60);
                return result;
            }
            return false;
        }
        return cacheresult;
    }

    // Get Binance Futures Hedge Mode Setting

    async get_hedge_mode(params) {
        return {
            enabled: await this.mod.exchange.hedge_mode_enabled(params.stub),
            canchange: await this.mod.exchange.hedge_mode_canchange(params.stub),
        }
    }

    // Enable Binance Futures Hedge Mode

    async enable_hedge_mode(params) {
        var result = await this.mod.exchange.execute(params.stub, 'enable_hedge_mode')
        if (result == true) {
            var uuid = context.get('uuid')
            var stub = params.stub
            this.mod.cache.set(['exchange:hedge_mode_enabled', uuid, stub].join(':'), true, 10)
        }
        return result;
    }

    // Enable Binance Futures Hedge Mode

    async disable_hedge_mode(params) {
        var result = await this.mod.exchange.execute(params.stub, 'disable_hedge_mode')
        if (result == true) {
            var uuid = context.get('uuid')
            var stub = params.stub
            this.mod.cache.set(['exchange:hedge_mode_enabled', uuid, stub].join(':'), false, 10)
        }
        return result;
    }

}