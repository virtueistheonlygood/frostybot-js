const frostybot_module = require('./mod.base');
var context = require('express-http-context');
var axios = require('axios');

module.exports = class frostybot_gui_module extends frostybot_module {

    // Constructor

    constructor() {
        super()
        this.description = 'Web GUI Module'
    }

    // Register methods with the API (called by init_all() in core.loader.js)

    register_api_endpoints() {

        // Permission templates for reuse
        var templates = {
            'localonly':  { 'standard': ['local', 'any' ], 'provider': ['local' ]  },
            'tokenonly':  { 'standard': ['token'],  'provider': ['token']   },
            'tokenorany': { 'standard': ['any','token'],  'provider': ['any','token'] },
            'any':        { 'standard': ['any'], 'provider': ['any'] }
        }

        // Method permissions 

        var permissions = {
            'gui:enable':   templates.localonly,
            'gui:disable':   templates.localonly,
            'gui:main':   templates.any,
            'gui:register':   templates.any,
            'gui:login':   templates.any,
            'gui:verify_recaptcha':   templates.localonly,
            'gui:content':   templates.tokenorany,
            'gui:data':   templates.tokenonly,
            'gui:chart':   templates.any,
        }

        // API method to endpoint mappings (Webhooks only, no REST endpoints)
        var api = {
            'gui:enable':   [],         // Enable GUI (Webhook only, no REST)
            'gui:disable':  [],         // Disable GUI (Webhook only, no REST)
            'gui:main':     [],         // Main GUI Container (Webhook only, no REST)
            'gui:register': [],         // Registration Page (Webhook only, no REST)
            'gui:login':    [],         // Login Page 
            'gui:verify_recaptcha': [], // Verify Google Recaptcha3
            'gui:content':  [],         // Get GUI Content
            'gui:data':     [],         // Get GUI Data
            'gui:chart':    ['get|/chart/:symbol'], // Get TradingView Chart embed for Symbol
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions[method]); // Defined in mod.base.js
        }
        
    }    

    // Enable GUI

    async enable(params) {
        //var ip = context.get('srcIp');
        //if (['127.0.0.1','::1'].includes(ip)) {
            var schema = {
                email: {
                    required: 'string',
                },
                password: {
                    required: 'string'
                },
                recaptchasite: {
                    optional: 'string'
                },
                recaptchasecret: {
                    optional: 'string'
                }
            }
    
            if (!(params = this.mod.utils.validator(params, schema))) return false; 
    
            var [email, password, recaptchasite, recaptchasecret] = this.mod.utils.extract_props(params, ['email', 'password', 'recaptchasite', 'recaptchasecret']);

            await this.mod.settings.set('core','gui:recaptchasite', (recaptchasite != undefined ? recaptchasite : false));
            await this.mod.settings.set('core','gui:recaptchasecret', (recaptchasecret != undefined ? recaptchasecret : false));

            if (await this.mod.user.core(email, password)) {
                if (await this.mod.settings.set('core','gui:enabled', true)) {
                    return this.mod.output.success('gui_enable');
                }
            }
            return this.mod.output.error('gui_enable');
        //}
        //return this.mod.output.error('local_only');
    }

    // Disable GUI

    async disable(params = null) {
        var ip = context.get('srcIp');
        if (['127.0.0.1','::1'].includes(ip)) {
            if (await this.mod.settings.set('core','gui:enabled', false)) {
                return this.mod.output.success('gui_disable');
            }
            return this.mod.output.error('gui_disable');
        }
        return this.mod.output.error('local_only');
    }

    // Check if GUI is enabled

    async gui_is_enabled() {
        var enabled = await this.mod.settings.get('core', 'gui:enabled', false);
        if (String(enabled) == "true")
            return true;
        else
            return false;
    }

    // Check if multi-user is enabled

    async multiuser_is_enabled() {
        var enabled = await this.mod.settings.get('core', 'multiuser:enabled', false);
        if (String(enabled) == "true")
            return true;
        else
            return false;
    }

    // Extract request and response parameters

    extract_request(params) {
        if (params.hasOwnProperty('_raw_'))
            var raw = params['_raw_'];
        else
            var raw = { res: null, req: null};
        return [raw.res, raw.req];
    }

    // Load Main GUI Page

    async main(params) {
        var [res, req] = this.extract_request(params);
        if (!(await this.gui_is_enabled()))
            return this.render_error(res, 'GUI is not enabled.');
        var is_provider_admin = false;
        if (params.uuid != undefined) {
            is_provider_admin = this.mod.signals.is_provider_admin(uuid);
        }
        return this.render_page(res, "pages/main", { pageTitle: '', providerAdmin: is_provider_admin });
        //} else {
        //    return this.render_page(res, "pages/main", { pageTitle: 'Configuration', uuid: uuid });
        //} 
    }

    // Load Login Page

    async login(params) {
        var [res, req] = this.extract_request(params);
        if (!(await this.gui_is_enabled()))
            return this.render_error(res, 'GUI is not enabled.');
        var regsuccess = params.hasOwnProperty('regsuccess') ? params.regsuccess : false;
        var sessiontimeout = params.hasOwnProperty('sessiontimeout') ? params.sessiontimeout : false;
        /*
        var auth = await this.get_auth_config();
        if (auth !== false) {
            const oauth2Client = new OAuth2(auth.clientid, auth.secret, auth.url + '/ui/auth_callback');    
            const loginLink = oauth2Client.generateAuthUrl({
                access_type: 'offline', 
                scope: [
                    'https://www.googleapis.com/auth/plus.me', 
                    'https://www.googleapis.com/auth/userinfo.email',              
                ]
            });
            return this.render_page(res, "pages/login", { pageTitle: 'Login', loginLink: loginLink });
        }
        return res.send(auth);        
        */
        var multiuser = await this.mod.settings.get('core','multiuser:enabled');
        var recaptchasite = await this.mod.settings.get('core','gui:recaptchasite',false);
        return this.render_page(res, "pages/login", { pageTitle: 'Login', regsuccess: regsuccess, sessiontimeout: sessiontimeout, showregister: (multiuser ? true: false), recaptchasite: recaptchasite });
    }

    // Register User

    async register(params) {
        var [res, req] = this.extract_request(params);
        if (!(await this.multiuser_is_enabled()))
            return this.render_error(res, 'Cannot register more users. Multi-user mode is not enabled.');
        if (!(await this.gui_is_enabled()))
            return this.render_error(res, 'GUI is not enabled.');
        var recaptchasite = await this.mod.settings.get('core','gui:recaptchasite',false);
        return this.render_page(res, "pages/register", { pageTitle: 'Register', recaptchasite: recaptchasite });
    }

    // Get Data

    async data(params) {
        var [res, req] = this.extract_request(params);
        var params = {...req.params, ...req.query};
        var token = params.hasOwnProperty('token') ? params.token : false;
        var uuid = token != false ? token.uuid : false;
        if (uuid == false) {
            return res.send(false);
        } else {
            context.set('uuid', uuid);
            if (params.hasOwnProperty('key')) {
                var key = params.key;
                var result = false;
                var contentfunc = 'data_' + key.toLowerCase()
                if (typeof( this[contentfunc] ) == 'function') {
                    var result = await this[contentfunc](params);
                }
                return res.send(result);   
            } else {
                return res.send(false);
            }
        }
    }

    // Get Content

    async content(params) {
        var [res, req] = this.extract_request(params);
        if (!(await this.gui_is_enabled()))
            return this.render_error(res, 'GUI is not enabled.');
        var params = {...req.params, ...req.query};
        var token = params.hasOwnProperty('token') ? params.token : false;
        var uuid = token != false ? token.uuid : false;
        if (uuid == false) {
            return res.send({'error' : 'invalid_uuid'});
        } else {
            context.set('uuid', uuid);
            if (params.hasOwnProperty('key')) {
                var key = params.key;
                var data = { uuid : uuid };
                var contentfunc = 'content_' + key.toLowerCase();
                if (typeof( this[contentfunc] ) == 'function') {
                    data[key] = await this[contentfunc](params);
                }
                var template = key.split('_').join('.');
                return this.render_page(res, "partials/" + template + ".ejs", data);   
            } else {
                return res.send({'error' : 'invalid_key'});
            }
        }
    }

    // Get chart from TradingView

    async chart(params) {
        var [res, req] = this.extract_request(params);
        var symbol = params.symbol;
        return this.render_page(res, "pages/chart", { symbol: symbol });

    }

    // Brancing

    async content_logo(params) {
        var logo = await this.mod.settings.get('core', 'gui:logo', 'frostybot.png');
        return logo;
    }

    // Main Menu

    async content_menu_main(params) {
        var config = {
            isSignalAdmin: false
        };
        var uuid = params.hasOwnProperty('token') ? (params.token.hasOwnProperty('uuid') ? params.token.uuid : false) : false;
        if (uuid != null) {
            //if (await this.mod.signals.is_signal_admin(uuid)) {
            //    config['isSignalAdmin'] = true;
            //}
        }
        return config;
    }

    // 2FA Form

    async content_form_2fa(params) {
        if (params.hasOwnProperty('enable') && String(params.enable) == 'true') {
            var secret = await this.mod.user.create_2fa_secret();
            var config = {
                enabled: false,
                enable: true,
                secret: secret.secret.base32,
                qrcode: secret.qrcode
            }
        } else {
            var uuid = params.hasOwnProperty('token') ? (params.token.hasOwnProperty('uuid') ? params.token.uuid : false) : false;
            if (uuid != null) {
                var user2fa = await this.mod.user.get_2fa(uuid);
                var config = {
                    enabled: (user2fa == false ? false : true),
                    enable: false,
                };
            } else {
                var config = {};
            }
        }
        return config; 
    }

    // Accounts Table

    async content_table_accounts(params) {
        return await this.mod.accounts.get();
    }

    // Accounts Form

    async content_form_accounts(params) {
        var config = {}
        if (params.hasOwnProperty('stub')) {
            var stub = params.stub;
            var accounts = await this.mod.accounts.get(stub);
            if (accounts.hasOwnProperty(stub)) {
                var account = accounts[stub];
                var params = account.parameters;
                delete account.parameters;
                account.exchange = await this.mod.accounts.get_shortname_from_stub(stub);
                var config = {...account, ...params};
            }
        }
        return config;
    }

    // Account Config Form

    async content_form_config(params) {
        var config = {}
        if (params.hasOwnProperty('stub')) {
            var stub = params.stub;
            var exchange = await this.mod.exchange.get_exchange_from_stub(stub);
            var markets = global.frostybot.markets[exchange];
            var symbols = markets != undefined ? Object.keys(markets).sort() : [];
            var allconfig = await this.mod.config.getall();
            if ([null, undefined].includes(allconfig)) allconfig = {};
            const stubconfig = Object.keys(allconfig)
                                .filter(filterkey => filterkey.indexOf(stub) !== -1)
                                .reduce((obj, filterkey) => {
                                    obj[filterkey] = allconfig[filterkey];
                                    return obj;
                                }, {});
            var griddata = [];
            symbols.forEach(symbol => {
                var lowersymbol = symbol.toLowerCase();
                var gridrow = [
                        symbol,
                        stubconfig.hasOwnProperty(stub + ':' + lowersymbol + ':ignored') ? Boolean(stubconfig[stub + ':' + lowersymbol + ':ignored']) : false,
                        stubconfig.hasOwnProperty(stub + ':' + lowersymbol + ':defsize') ? stubconfig[stub + ':' + lowersymbol + ':defsize'] : '',
                        stubconfig.hasOwnProperty(stub + ':' + lowersymbol + ':dcascale') ? stubconfig[stub + ':' + lowersymbol + ':dcascale'] : '',
                        stubconfig.hasOwnProperty(stub + ':' + lowersymbol + ':defstoptrigger') ? stubconfig[stub + ':' + lowersymbol + ':defstoptrigger'] : '',
                        stubconfig.hasOwnProperty(stub + ':' + lowersymbol + ':defprofittrigger') ? stubconfig[stub + ':' + lowersymbol + ':defprofittrigger'] : '',
                        stubconfig.hasOwnProperty(stub + ':' + lowersymbol + ':defprofitsize') ? stubconfig[stub + ':' + lowersymbol + ':defprofitsize'] : '',
                ];
                griddata.push(gridrow);
            });
            var gridstring = JSON.stringify(griddata);
            let buff = new Buffer.from(gridstring);
            let base64grid = buff.toString('base64');
            let providers = await this.mod.signals.get_providers_by_stub(stub); 
            let filtered = [];
            var account = await this.mod.accounts.get(stub);
            account = account.hasOwnProperty(stub) ? account[stub] : account;
            if (account) {
                var exchange = account.exchange + (account.hasOwnProperty('type') ? '_' + account.type : '');
            }
            var uuid = context.get('uuid')
            for (var i = 0; i < providers.length; i++) {
                var provider = providers[i]
                var is_admin = await this.mod.signals.is_admin(provider.uuid, uuid)
                var in_use = await this.mod.signals.is_provider_selected(provider.uuid, exchange, stub)
                if ((in_use == false) || (is_admin == true)) {
                    filtered.push(provider)
                }
            }
            config = {
                stub: stub,
                symbols: symbols,
                providers: filtered,
                config: stubconfig,
                griddata: base64grid,
            }
        }
        return config;
    }

    // Balances Tab

    async content_tab_balances(params) {
        var config = this.mod.accounts.get();
        return config;
    }

    // Positions Tab

    async content_tab_positions(params) {
        var accounts = await this.mod.accounts.get();
        var showspot = await this.mod.config.get('gui:showspotpositions', false);
        var showchart = await this.mod.config.get('gui:showchart', false);
        
        return {
            accounts: accounts,
            showspot: showspot,
            showchart: showchart
        }
    }

    // PNL Tab

    async content_tab_pnl(params) {
        var accounts = await this.mod.accounts.get();
        return {
            accounts: accounts,
        }
    }

    // Reports Tab

    async content_tab_reports(params) {
        var accounts = await this.mod.accounts.get();
        return {
            accounts: accounts
        }
    }

    // Force Refresh of Balance Data

    async data_refresh_balances(params) {
        return await this.data_griddata_balances(params);
    }


    // Balance Grid Data

    async data_griddata_balances(params) {
        var stub = params.stub;
        await this.mod.exchange.refresh_balances_datasource({ user : params.token.uuid, stub : params.stub });
        var balances = await this.mod.exchange.balances(stub);
        var balances = (balances !== false ? balances : []).sort((a, b) => (a.currency > b.currency) ? 1 : -1);
        for (var i =0; i < balances.length; i++) {
            var balance = balances[i];
            balance['base_free'] = balance.base.free;
            balance['base_used'] = balance.base.used;
            balance['base_total'] = balance.base.total;
            balance['usd_free'] = balance.usd.free;
            balance['usd_used'] = balance.usd.used;
            balance['usd_total'] = balance.usd.total;
            delete balance.base
            delete balance.usd
            balances[i] = balance;
        }
        return balances;
    }

    // Position Grid Data

    async data_griddata_positions(params) {
        var stub = params.stub;
        var showspot = params.hasOwnProperty('showspot') ? params.showspot : 'false';
        await this.mod.exchange.refresh_positions_datasource({ user : params.token.uuid, stub : params.stub });
        this.mod.config.set({'gui:showspotpositions': showspot});
        var positions = await this.mod.exchange.positions(stub);
        var positions = (positions !== false ? positions : []).sort((a, b) => (a.symbol > b.symbol) ? 1 : -1);
        if (String(showspot) == 'false') {
            positions = positions.filter(position => position.type.toLowerCase() != "spot");
        }
        for (var i =0; i < positions.length; i++) {
            var position = positions[i];
            var symbol = position.symbol;
            var exchange = position.exchange; 
            var market = await this.mod.exchange.market(exchange, symbol);
            positions[i]['tvsymbol'] = (market !== false ? market.tvsymbol : null) 
            position.actions = '<a href="#" class="closepositionlink" data-stub="' + stub + '" data-symbol="' + position.symbol + '" data-toggle="tooltip" title="Close"><span style="color: red;" class="fa fa-close fa-lg fa-danger"></span></a>'
        }
        return positions;
    }

    // Orders Tab

    async content_tab_orders(params) {
        var accounts = await this.mod.accounts.get();
        var stubs = Object.keys(accounts).sort((a, b) => (a > b) ? 1 : -1);
        var stub = stubs[0];
        var symbols = await this.data_symbols(stub);
        var config = {
            stubs: stubs,
            symbols: symbols
        }
        return config;
    }

    // Get symbols by account stub

    async data_symbols(params) {
        params = (typeof(params) == 'string' ? {stub: params} : params);
        var stub = params.stub;
        var classes = require('./core.classes');
        var exchange = new classes.exchange(stub);
        var symbols = await exchange.execute(stub, 'symbols', stub);
        return symbols;
    }

    // Orders Grid Data

    async data_griddata_orders(params) {
        var filter = {
            stub: params.stub,
            symbol: params.symbol
        }
        if (params.status !== undefined) filter['status'] = params.status;
        var stub = params.stub;
        var classes = require('./core.classes');
        var exchange = new classes.exchange(stub);
        var orders = await exchange.execute(stub, 'orders', filter);
        //var orders = (orders !== false ? orders : []).sort((a, b) => (a.timestamp > b.timestamp) ? 1 : -1);
        for (var i =0; i < orders.length; i++) {
            var order = orders[i];
            order.actions = '';  //'<a href="#" class="closepositionlink" data-stub="' + stub + '" data-symbol="' + position.symbol + '" data-toggle="tooltip" title="Close"><span style="color: red;" class="fa fa-close fa-lg fa-danger"></span></a>'
        }
        return orders;
    }


    // PNL Per Day Report

    async content_report_dailypnl(params) {
        var stub = params.hasOwnProperty('stub') ? params.stub : undefined;
        var days = params.hasOwnProperty('days') ? params.days : undefined;
        return { stub: stub, days: days };
    }

    // PNL Per Day Chart Data

    async data_chartdata_dailypnl(params) {
        var uuid = params.hasOwnProperty('token') ? (params.token.hasOwnProperty('uuid') ? params.token.uuid : false) : false;
        var stub = params.hasOwnProperty('stub') ? params.stub : undefined;
        var days = params.hasOwnProperty('days') ? params.days : undefined;
        var pnl = await this.mod.pnl.pnl_per_day(uuid, stub, days)
        return pnl;
    }

    // PNL By Pair (Total) Report

    async content_report_pnlbypair_total(params) {
        var stub = params.hasOwnProperty('stub') ? params.stub : undefined;
        var days = params.hasOwnProperty('days') ? params.days : undefined;
        return { stub: stub, days: days };
    }

    // PNL By Pair (Total) Chart Data

    async data_chartdata_pnlbypair_total(params) {
        var uuid = params.hasOwnProperty('token') ? (params.token.hasOwnProperty('uuid') ? params.token.uuid : false) : false;
        var stub = params.hasOwnProperty('stub') ? params.stub : undefined;
        var days = params.hasOwnProperty('days') ? params.days : undefined;
        var pnl = await this.mod.pnl.pnl_by_pair_total(uuid, stub, days)
        return pnl;
    }

    // PNL By Pair (Over Time) Report

    async content_report_pnlbypair_overtime(params) {
        var stub = params.hasOwnProperty('stub') ? params.stub : undefined;
        var days = params.hasOwnProperty('days') ? params.days : undefined;
        return { stub: stub, days: days };
    }

    // PNL By Pair (Over Time) Chart Data

    async data_chartdata_pnlbypair_overtime(params) {
        var uuid = params.hasOwnProperty('token') ? (params.token.hasOwnProperty('uuid') ? params.token.uuid : false) : false;
        var stub = params.hasOwnProperty('stub') ? params.stub : undefined;
        var days = params.hasOwnProperty('days') ? params.days : undefined;
        var pnl = await this.mod.pnl.pnl_by_pair_overtime(uuid, stub, days)
        return pnl;
    }

    // Signal Admin Tab

    async content_tab_provider(params) {
        var uuid = params.hasOwnProperty('token') ? (params.token.hasOwnProperty('uuid') ? params.token.uuid : false) : false;
        var providers = false;
        if (uuid !== false) {
            var signaladmins = await this.mod.signals.get_signal_admins();
            providers = signaladmins.hasOwnProperty(uuid) ? signaladmins[uuid] : false;
        }
        return {uuid : uuid, providers: providers};
    }

    // Log Viewer

    async content_tab_logs(params) {
        var uuid = params.hasOwnProperty('token') ? (params.token.hasOwnProperty('uuid') ? params.token.uuid : false) : false;
        var logfilters = await this.mod.config.get('gui:logfilters', 'debug,notice,warning,error,success');
        var config = {
            logfilters: logfilters
        }
        if (uuid !== false) config['uuid'] = uuid;
        return config;
    }

    // Log Data

    async data_logdata(params) {
        var log = [];
        if (params.hasOwnProperty('filters')) {
            this.mod.config.set({'gui:logfilters': String(params.filters)});
        }
        var result = await this.mod.user.log(params);
        if ((result !== false) && (result.length > 0)) {
            for (var i = 0; i < result.length; i++) {
                var entry = result[i];
                log.push([entry.timestamp, entry.type.toUpperCase().padEnd(7, ' '), entry.message.replace('??','>>')].join(' │ '));
            }
        }
        return log;
    }

    // Logout

    async content_tab_logout(params) {
        var uuid = params.hasOwnProperty('token') ? (params.token.hasOwnProperty('uuid') ? params.token.uuid : false) : false;
        if (uuid !== false) {
            var result = await this.mod.user.logout({uuid: uuid});
            if (result) {
                return {logout: true};
            }
        }
        return {logout: false};
    }

    // Verify Recaptcha Response

    async verify_recaptcha(params) {
        var response = params.response;
        var recaptchasecret = await this.mod.settings.get('core','gui:recaptchasecret',false);
        if (recaptchasecret != false) {
            var result = await axios.post('https://www.google.com/recaptcha/api/siteverify?secret='+recaptchasecret+'&response='+response,{},{headers: {"Content-Type": "application/x-www-form-urlencoded; charset=utf-8"},});
            var data = result.data;
            if (data.success == true) 
                if (data.score >= 0.5) 
                    return this.mod.output.success('gui_recaptcha', [data.score]);
                else
                    return this.mod.output.error('gui_recaptcha', [data.score]);            
        }
        return this.mod.output.error('gui_recaptcha', [false]);
    }

    // Render Page

    render_page(res, template, vars) {
        if (!vars.hasOwnProperty('uuid'))
            vars['uuid'] = '';
        return res.render(template, vars);
    }


    // Render Error

    render_error(res, message) {
        return res.render("pages/error", { pageTitle: 'Error', errorMsg: message });
    }


}