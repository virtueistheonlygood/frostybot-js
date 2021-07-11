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

        // Allow some time for startup, then initialize

        await this.load_normalizers();
        //await this.refresh_markets()        
        await this.register_markets_datasource()
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
            'exchange:info'       :  'get|/exchange/:exchange/info',             // Get information about exchange
            'exchange:markets'    :  'get|/exchange/:exchange/markets',          // Get all markets for an exchange 
            'exchange:markets'    :  'get|/exchange/:exchange/markets/:symbol',  // Get market data for specific symbol 
            'exchange:positions'  :  'get|/exchange/:exchange/markets/:symbol',  // Get market data for specific symbol 
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

    // Parse user/stub config for Execute command and return decrypted stub config

    async getstubconfig(userinfo) {
        var config = null;
        switch (typeof(userinfo)) {
            // Only stub provided (use uuid from context)
            case    'string'    :   var uuid = context.get('uuid')
                                    var stub = userinfo;
                                    config = await this.mod.accounts.stubs_by_uuid(uuid, stub);
                                    break;

            // [uuid, stub] Array or Full stub config object provided
            case    'object'    :   if (this.mod.utils.is_array(userinfo)) {
                                        var [uuid, stub] = userinfo;
                                        config = await this.mod.accounts.stubs_by_uuid(uuid, stub);
                                    } else {
                                        if (userinfo.parameters != undefined) {
                                            config = userinfo;
                                        }
                                    }
                                    break;

        }
        if (await this.mod.utils.is_object(config)) {
            if (config.uuid == undefined) config['uuid'] = context.get('uuid');
        }
        return config != null ? await this.mod.utils.decrypt_values(config, ['apikey', 'secret']) : false;
    }

    // Execute method on the exchange normalizer

    async execute(userinfo, method, params) {
        var config = await this.getstubconfig(userinfo);
        if (config !== false) {
            var file = await this.get_normalizer_module_by_stub(config);
            const fs = require('fs');
            if (fs.existsSync(file)) {
                var exclass = require(file);
                var mod = new exclass(config);
                if (typeof(mod['initialize']) === 'function') { 
                    await mod.initialize();
                }
                try {
                    if (typeof(mod[method]) === 'function') {
                        var result = await mod[method](params);
                    } else {
                        var result = false;
                    }
                } catch(e) {
                    this.mod.output.exception(e);
                    return false;
                }
                return result;
            }
        }
        return false;
    }

    // Get UUIDs and Stubs based on a filter

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
                var stub = data.stub;
                if (stubs[uuid] == undefined) stubs[uuid] = {};
                var config = await this.mod.utils.decrypt_values(data, ['apikey', 'secret']);
                config['uuid'] = uuid;
                stubs[uuid][stub] = config
            }
        }      
        return stubs;            
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

    // Get hedge mode enabled

    async hedge_mode_enabled(params) {
        if (Array.isArray(params)) {
            var [uuid, stub] = params
        } else {
            var uuid = context.get('uuid')
            var stub = params
        }
        var cachekey = ['exchange:hedge_mode_enabled', uuid, stub].join(':');
        return await this.mod.cache.method(cachekey, 10, async () => {
            return await this.mod.exchange.execute([uuid, stub], 'get_hedge_mode');
        });
    }

    // Get hedge mode can be changed

    async hedge_mode_canchange(params) {
        var positions = await this.positions(params);
        return positions.length > 0 ? false : true;
    }

    // Get exchange from stub

    async get_exchange_from_stub(params) {
        if (Array.isArray(params)) {
            var [uuid, stub] = params
        } else {
            var uuid = context.get('uuid')
            var stub = params
        }
        var cachekey = ['exchange:get_exchange_from_stub', uuid, stub].join(':');
        return await this.mod.cache.method(cachekey, 10, async () => {
            var stubs = await this.mod.accounts.stubs_by_uuid(uuid, stub)
            var filter = (this.mod.utils.is_array(stubs)) ? stubs.filter(item => item.stub == stub) : [stubs]
            var exchange = filter.length == 1 ? filter[0].exchange + (filter[0].type != undefined ? '_' + filter[0].type : '') : false;
            return exchange;    
        });
    }

    // Get specific config setting for exchange normalizer

    async setting(exchange, setting) {
        if (global.frostybot.exchanges[exchange] != undefined)
            return global.frostybot.exchanges[exchange][setting]
        else
            return undefined;
    }

    // Get positions

    async positions(stub, symbol = null, direction = null) {
        if (Array.isArray(stub)) {
            var [uuid, stub] = stub
        } else {
            var uuid = context.get('uuid')
        }
        var query = {
            uuid: uuid,
            stub: stub
        }
        if (symbol != null) query['symbol'] = symbol;
        var result = await this.mod.datasource.select('exchange:positions', query);
        if (direction != null) {
            return result.filter(row => row.direction.toLowerCase() == direction.toLowerCase());
        }
        return result
    }

    // Get balances

    async balances(stub, currency = null) {
        if (Array.isArray(stub)) {
            var [uuid, stub] = stub
        } else {
            var uuid = context.get('uuid')
        }
        var query = {
            uuid: uuid,
            stub: stub
        }
        if (currency != null) query['currency'] = currency
        //var cachekey = ['exchange:balances'].concat(Object.values(query)).join(':');
        var result = await this.mod.datasource.select('exchange:balances', query);
        return result;
    }

    // Get orders

    async all_orders(stub, symbol = undefined, since = undefined, limit = undefined) {
        try {
            var params = {};
            if (![undefined, false, '', '<ALL>'].includes(symbol)) params['symbol'] = symbol;
            if (![undefined, false, ''].includes(since)) params['since'] = since;
            if (![undefined, false, ''].includes(limit)) params['limit'] = limit;
            var result = await this.execute(stub, 'all_orders', params);
            return result;                
        } catch(e) {
            this.mod.output.exception(e);
        }
        return false;
    }

    // Get open orders

    async open_orders(stub, symbol = undefined, since = undefined, limit = undefined) {
        try {
            var params = {};
            if (![undefined, false, '', '<ALL>'].includes(symbol)) params['symbol'] = symbol;
            if (![undefined, false, ''].includes(since)) params['since'] = since;
            if (![undefined, false, ''].includes(limit)) params['limit'] = limit;
            var result = await this.execute(stub, 'open_orders', params);
            return result;                
        } catch(e) {
            this.mod.output.exception(e);
        }
        return false;
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
            //await this.normalizers[exchange].markets();
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
            //console.log(global.frostybot.exchanges[exchange])
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
        var markets = global.frostybot.markets[exchange];
        if (markets == undefined) {
            await this.refresh_markets_datasource();
        }
        var mapping = global.frostybot.mapping[exchange];
        if (markets != undefined)
            return markets[mapping[search]] != undefined ? markets[mapping[search]] : false;
        else    
            return false;
    }

    // Find ticker for an ID or symbol

    async findticker(exchange, id) {
        if (this.mod.redis.is_connected()) {
            var ticker = await this.mod.redis.get(['ticker', exchange, id].join(':'))
        } else {
            var ticker = global.frostybot.tickers[exchange][id];
        }
        return ticker != undefined ? ticker : false;
}

    // Get specific market

    async market(params, sym = undefined) {

        if (typeof(params) == 'string') {
            // Internal call
            var exchange = params;
            var symbol = sym.toUpperCase();
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

    // Index Market

    index_market(market) {
        if (market.index != undefined) {
            if (global.frostybot.markets == undefined) global.frostybot.markets = {};
            if (global.frostybot.markets[market.exchange] == undefined) global.frostybot.markets[market.exchange] = {};
            if (global.frostybot.markets[market.exchange][market.id] == undefined) global.frostybot.markets[market.exchange][market.id] = market;
            if (global.frostybot.mapping == undefined) global.frostybot.mapping = {};
            if (global.frostybot.mapping[market.exchange] == undefined) global.frostybot.mapping[market.exchange] = {};
            Object.values(market.index).forEach(val => {
              global.frostybot.mapping[market.exchange][val] = market.id;
            });
        }        
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

        if (global.frostybot.markets == undefined) await this.refresh_markets_datasource();
        if (global.frostybot.markets[exchange] == undefined) {
            var query = {
                exchange: exchange,
            }
            if (symbol != undefined) query['id'] = symbol;
            var result = await this.mod.datasource.select('exchange:markets', query);
            var results = {};
            if (result != false) {
                for (var i = 0; i < result.length; i++) {
                    var market = result[i];
                    await market.update();
                    this.index_market(market);
                    results[market.id] = market;
                }
            }
        }

        if (symbol != undefined) {
            var market =  await this.findmarket(exchange, symbol);
//            if (market !== false) return await this.update_pricing(exchange, symbol);
            if (market !== false) {
                //market.update();
                return market;
            }
        } else {
            var results = {};
            for (const [symbol, market] of Object.entries(global.frostybot.markets[exchange])) {
//                results[symbol] = await this.update_pricing(exchange, symbol);
                //market.update();
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

    /*async refresh_markets(exchange) {
        if (global.frostybot == undefined) global.frostybot = {};
        if (global.frostybot.markets == undefined) global.frostybot.markets = {};
        if (global.frostybot.mapping == undefined) global.frostybot.mapping = {};
        if (global.frostybot.exchanges == undefined) global.frostybot.exchanges = {};
        for (const [exchange, normalizer] of Object.entries(this.normalizers)) {
            if (global.frostybot.markets[exchange] == undefined) global.frostybot.markets[exchange] = {};
            if (global.frostybot.mapping[exchange] == undefined) global.frostybot.mapping[exchange] = {};
            try {
                var result = await normalizer.execute('markets', {}, true);
                console.log('MARKETS: ' + result.length)
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
    }*/

    // Get position data for the exchange:positions datasource

    async refresh_positions_datasource(params = {}) {
        var uuidstubs = await this.uuids_and_stubs(params);
        var all = [];
        for (const [user, stubs] of Object.entries(uuidstubs)) {
            for (const [stub, config] of Object.entries(stubs)) {
                try {
                    var result = await this.execute(config, 'positions');
                } catch (e) {
                    var result = false;
                }                
                await this.mod.datasource.delete('exchange:positions', {uuid: user, stub: stub})
                if (result != false) {
                    var positions = [];
                    if (Array.isArray(result) && (result.length > 0)) {
                        for (var j = 0; j < result.length; j++) {
                            positions.push(result[j]);                       
                        }
                        await this.mod.datasource.update_data('exchange:positions', positions);
                    }
                    all = all.concat(positions)
                }
            }
        }
        return all;        
    }

    // Get position data for the exchange:positions datasource

    async refresh_balances_datasource(params = {}) {
        var uuidstubs = await this.uuids_and_stubs(params);
        var all = [];
        for (const [user, stubs] of Object.entries(uuidstubs)) {
            for (const [stub, config] of Object.entries(stubs)) {
                try {
                    var result = await this.execute(config, 'balances');
                } catch (e) {
                    var result = false;
                }                
                if (result != false) {
                    await this.mod.datasource.delete('exchange:balances', {uuid: user, stub: stub})
                    var balances = [];
                    if (Array.isArray(result) && (result.length > 0)) {
                        for (var j = 0; j < result.length; j++) {
                            balances.push(result[j]);                       
                        }
                        await this.mod.datasource.update_data('exchange:balances', balances);
                    }
                    all = all.concat(balances)
                }
            }
        }
        return all; 
    }

    // Get market data for the exchange:markets datasource

    async refresh_markets_datasource(params = {}) {
        if (this.exchange_list() == {}) await this.load_normalizers();
        var exchanges = this.exchange_list();
        for (var e = 0; e < exchanges.length; e++) {
            var exchange = exchanges[e];
            try {
                var result = await this.normalizers[exchange].markets();
                for (var i = 0; i < result.length; i++) {
                    var market = result[i]
                    this.index_market(market);
                }
            } catch (e) {
                this.mod.output.exception(e)
                var result = false;
            }
            if (Array.isArray(result) && (result.length > 0)) {
                await this.mod.datasource.update_data('exchange:markets', result);
            }
        }
        return result; 
    }

    // Poll All Users and Cache Position Data

    async register_positions_datasource() {
        var indexes = {
            unqkey  : ['uuid', 'stub', 'symbol', 'direction'],
            idxkey1 : 'uuid',
            idxkey2 : 'stub',
            idxkey3 : 'symbol',
        }
        this.mod.datasource.register('0,2,4,6,8,10,12,14,16,18,20,22,24,26,28,30,32,34,36,38,40,42,44,46,48,50,52,54,56,58 * * * *', 'exchange:positions', indexes, async() => {
            return await this.mod.exchange.refresh_positions_datasource();
        }, 180);
    }

    // Poll All Users and Cache Balance Data

    async register_balances_datasource() {
        var indexes = {
            unqkey  : ['uuid', 'stub', 'currency'],
            idxkey1 : 'uuid',
            idxkey2 : 'stub',
            idxkey3 : 'currency',
        }
        this.mod.datasource.register('1,3,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,39,41,43,45,47,49,51,53,55,57,59 * * * *', 'exchange:balances', indexes, async() => {
            return await this.mod.exchange.refresh_balances_datasource();
        }, 180);
    }

    // Poll All Market Data
    
    async register_markets_datasource() {
        var indexes = {
            unqkey  : ['exchange', 'id'],
            idxkey1 : 'exchange',
            idxkey2 : 'id'
        }
        this.mod.datasource.register('*/5 * * * *', 'exchange:markets', indexes, async() => {
            return await this.mod.exchange.refresh_markets_datasource();
        }, 600);
    }
    

}
