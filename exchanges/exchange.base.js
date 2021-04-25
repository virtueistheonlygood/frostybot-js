// Exchange Base Class

const md5 = require('md5');

// Normalizer base class

module.exports = class frostybot_exchange_base {

    constructor(stub = undefined) {
        if (stub != undefined) this.stub = stub;
        this.ccxtfield = 'symbol';       // Does CCXT use the ID or the Symbol field?
        this.map_mod();
        this.ccxtload();
    }

    // Get mapped parameter

    get_param_map() {
        return this.param_map;
    }

    // Reload CCXT Object

    async ccxtload() {
        var [exchange, params] = this.ccxtparams();
        this.exchange = exchange
        const ccxtlib = require ('ccxt');
        const ccxtclass = ccxtlib[exchange];
        try {
            this.ccxtobj = new ccxtclass (params);
            this.ccxtobj.options.adjustForTimeDifference = true
            this.ccxtobj.loadMarkets();
        } catch(error) {
            this.mod.output.exception(error);
        }  
    }

    // Create module shortcuts

    map_mod() { 
        this['mod'] = global.frostybot.modules;
        this['classes'] = global.frostybot.classes;
        this['database'] = global.frostybot.modules['database'];
    }
    
    // Execute normalizer method or fallback to CCXT

    async execute(method, params) {
        if (typeof(this[method]) === 'function') {
            return await this[method](params);
        } else {
            if (this.ccxtobj == undefined) await this.ccxtload();
            if (typeof(this.ccxtobj[method]) === 'function') {
                try {
                    var result = await this.ccxtobj[method](params);
                } catch(e) {
                    this.mod.output.exception(e)
                    result = false;
                }
                return result;
            }
        }
        return false;

    }

    // Get account balances

    async balances() {
        let results = await this.ccxtobj.fetch_balance();
        var _self = this;
        if (results.result != 'error') {
            var raw_balances = results.hasOwnProperty('data') ? results.data : results;
            delete raw_balances.timestamp;
            delete raw_balances.datetime;
            delete raw_balances.info;
            delete raw_balances.free;
            delete raw_balances.used;
            delete raw_balances.total;
            var balances = [];
            Object.keys(raw_balances)
                .forEach(currency => {
                    var raw_balance = raw_balances[currency];
                    if (raw_balance.total != false) {
                        const used = raw_balance.used;
                        const free = raw_balance.free;
                        const total = raw_balance.total;
                        const balance = new this.classes.balance(this.stub.uuid, this.stub.stub, _self.shortname, currency, free, used, total);
                        if (total != 0) {
                            balances.push(balance);
                        }
                    }
                });
            return balances;
        }   
        return [];
    }

    // Find market
    find_market(symbol) {
        var exchange = (this.shortname != undefined ? this.shortname : (this.constructor.name).split('_').slice(2).join('_'));
        var markets = global.frostybot.markets[exchange];
        var mapping = global.frostybot.mapping[exchange];
        if (markets != undefined)
            return markets[mapping[symbol]] != undefined ? markets[mapping[symbol]] : false;

    }

    // Merge orders

    merge_orders(orders1, orders2) {
        let orders = {};
        if (!this.mod.utils.is_array(orders1)) orders1 = [];
        if (!this.mod.utils.is_array(orders2)) orders2 = [];
        orders1.forEach((order) => { orders[order.id] = order; })
        orders2.forEach((order) => { orders[order.id] = order; })
        //var merged = [...orders1, ...orders2];
        var merged = Object.values(orders)
        return merged.sort((a, b) => (a.timestamp < b.timestamp) ? 1 : -1);
    }

    // Parse orders

    parse_orders(raworders) {
        var orders = [];
        if (this.mod.utils.is_array(raworders)) {
            raworders.forEach(raworder => {
                orders.push(this.parse_order(raworder));
            });
        }
        return orders;
    }

    // Get order parameter mappings

    get_order_param_map() {
        return this.param_map;
    }

    // Create new order

    async create_order(params) {
        var symbol = params.symbol;
        var type = params.type;
        var side = params.side;
        var amount = parseFloat(params.amount);
        var price = params.price;
        var order_params = params.order_params;
        //var [symbol, type, side, amount, price, order_params] = this.mod.utils.extract_props(params, ['symbol', 'type', 'side', 'amount', 'price', 'params']);
        var market = this.find_market(symbol);
        symbol = market.symbol;
        let create_result = await this.ccxtobj.create_order(symbol, type, side, amount, price, order_params);
        if (create_result.result == 'error') {
            var errortype = create_result.data.name;
            var trimerr = create_result.data.message.replace('ftx','').replace('deribit','')
            if (this.mod.utils.is_json(trimerr)) {
                var errormsg = JSON.parse(trimerr).error;
                var result = {result: 'error', params: params, error: {type: errortype, message: errormsg}};
            } else {
                var errormsg = create_result.data.message;
                var result = {result: 'error', params: params, error: {type: errortype, message: errormsg}};
            }
        } else {
            var result = {result: 'success', params: params, order: this.parse_order(create_result)};
        }
        return result;
    }


    // Get order by id

    async order(params) {
        var [symbol, id] = this.mod.utils.extract_props(params, ['symbol', 'id']);
        var orders = await this.all_orders({symbol: symbol});
        if (orders.length > 0) {
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i]
                if (String(order.id) == String(id)) {
                    return order
                }
            }
        }
        return false;
    }


    // Get orders

    async orders(params) {
        var status = this.mod.utils.extract_props(params, ['status']);
        if (status == 'open') {
            var orders = await this.open_orders(params);    
        } else {
            var orders = await this.all_orders(params);
        }
        var filterkeys = ['symbol', 'status', 'type', 'direction', 'id'];
        for (var i = 0; i < filterkeys.length; i++) {
            var key = filterkeys[i];
            if (params[key] != undefined) {
                orders = orders.filter(order => order[key] == params[key]);
            }
            
        }
        return orders;
    }

    // Get order history

    async order_history(params) {
        return await this.all_orders(params);
    }

    // Cancel all orders
    
    async cancel_all(params) {
        if (params.type !== undefined) {
            var orders = await this.open_orders(params);  
            var results = [];
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                var response = await this.cancel({symbol: params.symbol, id: order.id});
                results.push(Array.isArray(response) ? response[0] : response);
            }
            return results;
        } else {
            params.id = 'all';
            return this.cancel(params);
        }
    }
    
    // Default leverage function (if not supported by exchange)

    async leverage(params) {
        return this.mod.output.error('leverage_unsupported')
    }

}
