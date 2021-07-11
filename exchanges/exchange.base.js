// Exchange Base Class

const md5 = require('md5');

// Normalizer base class

module.exports = class frostybot_exchange_base {

    constructor(options = {}) {
        if (global.frostybot.markets != undefined) global.frostybot.markets = {}
        if (options.stub != undefined) this.stub = options.stub;
        this.map_mod();
    }

    // Get mapped parameter

    get_param_map() {
        return this.param_map;
    }

    // Create module shortcuts

    map_mod() { 
        this['mod'] = global.frostybot.modules;
        this['classes'] = global.frostybot.classes;
        this['database'] = global.frostybot.modules['database'];
    }
    
    // Execute normalizer method

    async execute(method, params) {
        if (typeof(this[method]) === 'function') {
            return await this[method](params);
        } 
        return false;

    }

    // Find market
    find_market(symbol) {
        var exchange = (this.shortname != undefined ? this.shortname : (this.constructor.name).split('_').slice(2).join('_'));
        var markets = global.frostybot.markets[exchange];
        var mapping = global.frostybot.mapping[exchange];
        //if (markets == undefined) await this.markets();
        if (markets != undefined)
            return markets[mapping[symbol]] != undefined ? markets[mapping[symbol]] : false;

    }

    // Get order parameter mappings

    get_order_param_map() {
        return this.param_map;
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
