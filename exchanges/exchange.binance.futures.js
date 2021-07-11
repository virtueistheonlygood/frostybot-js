const frostybot_exchange_base = require('./exchange.base');
const frostybot_error = require('../classes/classes.error');
const frostybot_order = require('../classes/classes.order');
const frostybot_balance = require('../classes/classes.balance');
const frostybot_position = require('../classes/classes.position');
const frostybot_market = require('../classes/classes.market');

var context = require('express-http-context');
var binanceapi = require('node-binance-api-ext');

module.exports = class frostybot_exchange_binance_futures extends frostybot_exchange_base {

    // Class constructor

    constructor(stub = undefined) {
        super({stub: stub});        
        this.type = 'futures'                        // Exchange subtype
        this.shortname = 'binance_futures'           // Abbreviated name for this exchange
        this.description = 'Binance USD-M Futures'   // Full name for this exchange
        this.has_subaccounts = false                 // Subaccounts supported?
        this.has_testnet = true                      // Test supported?
        this.stablecoins = ['USDT','BUSD'];          // Stablecoins supported on this exchange
        this.order_sizing = 'base';                  // Exchange requires base size for orders
        this.collateral_assets = ['USDT','BUSD'];    // Assets that are used for collateral
        this.exchange_symbol = 'symbol';             // Does CCXT use the ID or the Symbol field?
        this.balances_market_map = '{currency}USDT'  // Which market to use to convert non-USD balances to USD
        this.orders_symbol_required = true;          // This exchange requires a symbol when fetching orders
        this.param_map = {                           // Order parameter mappings
            limit              : 'LIMIT',
            market             : 'MARKET',
            stoploss_limit     : 'STOP',
            stoploss_market    : 'STOP_MARKET',
            takeprofit_limit   : 'TAKE_PROFIT', 
            takeprofit_market  : 'TAKE_PROFIT_MARKET',
            take_profit_limit  : 'TAKE_PROFIT', 
            take_profit_market : 'TAKE_PROFIT_MARKET',
            trailing_stop      : 'TRAILING_STOP_MARKET', 
            post               : null,                // TODO
            reduce             : 'reduceOnly',
            ioc                : null,                // TODO
            tag                : null,                // TODO
            trigger            : 'stopPrice',
        };
        this.markets_by_id = null;
        this.map_mod()
        this.initialize()
    }

    // Initialize exchange

    async initialize() {
        //await this.markets();
        if (this.stub != undefined) {
            var options = {
                APIKEY: String(this.stub.parameters.apikey),
                APISECRET: String(this.stub.parameters.secret),
                useServerTime: true,
                recvWindow: 60000,
                verbose: true,
                log: function(params) {
                    this.mod.output.api('binance_futures', params);
                }
            }
            try {
                this.binance = binanceapi(options);
            } catch (e) {
                return false;
            }
            /*
            if (this.binance) {
                if (global.frostybot.markets == undefined) {
                    await this.markets();
                } else {
                    if (global.frostybot.markets['binance_futures'] == undefined) await this.markets();
                }
            }
            */
        }
        await this.load_markets();
    }


    // Test API Keys

    async test(apikey, secret, testnet = false) {
        try {
            var testapi = require('node-binance-api-ext');
            var test = testapi({
                APIKEY: apikey,
                APISECRET: secret,
                useServerTime: true,
                recvWindow: 60000,
                test: String(testnet) == 'true' ? true : false
            });
            await test.futures.balance();
            return true;
        } catch(e) {
            return false;
        }
    }

    // Custom params

    async custom_params(params) {
        var [type, order, custom, command] = params

        // Check account to see if hedge mode is enabled

        var hedgemode = await this.mod.accounts.get_hedge_mode({stub: command.stub})            

        var accounthedgemode = hedgemode.enabled;                               // Account Hedge mode
        var commandhedgemode = ['long', 'short'].includes(command.direction)    // Hedge mode implied in command

        order.params['positionSide'] = (accounthedgemode ? (commandhedgemode ? command.direction : 'long') : 'both').toUpperCase()

        if (order.params.reduceOnly != undefined && commandhedgemode == true) delete order.params.reduceOnly

        return order;
    }  
    
    // Load Markets

    async load_markets() {

        if (this.markets_by_id != null) return true;

        var _this = this;
        var cachekey = ['binance_futures', 'markets'].join(':');
        let markets = await this.mod.cache.method(cachekey, 60, async () => {
            return await _this.markets(true);
        });

        var markets_by_id = {};
        markets.forEach(market => {
            markets_by_id[market.id] = market;
        })
        this.markets_by_id = markets_by_id;
        global.frostybot.markets['binance_futures'] = markets_by_id;

    }

    // Set leverage for symbol

    async leverage(params) {
        var [symbol, type, leverage] = this.mod.utils.extract_props(params, ['symbol', 'type', 'leverage']);
        //var market = await this.find_market(symbol);
        //symbol = market.id;
        var type = (type == 'cross' ? 'CROSSED' : (type == 'isolated' ? 'ISOLATED' : null));
        var leverage = leverage.toLowerCase().replace('x', '');
        try { 
            await this.binance.futures.marginType(symbol, type);
        } catch (e) {}
        var leverageResult = await this.binance.futures.leverage(symbol, leverage);
        if ((leverageResult.hasOwnProperty('leverage')) && (leverageResult.leverage == leverage)) {
            return true;
        } else {
            return false;
        }
    }

    // Get hedge mode configuratiom

    async get_hedge_mode() {
        var position_mode = await this.binance.futures.positionMode();
        var dual = position_mode.dualSidePosition || false;
        return dual;
    }

    // Enable hedge mode

    async enable_hedge_mode() {
        try {
            var result = await this.binance.futures.changePositionMode(true);
            return result.code == 200 ? true : false
        } catch(e) {
            return e.code == -4059 ? true : new frostybot_error(e.msg || e.message, e.code)
        }
    }

    // Disable hedge mode

    async disable_hedge_mode() {
        try {
            var result = await this.binance.futures.changePositionMode(false);
            return result.code == 200 ? true : false
        } catch(e) {
            return e.code == -4059 ? true : new frostybot_error(e.msg || e.message, e.code)
        }
    }

    // Create a market order

    async create_market_order(side, symbol, amount, order_params = {}) {
        try {
            return side.toUpperCase() == 'BUY' ? await this.binance.futures.marketBuy(symbol, amount, order_params) : await this.binance.futures.marketSell(symbol, amount, order_params)
        } catch (e) {
            throw new frostybot_error(e.msg, e.code);
        }
    }

    // Create a limit order

    async create_limit_order(side, symbol, amount, price, order_params = {}) {
        try {
            return side.toUpperCase() == 'BUY' ? await this.binance.futures.buy(symbol, amount, price, order_params) : await this.binance.futures.sell(symbol, amount, price, order_params)
        } catch (e) {
            throw new frostybot_error(e.msg, e.code);
        }
    }

    // Create a stop market order

    async create_stop_market_order(side, symbol, amount, trigger, order_params = {}) {
        try {
            return side.toUpperCase() == 'BUY' ? await this.binance.futures.stopMarketBuy(symbol, amount, trigger, order_params) : await this.binance.futures.stopMarketSell(symbol, amount, trigger, order_params)
        } catch (e) {
            throw new frostybot_error(e.msg, e.code);
        }
    }


    // Create a stop limit order

    async create_stop_limit_order(side, symbol, amount, price, trigger, order_params = {}) {
        try {
            return side.toUpperCase() == 'BUY' ? await this.binance.futures.stopLimitBuy(symbol, amount, price, trigger, order_params) : await this.binance.futures.stopLimitSell(symbol, amount, price, trigger, order_params)
        } catch (e) {
            throw new frostybot_error(e.msg, e.code);
        }
    }

    // Create a take profit market order

    async create_take_profit_market_order(side, symbol, amount, trigger, order_params = {}) {
        try {
            order_params['side'] = side.toUpperCase()
            order_params['type'] = this.param_map['take_profit_market'];
            order_params['stopPrice'] = trigger;
            order_params['timestamp'] = (new Date()).getTime();
            return side.toUpperCase() == 'BUY' ? await this.binance.futures.marketBuy(symbol, amount, order_params) : await this.binance.futures.marketSell(symbol, amount, order_params)
        } catch (e) {
            throw new frostybot_error(e.msg, e.code);
        }
    }

    // Create new order

    async create_order(params) {
        var symbol = params.symbol;
        var type = params.type;
        var side = params.side.toUpperCase();
        var amount = parseFloat(params.amount);
        var price = params.price == undefined ? false : params.price;
        var order_params = params.params
        var trigger = order_params.stopPrice !== undefined ? order_params.stopPrice : undefined;

        delete order_params.stopPrice;

        var order_params = params.params;
        //var [symbol, type, side, amount, price, order_params] = this.mod.utils.extract_props(params, ['symbol', 'type', 'side', 'amount', 'price', 'params']);
        //var market = this.find_market(symbol);
        //symbol = market.id;
        try {
            switch (type) {
                case 'MARKET'               :   return await this.create_market_order(side, symbol, amount, order_params);
                case 'LIMIT'                :   return await this.create_limit_order(side, symbol, amount, price, order_params);
                case 'STOP_MARKET'          :   return await this.create_stop_market_order(side, symbol, amount, trigger, order_params);
                case 'STOP'                 :   return await this.create_stop_limit_order(side, symbol, amount, price, trigger, order_params);
                case 'TAKE_PROFIT_MARKET'   :   return await this.create_take_profit_market_order(side, symbol, amount, trigger, order_params);
                case 'TAKE_PROFIT'          :   return await this.create_limit_order(side, symbol, amount, trigger, order_params);
            }
                
        } catch (e) {
            return e
            //throw new frostybot_error((e.msg || e.message), e.code);
        }
        if (result.status !== undefined) return this.parse_order(result);
    }

    // Get account balances

    async balances() {

        var cachekey = ['binance_futures', 'rawbalances', this.stub.uuid, this.stub.stub].join(':');
        let raw_balances = await this.mod.cache.method(cachekey, 5, async () => {
            return await this.binance.futures.balance();
        });

        const userinfo = {
            uuid: this.stub.uuid, 
            stub: this.stub.stub
        }

        var balances = [];
        if (this.mod.utils.is_object(raw_balances)) {
            for (const [currency, raw_balance] of Object.entries(raw_balances)) {
                if (raw_balance.total != 0) {
                    var balance = new frostybot_balance(userinfo, 'binance_futures', currency, raw_balance.available, raw_balance.total)
                    balances.push(balance);
                }
            }
        }

        return balances;

    }

    // Get list of current positions

    async positions() { 

        var cachekey = ['binance_futures', 'rawpositions', this.stub.uuid, this.stub.stub].join(':');
        let raw_positions = await this.mod.cache.method(cachekey, 5, async () => {
            return await this.binance.futures.positionRisk();
        });

        var positions = [];
        const userinfo = {
            uuid: this.stub.uuid, 
            stub: this.stub.stub
        }

        await this.load_markets();

        raw_positions
            .filter(raw_position => parseFloat(raw_position.positionAmt) != 0)
            .forEach(async (raw_position) => {
                const symbol = raw_position.symbol;
                const market = this.markets_by_id[symbol];
                const direction = raw_position.positionSide !== 'BOTH' ? raw_position.positionSide.toLowerCase() : (parseFloat(raw_position.positionAmt) < 0 ? 'short' : 'long');
                const size = parseFloat(raw_position.positionAmt);
                const entryPrice = parseFloat(raw_position.entryPrice);
                const liqPrice = parseFloat(raw_position.liquidationPrice);
                const position = new frostybot_position(userinfo, market, direction, size, entryPrice, liqPrice);
                positions.push(position)            
            })

        return positions;

    }

    // Get list of markets from exchange

    async markets() {

        let results = [];
        var cachekey = ['binance_futures', 'rawmarkets'].join(':');
        var raw_markets = await this.mod.cache.method(cachekey, 300, async () => {
            const axios = require( 'axios' );
            var response = await axios.get('https://fapi.binance.com/fapi/v1/exchangeInfo');
            if (response.status == 200) 
                return response.data;
            else
                return false;
        });
        var tickers = await this.tickers();
        var exchange = (this.shortname != undefined ? this.shortname : (this.constructor.name).split('_').slice(2).join('_'));
        raw_markets.symbols
            .filter(raw_market => raw_market.contractType.toUpperCase() == 'PERPETUAL' && raw_market.status.toUpperCase() == 'TRADING')
            .forEach(raw_market => {
                const id = raw_market.symbol;
                const prices = tickers[id] != undefined ? tickers[id] : {};
                const price_filters = raw_market.filters.filter(item => item.filterType.toUpperCase() == 'PRICE_FILTER');
                const size_filters = raw_market.filters.filter(item => item.filterType.toUpperCase() == 'LOT_SIZE');
                const price_filter = Array.isArray(price_filters) && price_filters.length >= 1 ? price_filters[0] : {};
                const size_filter = Array.isArray(size_filters) && size_filters.length >= 1 ? size_filters[0] : {};
                var market = new frostybot_market(exchange, id, {
                    assets: {
                        base: raw_market.baseAsset,
                        quote: raw_market.quoteAsset
                    },
                    prices: {
                        bid: parseFloat(prices.bid || null),
                        ask: parseFloat(prices.ask || null),        
                    },
                    metadata: {
                        index: {
                            id: id,                           // ID from exchange (BTCUSDT)
                            symbol: id.replace('USDT','/USDT'),   // CCXT backwards compatibility (BTC/USDT)
                            tradingview: 'BINANCE:' + id,              // Tradingview Chart Symbol (BINANCE:BTCUSDT)
                        },
                        type: 'futures',
                        expiration: null,
                        contract_size: 1,
                        precision: {
                            price: parseFloat(price_filter.tickSize || null),
                            amount: parseFloat(size_filter.stepSize || null),
                        },
                        limits: {
                            amount: {
                                min: parseFloat(size_filter.minQty || null),
                                max: parseFloat(size_filter.maxQty || null),
                            },
                            order_types: {
                                limit: raw_market.orderTypes.includes('LIMIT') ? true : false,
                                market: raw_market.orderTypes.includes('MARKET') ? true : false,
                                stoploss_limit: raw_market.orderTypes.includes('STOP') ? true : false,
                                stoploss_market: raw_market.orderTypes.includes('STOP_MARKET') ? true : false,
                                takeprofit_limit: raw_market.orderTypes.includes('TAKE_PROFIT') ? true : false,
                                takeprofit_market: raw_market.orderTypes.includes('TAKE_PROFIT_MARKET') ? true : false,
                                trailing_stop: raw_market.orderTypes.includes('TRAILING_STOP_MARKET') ? true : false,
                            }
                        }
                    } 
                });
                market.update();
                results.push(market);
            });
        return results;
    }

    // Get ticker

    async ticker(symbol) {
        var key = ['ticker', 'binance_futures', symbol].join(':');
        if (this.mod.redis.is_connected()) {
            var ticker = await this.mod.redis.get(key);
        } else {
            var ticker = global.frostybot != undefined ? (global.frostybot.tickers != undefined ? (global.frostybot.tickers['binance_futures'] != undefined ? global.frostybot.tickers['binance_futures'][symbol] : undefined) : undefined) : undefined;
        }
        return ticker != undefined ? ticker : { bid: null, ask: null };
    }

    // Fetch tickers

    async tickers() {
        if (this.mod.redis.is_connected()) {
            var result = await this.mod.redis.search(['ticker', 'binance_futures', '*'].join(':'));
            var tickers = {};
            if (this.mod.utils.is_object(result)) {
                var values = Object.values(result);
                if (values.length > 0) {
                    for (var i = 0; i < values.length; i++) {
                        var ticker = values[i];
                        tickers[ticker.symbol] = ticker;
                    }
                }
            }
            return tickers;
        } else {
            return global.frostybot != undefined ? (global.frostybot.tickers != undefined ? (global.frostybot.tickers['binance_futures'] != undefined ? global.frostybot.tickers['binance_futures'] : undefined) : undefined) : undefined;
        }

    }

    // Get specific order ID

    async order(params) {
        var symbol = params.symbol;
        //var market = await this.find_market(symbol);
        //symbol = market.id;
        var id = params.id;
        try {
            var result = await this.binance.futures.openOrders(symbol, {orderId: id});
            if (this.mod.utils.is_array(result) && result.length == 0) {
                var result = (await this.binance.futures.allOrders(symbol)).filter(order => order.orderId == id);
            }
        } catch (e) {
            throw new frostybot_error(e.msg, e.code)
        }
        return this.mod.utils.is_array(result) ? (result.length == 1 ? this.parse_order(result[0]) : false) : false;
    }   

    // Get open orders

    async open_orders(params) {
        var [symbol, since, limit] = this.mod.utils.extract_props(params, ['symbol', 'since', 'limit']);
        if ([undefined, false, '<ALL>', ''].includes(symbol)) {
            symbol = undefined;
        }
        if (since == undefined) since = (new Date()).getTime() - (1000 * 60 * 60 * 24 * 7)        
        try {
            var raw_orders = await this.binance.futures.openOrders(symbol, {since: since, limit: limit});
        } catch(e) {
            return new frostybot_error(e.msg, e.code)
        }
        let results = [];
        await this.load_markets();
        raw_orders.forEach(raw_order => {
            results.push(this.parse_order(raw_order));         
        })
        return results;
    }

    // Get all order history

    async all_orders(params) {
        var [symbol, since, limit] = this.mod.utils.extract_props(params, ['symbol', 'since', 'limit']);
        if ([undefined, false, '<ALL>', ''].includes(symbol)) {
            symbol = undefined
        }
        if (since == undefined) since = (new Date()).getTime() - (1000 * 60 * 60 * 24 * 7)        
        try {
            var raw_orders = await this.binance.futures.allOrders(symbol, {since: since, limit: limit});
        } catch(e) {
            return new frostybot_error(e.msg, e.code)
        }
        let results = [];
        await this.load_markets();
        raw_orders.forEach(raw_order => {
            results.push(this.parse_order(raw_order));         
        })
        return results;
    }

    // Cancel orders

    async cancel(params) {
        var [symbol, id] = this.mod.utils.extract_props(params, ['symbol', 'id']);
        var symbol = params.symbol;
        var id = params.id;
        if (['all', undefined].includes(id)) {
            var orders = await this.open_orders({symbol: symbol});
            if (params.direction != undefined) {
                orders = orders.filter(order => order.direction == direction);
                var error = false;
                orders.forEach(async (order, idx) => {
                    var id = order.id;
                    try {
                        var result = await this.binance.futures.cancelAll(symbol, {orderId: id})
                        if (result.code == 200) {
                            order.status = 'cancelled';
                            orders[idx] = order;
                        }
                    } catch (e) { error = e }
                })
                if (error !== false) throw new frostybot_error(error.msg, error.code);
            } else {
                try {
                    await this.binance.futures.cancelAll(symbol);
                } catch (e) {
                    throw new frostybot_error(e.msg, e.code);
                }
                orders.forEach((order, idx) => {
                    order.status = 'cancelled';
                    orders[idx] = order;
                })       
            }
            return orders;
        } else {
            if (id !== undefined) {
                try {
                    var order = await this.order({symbol: symbol, id: id})
                    var result = await this.binance.futures.cancelAll(symbol, {orderId: id});                    
                    order.status = 'cancelled';
                    return order;
                } catch(e) {
                    throw new frostybot_error(e.msg, e.code);
                }
            }
        }
        return false
    }

    // Cancel oirders by type

    async cancel_by_type(symbol, types = [], direction = undefined) {
        var openorders = await this.open_orders({symbol: symbol});
        var results = [];
        if (this.mod.utils.is_array(openorders)) {
            if (!this.mod.utils.is_array(types)) types = [types];            
            var orders = openorders.filter(order => types.includes(order.type) && [order.direction, undefined].includes(direction));
            for (var i = 0; i < orders.length; i++) {
                var result = await this.cancel({symbol: symbol, id: orders[i].id})
                results.push(result);
            }
        }
        return results
    }

    // Cancel Stoploss Orders

    async cancel_sl(params) {
        return await this.cancel_by_type(params.symbol, ['stoploss_limit', 'stoploss_market'], params.direction);
    }


    // Cancel Takeprofit Orders

    async cancel_tp(params) {
        return await this.cancel_by_type(params.symbol, ['takeprofit_limit', 'takeprofit_market'], params.direction);
    }


    // Parse raw order from exchange into Frostybot order object

    parse_order(raw_order) {
        if (typeof(raw_order) == 'frostybot_order') return raw_order;
        var market = this.markets_by_id[raw_order.symbol];
        const userinfo = {
            uuid: this.stub.uuid, 
            stub: this.stub.stub
        }
        var typemap = {};
        ['limit', 'market', 'stoploss_limit', 'stoploss_market', 'takeprofit_limit', 'takeprofit_market', 'trailing_stop'].forEach(ordertype => {
            typemap[this.param_map[ordertype]] = ordertype;
        })
        var statusmap = {
            'NEW'       : 'open',
            'FILLED'    : 'closed',
            'CANCELED'  : 'cancelled',
            'CANCELLED' : 'cancelled',
        }
        var id = raw_order.orderId;
        var timestamp = raw_order.updateTime;
        var type = typemap[raw_order.origType];
        var side = raw_order.side.toLowerCase();
        var positionside = raw_order.positionSide.toLowerCase();
        var direction = positionside == 'both' ? null : positionside;
        var avgPrice = parseFloat(raw_order.avgPrice);
        var ordPrice = parseFloat(raw_order.price);
        var price = ordPrice != 0 ? ordPrice : (avgPrice != 0 ? avgPrice : null)
        var triggerPrice = parseFloat(raw_order.stopPrice);
        var trigger = triggerPrice != 0 ? triggerPrice : null
        var size = parseFloat(raw_order.origQty)
        var filled = parseFloat(raw_order.executedQty)
        var status = statusmap[raw_order.status] || raw_order.status.toLowerCase();
        return new frostybot_order(userinfo, market, id, timestamp, type, direction, side, price, trigger, size, filled, status)
    }

}
