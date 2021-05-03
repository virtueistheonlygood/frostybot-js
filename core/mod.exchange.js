// Exchange handler module

const frostybot_module = require('./mod.base');
const fs = require('fs');
var context = require('express-http-context');


module.exports = class frostybot_exchange_module extends frostybot_module {

    // Constructor

    constructor() {
        super()
        this.description = 'Exchange Communication Handler'
        this.normalizers = {}
    }

    // Initialize Module

    async initialize() {

        await this.load_normalizers();
        await this.refresh_markets()
        await this.register_positions_datasource()
        await this.register_balances_datasource()
        
    }

    // Register methods with the API (called by init_all() in core.loader.js)

    register_api_endpoints() {

        // Permissions are the same for all methods, so define them once and reuse
        var permissions = {
            'exchange:info': {
                'standard': ['any' ],
                'provider': ['any' ],
            },
            'exchange:markets': {
                'standard': ['any' ],
                'provider': ['any' ],
            }
        }

        // API method to endpoint mappings
        var api = {
            'exchange:info'     :  'get|/exchange/:exchange/info',             // Get information about exchange
            'exchange:markets'  :  'get|/exchange/:exchange/markets',          // Get all markets for an exchange 
            'exchange:markets'  :  'get|/exchange/:exchange/markets/:symbol',  // Get market data for specific symbol 
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions[method]); // Defined in mod.base.js
        }
        
    }


    // Register datasources with the Datasource Controller (called by init_all() in core.loader.js)

    register_datasources() {

        var markets = {

            schedule:    '* * * * *',    // Datasource refresh cron schedule
            

        }

    }

    // Convert symbol param into the format required by the exchange

    async convert_symbol(stub, params = {}) {
        if (params.symbol != undefined) {
            var exchange= await this.get_exchange_from_stub(stub);
            var market = await this.findmarket(exchange, params.symbol);
            var field = await this.setting(exchange, 'exchange_symbol')
            if (field == undefined) field = 'symbol';
            if (market[field] != undefined) {
                if (params.symbol != market[field]) {
                    //this.mod.output.debug('custom_message', 'Converted symbol ' + params.symbol + ' to ' + market[field])
                    params['symbol'] = market[field]
                }
            }
        }
        return params;
    }

    // Execute method on the exchange normalizer

    async execute(userstub, method, params) {
        if (Array.isArray(userstub)) {
            var [uuid, stub] = userstub;
        } else {
            var uuid = context.get('uuid')
            var stub = userstub
        }
        var params = await this.convert_symbol(stub, params);
        var stubs = await this.mod.accounts.stubs_by_uuid(uuid, stub);
        if (stubs.length == 1) {
            var encrypted = stubs[0];
            var decrypted = await this.mod.utils.decrypt_values( encrypted, ['apikey', 'secret']);
            decrypted.uuid = uuid;
            var file = await this.get_normalizer_module_by_stub(decrypted);
            const fs = require('fs');
            if (fs.existsSync(file)) {
                var exclass = require(file);
                var mod = new exclass(decrypted);
                if (typeof(mod['initialize']) === 'function') { 
                    await mod.initialize();
                }
                try {
                    if (typeof(mod[method]) === 'function')
                        var result = await mod[method](params);
                    else 
                        var result = false;
                } catch(e) {
                    this.mod.output.exception(e);
                    return false;
                }
                return result;
            }
        }
        return false;
    }

    // Get Normalizer Module List

    async get_normalizer_modules() {
        const dir = __dirname.substr(0, __dirname.lastIndexOf( '/' ) ) + '/exchanges';
        var files = fs.readdirSync( dir )
        var modules = {};
        for (var i = 0; i < files.length; i++) {
            var file = files[i]
            if ((file.indexOf('exchange.') == 0) && (file.indexOf('.base.js') == -1)) {
                var exchange = file.replace('exchange.','').replace('.base','').replace('.js','').replace('.','_');
                var filename = [dir, file].join('/');
                if (fs.existsSync(filename)) {
                    modules[exchange] = filename;
                }
            }
        };
        return modules;
    }

    // Get exchange from stub

    async get_exchange_from_stub(params) {
        if (Array.isArray(params)) {
            var [uuid, stub] = params
        } else {
            var uuid = context.get('uuid')
            var stub = params
        }
        var stubs = await this.mod.accounts.stubs_by_uuid(uuid, stub)
        var filter = (this.mod.utils.is_array(stubs)) ? stubs.filter(item => item.stub == stub) : []
        var exchange = filter.length == 1 ? filter[0].exchange + (filter[0].type != undefined ? '_' + filter[0].type : '') : false;
        return exchange;
    }

    // Get specific config setting for exchange normalizer

    async setting(exchange, setting) {
        if (global.frostybot.exchanges[exchange] != undefined)
            return global.frostybot.exchanges[exchange][setting]
        else
            return undefined;
    }

    // Get positions

    async positions(stub, symbol = null) {
        var query = {
            user: context.get('uuid'),
            stub: stub
        }
        if (symbol != null) query['symbol'] = symbol
        return await this.mod.datasources.select('exchange:positions', query);
    }

    // Get balances

    async balances(stub, currency = null) {
        var query = {
            user: context.get('uuid'),
            stub: stub
        }
        if (currency != null) query['currency'] = currency
        return await this.mod.datasources.select('exchange:balances', query);
    }

    // Get orders

    async orders(stub, symbol) {
        var decrypted = await this.mod.accounts.getaccount(stub)
        var file = await this.get_normalizer_module_by_stub(decrypted);
        const fs = require('fs');
        if (fs.existsSync(file)) {
            var exclass = require(file);
            var mod = new exclass(decrypted);
            if (typeof(mod['initialize']) === 'function') { 
                await mod.initialize();
            }
            var params = await this.convert_symbol(stub, {symbol: symbol})
            try {
                var result = await mod.order_history(params);
            } catch(e) {
                this.mod.output.exception(e);
            }
        }
        return result;                
    }

    // Load normalizer modules

    async load_normalizers() {
        var modules = await this.get_normalizer_modules();
        var exchanges = Object.keys(modules);
        if (global.frostybot == undefined) global.frostybot = {};
        if (global.frostybot.exchanges == undefined) global.frostybot.exchanges = {};
        for (var i = 0; i < exchanges.length; i++) {
            var exchange = exchanges[i];
            var file = modules[exchange];
            var exclass = require(file);
            this.normalizers[exchange] = new exclass();
            global.frostybot.exchanges[exchange] = {};
            var settings = [
                'type', 
                'shortname', 
                'description', 
                'ccxtmodule', 
                'has_subaccounts', 
                'has_testnet', 
                'stablecoins', 
                'order_sizing', 
                'collateral_assets', 
                'balances_market_map', 
                'doublecheck', 
                'param_map', 
                'exchange_symbol', 
                'orders_symbol_required'
            ];
            for (var k = 0; k < settings.length; k++) {
                var setting = settings[k];
                global.frostybot.exchanges[exchange][setting] = this.normalizers[exchange][setting];
            }
        }
    }

    // Get list of valid exchanges

    exchange_list() {
        return Object.keys(this.normalizers);
    }

    // Get info about exchange

    async info(params) {
        var schema = {
            exchange:    { required: 'string', format: 'lowercase', oneof: this.exchange_list() }
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var exchange = params.exchange;
        return (global.frostybot.exchanges.hasOwnProperty(exchange)) ? global.frostybot.exchanges[exchange] : false;
        
    }

    // Get market by ID, symbol or tvsymbol

    async findmarket(exchange, search) {
        if (global.frostybot.markets[exchange] == undefined)
            await this.refresh_markets(exchange);

        var markets = global.frostybot.markets[exchange];
        var mapping = global.frostybot.mapping[exchange];
        if (markets != undefined)
            return markets[mapping[search]] != undefined ? markets[mapping[search]] : false;
        else    
            return false;
    }

    // Find ticker for an ID or symbol

    async findticker(exchange, search) {
        var market = await this.findmarket(exchange, search);
        if (market != false) {
            var id = market.id;
            var symbol = market.symbol;
            var ticker_by_id = global.frostybot.tickers[exchange][id];
            var ticker_by_symbol = global.frostybot.tickers[exchange][symbol];
            var ticker = ticker_by_id != undefined ? ticker_by_id : (ticker_by_symbol != undefined ? ticker_by_symbol : undefined);
            return ticker != undefined ? ticker : false;
        }
        return false;
    }

    // Get specific market

    async market(params, sym = undefined) {

        if (typeof(params) == 'string') {
            // Internal call
            var exchange = params;
            var symbol = sym;
            return await this.markets(exchange, symbol);
        } else {
            // External call
            var schema = {
                exchange:    { required: 'string', format: 'lowercase', oneof: this.exchange_list() },
                symbol:      { required: 'string', format: 'uppercase', },
            }
            if (!(params = this.mod.utils.validator(params, schema))) return false; 
            return await this.markets(params);
        }
    }

    // Get list of market symbols for an exchange

    async symbols(exchange) {
        var markets = await this.markets(exchange)
        var symbols = [];
        Object.values(markets).forEach(market => {
            symbols.push(market.symbol)
        })
        return symbols;
    }

    // Get market data

    async markets(params, sym = undefined) {

        if (typeof(params) == 'string') {
            // Internal call
            var exchange = params;
            var symbol = sym;
        } else {
            // External call
            var schema = {
                exchange:    { required: 'string', format: 'lowercase', oneof: this.exchange_list() },
                symbol:      { optional: 'string', format: 'uppercase', },
            }
            if (!(params = this.mod.utils.validator(params, schema))) return false; 
            var exchange = params.exchange;
            var symbol = params.symbol;
        }

        if (global.frostybot.markets[exchange] == undefined)
            await this.refresh_markets(exchange);
        
        if (symbol != undefined) {
            var market =  await this.findmarket(exchange, symbol);
//            if (market !== false) return await this.update_pricing(exchange, symbol);
            if (market !== false) {
                market.update();
                return market;
            }
        } else {
            var results = {};
            for (const [symbol, market] of Object.entries(global.frostybot.markets[exchange])) {
//                results[symbol] = await this.update_pricing(exchange, symbol);
                market.update();
                results[symbol] = market;
            }
            return results;
        }
        return false;
    }

    // Update pricing for market

    async update_pricing(exchange, symbol) {
        var market = await this.findmarket(exchange, symbol);
        var ticker = await this.findticker(exchange, symbol);
        if ((market !== false) && (ticker !== false)) {
            market.bid = ticker.bid;
            market.ask = ticker.ask;
            market.avg = (ticker.bid + ticker.ask) / 2
        }
        return await this.update_usd_price(exchange, symbol);
    } 

    // Update USD price for market symbol

    async update_usd_price(exchange, symbol) {

        var market = await this.findmarket(exchange, symbol);
        var base = market.base;
        var quote = market.quote;
        var usdbasepair = null;
        var usdquotepair = null;
        var stablecoins = global.frostybot.exchanges[exchange].stablecoins;
        if (!stablecoins.includes(quote)) {
            market.usd = {
                base: null,
                quote: null,
                pairs: {
                    base: null,
                    quote: null,
                }
            };
            stablecoins.forEach(async(stablecoin) => {
                var pair = base + '/' + stablecoin;
                var searchbase = await this.findmarket(exchange, pair);
                if (searchbase !== false && !usdbasepair) {
                    market.usd.base = searchbase.avg;
                    market.usd.pairs.base = pair;
                }
                var pair = quote + '/' + stablecoin;
                var searchquote = await this.findmarket(exchange, pair);                
                if (searchquote && !usdquotepair) {
                    market.usd.quote = searchquote.avg;
                    market.usd.pairs.quote = pair;
                }
            });
            if ((market.usd.quote != null) && (market.usd.base == null)) {
                market.usd.base = market.usd.quote * market.avg;
            }    
        } else {
            if (isNaN(market.avg) || market.avg == null) market.avg = (market.bid + market.ask) / 2;
            market.usd = market.avg;
        }

        global.frostybot.markets[exchange][symbol] = market;
        return market;

    }

    // Get Normalizer Module from stub

    async get_normalizer_module_by_stub(stub) {
        return this.mod.utils.base_dir() + '/exchanges/exchange.' + stub.exchange + (stub.type != undefined ? '.' + stub.type : '') + '.js';
    }

    // Refresh market data from the exchange

    async refresh_markets(exchange) {
        if (global.frostybot == undefined) global.frostybot = {};
        if (global.frostybot.markets == undefined) global.frostybot.markets = {};
        if (global.frostybot.mapping == undefined) global.frostybot.mapping = {};
        if (global.frostybot.exchanges == undefined) global.frostybot.exchanges = {};
        for (const [exchange, normalizer] of Object.entries(this.normalizers)) {
            if (global.frostybot.markets[exchange] == undefined) global.frostybot.markets[exchange] = {};
            if (global.frostybot.mapping[exchange] == undefined) global.frostybot.mapping[exchange] = {};
            try {
                var result = await normalizer.execute('markets', {}, true);
            } catch(e) {
                this.mod.output.exception(e);
                return false;
            }
            if (this.mod.utils.is_array(result) && result.length > 0) {
                for (var j = 0; j < result.length; j++) {
                    var market = result[j];
                    var id = market.id;
                    var symbol = market.symbol;
                    var tvsymbol = market.tvsymbol;
                    global.frostybot.markets[exchange][symbol] = market;    
                    global.frostybot.mapping[exchange][id] = symbol;
                    global.frostybot.mapping[exchange][symbol] = symbol;
                    global.frostybot.mapping[exchange][tvsymbol] = symbol;                        
                }
                this.mod.output.notice('exchange_refresh_markets', [exchange, result.length])
            } else {
                this.mod.output.error('exchange_refresh_markets', [exchange])
            }
        }
    }

    // Get position data for the exchange:positions datasource

    async refresh_positions_datasource(params = {}) {
        var uuidstubs = await this.mod.accounts.uuids_and_stubs(params);
        //if (params == {}) {
        //    var isactive = this.mod.datasources.isactive('exchange:positions')
        //    if (!isactive) {
        //        this.mod.output.debug('custom_message',['This node is not active for exchange:positions'])
        //        return false;
        //    }
        //}
        var all = [];
        for (const [user, stubs] of Object.entries(uuidstubs)) {
            for(var i = 0; i < stubs.length; i++) {
                var stub = stubs[i].stub;
                var encrypted = stubs[i];
                var decrypted = await this.mod.utils.decrypt_values(encrypted, ['apikey', 'secret']);
                decrypted.uuid = user;
                var file = await this.get_normalizer_module_by_stub(decrypted);
                const fs = require('fs');
                if (fs.existsSync(file)) {
                    var exclass = require(file);
                    var mod = new exclass(decrypted);
                    if (typeof(mod['initialize']) === 'function') { 
                        await mod.initialize();
                    }
                    try {
                        var result = await mod.execute('positions', {}, true);
                    } catch(e) {
                        var result = false;
                        //this.mod.output.exception(e);
                    }
                    if (result != false) {
                        this.mod.datasources.delete('exchange:positions', {user: user, stub: stub})
                        var positions = [];
                        if (Array.isArray(result) && (result.length > 0)) {
                            for (var j = 0; j < result.length; j++) {
                                positions.push(result[j]);                       
                            }
                            await this.mod.datasources.update_data('exchange:positions', positions);
                        }
                        all = all.concat(positions)
                    }
                }
            }
        }
        return all;        
    }

    // Get position data for the exchange:positions datasource

    async refresh_balances_datasource(params = {}) {
        var uuidstubs = await this.mod.accounts.uuids_and_stubs(params);
        //if (params == {}) {
            //var isactive = await this.mod.datasources.isactive('exchange:balances')
            //this.mod.output.debug('custom_message',['This node is not active for exchange:balances'])
            //if (!isactive) {
            //    this.mod.output.debug('custom_message',['This node is not active for exchange:balances'])
            //    return false;
            //}
        //}
        var all = []
        for (const [user, stubs] of Object.entries(uuidstubs)) {
            for(var i = 0; i < stubs.length; i++) {
                var stub = stubs[i].stub;
                
                var encrypted = stubs[i];
                var decrypted = await this.mod.utils.decrypt_values(encrypted, ['apikey', 'secret']);
                decrypted.uuid = user;
                var file = await this.get_normalizer_module_by_stub(decrypted);
                const fs = require('fs');
                if (fs.existsSync(file)) {
                    var exclass = require(file);
                    var mod = new exclass(decrypted);
                    if (typeof(mod['initialize']) === 'function') { 
                        await mod.initialize();
                    }
                    try {
                        var result = await mod.execute('balances', {}, true);
                    } catch(e) {
                        var result = false;
                        //this.mod.output.exception(e);
                    }
                    if (result != false) {
                        this.mod.datasources.delete('exchange:balances', {user: user, stub: stub})
                        var balances = [];
                        if (Array.isArray(result) && (result.length > 0)) {
                            for (var j = 0; j < result.length; j++) {
                                balances.push(result[j]);                       
                            }
                            await this.mod.datasources.update_data('exchange:balances', balances);
                            
                        }
                        all = all.concat(balances)
                    }
                }
            }
        }
        return all;
    }

    // Poll All Users and Cache Position Data

    async register_positions_datasource() {
        var interval = 180;
        var indexes = {
            unqkey  : ['user', 'stub', 'symbol'],
            idxkey1 : 'user',
            idxkey2 : 'stub',
            idxkey3 : 'symbol',
        }
        this.mod.datasources.register('exchange:positions', indexes, async() => {
            return await this.mod.exchange.refresh_positions_datasource();
        }, 180);
        this.mod.datasources.start('exchange:positions', interval);
    }

    // Poll All Users and Cache Balance Data

    async register_balances_datasource() {
        var interval = 180;
        var indexes = {
            unqkey  : ['user', 'stub', 'currency'],
            idxkey1 : 'user',
            idxkey2 : 'stub',
            idxkey3 : 'currency',
        }
        this.mod.datasources.register('exchange:balances', indexes, async() => {
            return await this.mod.exchange.refresh_balances_datasource();
        }, 180);
        this.mod.datasources.start('exchange:balances', interval);
    }


}
