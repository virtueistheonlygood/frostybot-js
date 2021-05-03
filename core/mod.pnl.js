// PNL calculation module

const frostybot_module = require('./mod.base')
var context = require('express-http-context')
const axios = require('axios')

module.exports = class frostybot_pnl_module extends frostybot_module {

   // Constructor

    constructor() {
        super()
        this.description = 'Statistics and Reporting'
        this.exchange = [];
    }

    // Register methods with the API (called by init_all() in core.loader.js)

    register_api_endpoints() {

        // Permissions for each command
        var permissions = {
            'pnl:import': {
                'standard': ['local', 'loopback' ],
                'provider': ['local', 'loopback' ],
            },
            'pnl:quick_import': {
                'standard': ['local', 'loopback' ],
                'provider': ['local', 'loopback' ],
            },
            'pnl:get': {
                'standard': [ 'core,singleuser', 'multiuser,user', 'local', 'token', 'loopback' ],
                'provider': [ 'local', 'token', 'loopback' ],    
            }
        }

        // API method to endpoint mappings
        var api = {
            'pnl:import': [
                'post|/pnl/import',                      // Trigger PNL import for all users and all stubs
                'post|/pnl/import/:user',                // Trigger PNL import for specific user
                'post|/pnl/import/:user/:stub',          // Trigger PNL import for specific user and stub
                'post|/pnl/import/:user/:stub/:market',  // Trigger PNL import for specific user, stub and market
            ],
            'pnl:quick_import': [
                'post|/pnl/quick_import',                // Trigger Quick PNL import for specific user, stub and symbol
            ],
            'pnl:get': [
                'get|/pnl/:user',                        // Get PNL data for a specific user
                'get|/pnl/:user/:stub',                  // Get PNL data for a specific user and stub
                'get|/pnl/:user/:stub/:market',          // Get PNL data for a specific user, stub and market
            ],
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions[method]); // Defined in mod.base.js
        }
        
    }

    // Import orders for every user, stub and symbol

    async import(params) {

        var uuid = context.get('uuid');

        var schema = {
            user:        { optional: 'string', format: 'lowercase', },
            stub:        { optional: 'string' },
            market:      { optional: 'string', format: 'uppercase' },
            days:        { optional: 'number' },
        }        

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [user, stub, market, days] = this.mod.utils.extract_props(params, ['user', 'stub', 'market', 'days']);
        var url = await global.frostybot.modules['core'].url();

        if (user == undefined) {

            // User is undefined

            var users = await this.database.select('users');

            if (Array.isArray(users)) {
                users.forEach(item => {
                    var user = item.uuid;

                    var payload = {
                        uuid        : uuid,
                        user        : user,
                        command     : 'pnl:import',
                        days        : days
                    }

                    axios.post(url + '/frostybot',  payload);
                });
            }

            return true;
            
        } else {

            // User is defined

            if (stub == undefined) {

                // Stub is not defined

                var stubs = await this.database.select('settings', {uuid: user, mainkey: 'accounts'});

                if (Array.isArray(stubs)) {
                    stubs.forEach(item => {
                        var stub = item.subkey;
    
                        var payload = {
                            uuid        : uuid,
                            command     : 'pnl:import',
                            user        : user,
                            stub        : stub,
                            days        : days
                        }
    
                        try {
                            axios.post(url + '/frostybot',  payload);
                        } catch(e) {
                            this.mod.output.exception(e);
                        }

                    })
                }

                return true;
    
            } else {


                // Stub is defined

                var exchange = await this.mod.exchange.get_exchange_from_stub([user,stub]);
                var symbol_required = await this.mod.exchange.setting(exchange, 'orders_symbol_required');

                if (market == undefined) {
                    var symbols = symbol_required ? await this.mod.exchange.symbols(exchange) : ['<ALL>'];
                } else {
                    var symbols = Array.isArray(market) ? market : [market];
                }
                

                if (Array.isArray(symbols)) {
                    
                    var total = 0;

                    for (var i = 0; i < symbols.length; i++) {
                        var symbol = symbols[i];

                        params.market = symbol;
                        var order_history = await this.order_history(user, stub, symbol, days);
                        var qty = Array.isArray(order_history) ? order_history.length : 0;
                        //console.log(stub +': ' + symbol + ': ' + qty)
                        total += qty;

                        if (Array.isArray(order_history)) {
                            order_history.forEach(async (order) => {
                                await this.update_order(user, stub, order);
                            });
                        }

                        /*
                        var uuid = context.get('uuid');    
                        var payload = {
                            uuid        : uuid,
                            command     : 'pnl:import_orders',
                            user        : user,
                            stub        : stub,
                            market      : symbol,
                            days        : days
                        }

                        axios.post(url + '/frostybot',  payload);
                        await this.mod.utils.sleep(1);
                        */

                    }

                    var importstats = {
                        user: user,
                        stub: stub,
                        total: total,
                    }

                    this.mod.output.debug('orders_imported', importstats);

                    return true;

                }

                
            }

        }



        
    }


    // Quick import import specific symbol for a user when a close command is executed

    async quick_import(stub, symbol) {
        if ((typeof(stub) != 'string') && (stub.hasOwnProperty('stub'))) {
            symbol = stub.symbol
            stub = stub.stub
        }
        var user = context.get('uuid');
        //var order_history = await this.order_history(user, stub, symbol, 7);
        var order_history =  await this.mod.exchange.orders(stub, symbol);
        //console.log(order_history)
        if (Array.isArray(order_history)) {
            order_history.forEach(async(order) => {
                await this.update_order(user, stub, order);
            });
            //console.log('Imported ' + order_history.length + ' orders');
            var pnl = await this.get({user: user, stub: stub, symbol: symbol, days: 7})
            if (pnl.hasOwnProperty(symbol)) {
                var groups = pnl[symbol].groups;
                if (Array.isArray(groups)) {
                    var latest = groups.sort((a, b) => a.end > b.end ? -1 : 1)[0];
                    if (latest.pnl != undefined) {
                        var pnl = Math.round(latest.pnl * 100) / 100
                        if (pnl >= 0) {
                            this.mod.output.notice('order_close_profit',[symbol, pnl]);
                        } else {
                            this.mod.output.notice('order_close_loss',[symbol, pnl]);                            
                        }
                    }
                }
            }
        }
    }



    // Get order history for a given user uuid, stub, symbol and days


    async order_history(user, stub, symbol, days = 7) {

        var ms = 1000 * 60 * 60 * 24 * days
        var ts = Date.now() - ms;
        var all_orders = {};
        var order_params = { 
            stub: stub,
            since: ts
        }
        if (!['<ALL>',undefined].includes(symbol)) order_params['symbol'] = symbol;

        var orders =  await this.mod.exchange.execute([user, stub], 'all_orders', order_params);

        while (orders.length > 0) {

            orders = orders.sort((a, b) => a.timestamp < b.timestamp ? -1 : 1)
            var batch_ts = {
                standard: 0,
                conditional: 0
            }

            for (var i = 0; i < orders.length; i++) {

                var order = orders[i];
                if (!all_orders.hasOwnProperty(order.id)) {
                    all_orders[order.id] = order;
                }

                if (['market','limit'].includes(order.type)) {
                    if (order.timestamp > batch_ts.standard) {
                        batch_ts.standard = order.timestamp;
                    } 
                } else {
                    if (order.timestamp > batch_ts.conditional) {
                        batch_ts.conditional = order.timestamp;
                    } 
                }

            }

            if (batch_ts.standard == 0) batch_ts.standard = batch_ts.conditional;
            if (batch_ts.conditional == 0) batch_ts.conditional = batch_ts.standard;

            var mints = Math.min(batch_ts.standard, batch_ts.conditional);
            if (mints == 0) break;

            if (order_params.since == mints + 1) break;
            order_params.since = mints + 1;
            orders = await this.mod.exchange.execute([user, stub], 'all_orders', order_params);
        }

        return Object.values(all_orders);

    }


    // Update order in the database

    async update_order(user, stub, order) {
        order.uuid = user
        order.stub = stub
        order.orderid = order.id
        order.order_price = order.price
        order.trigger_price = order.trigger

        delete order.id
        delete order.user
        delete order.price
        delete order.trigger
        delete order.filled
        delete order.datetime

        var existing = await this.database.select('orders', {uuid: user, stub: stub, orderid: order.id});
        if (Array.isArray(existing && existing.length == 1)) {                                
            order = {...existing, ...order};
        }
    
        if (!order.hasOwnProperty('size_usd')) order['size_usd'] = 0
        if (!order.hasOwnProperty('size_usd')) order['size_usd'] = 0
        if (!order.hasOwnProperty('filled_usd')) order['filled_usd'] = 0

        await this.database.insertOrReplace('orders', order);
    }


    // Generate PNL report data from order history in database

    
    async get(params) {

        var schema = {
            stub:        { required: 'string', format: 'lowercase', },
            user:        { optional: 'string', format: 'lowercase', },
            symbol:      { optional: 'string', format: 'uppercase', },
            days:        { required: 'number' },
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [user, stub, symbol, days] = this.mod.utils.extract_props(params, ['user', 'stub', 'symbol', 'days']);
        
        if (user == undefined) { user = context.get('uuid') }
    
//        var position = await this.exchange_execute(stub, 'position',params);
        
        //var orders =  await this.exchange_execute(stub, 'orders',params);
        
        var query =  {uuid: user, stub: stub};

        if (symbol != undefined) query['symbol'] = symbol;
        
        var ms = 1000 * 60 * 60 * 24 * days
        var ts = Date.now() - ms;

        var vals = [
            user,
            stub,
            ts
        ];
        var sql = "SELECT * FROM `orders` WHERE uuid=? AND stub=? AND timestamp>=?";
        if (symbol != undefined) {
            sql += " AND `symbol`=?";
            vals.push(symbol)
        }

        var orders = await this.database.query(sql, vals);

        var orders_by_symbol = {};

        if (Array.isArray(orders) && orders.length > 0) {
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                delete order.metadata;
                if (!orders_by_symbol.hasOwnProperty(order.symbol)) orders_by_symbol[order.symbol] = [];
                orders_by_symbol[order.symbol].push(order);
            }    
        } else {
            return {};
        }

        var symbols = Object.keys(orders_by_symbol);
        var pnl_by_symbol = {}

        symbols.forEach(symbol => {

            var orders = orders_by_symbol[symbol].sort((a, b) => a.timestamp > b.timestamp ? -1 : 1).filter(order => order.filled_base > 0)

            // Check if currently in a position, if so use the position balance for unrealized PNL calc
            //var bal_base = this.mod.utils.is_object(position) && position.hasOwnProperty('base_size') ? position.base_size : 0;
            //var bal_quote = this.mod.utils.is_object(position) && position.hasOwnProperty('quote_size') ? position.quote_size : 0;
        
            var bal_base = 0;
            var bal_quote = 0;

            // Cycle backwards through orders and reconstruct balance and group orders for the same position together
            var groups = [];
            var current = [];
     
            for(var n = 0; n < orders.length; n++) {
                var order = orders[n];
                var entry = order;
                delete entry.trigger;
                delete entry.status;
                entry.balance_base = bal_base;
                entry.balance_quote = bal_base * order.order_price,
                current.push(entry);
                bal_base = (order.direction == 'sell' ? bal_base + order.filled_base : bal_base - order.filled_base);
                bal_quote = (order.direction == 'sell' ? bal_quote + order.filled_quote : bal_quote - order.filled_quote);
                if (bal_base == 0) {
                    var start = order.timestamp;
                    var end = [undefined, start].includes(current[0]) || current.length < 2 ? null : current[0].timestamp;
                    var group = {
                        start: start,
                        end: end,
                        pnl: bal_quote,
                        orders: current.sort((a, b) => a.timestamp < b.timestamp ? -1 : 1)
                    }
                    groups.push(group);
                    current = [];
                    bal_quote = 0
                }
            }
    
            // Sort order groups cronologically
            groups.sort((a, b) => a.start < b.start ? -1 : 1)
    
            pnl_by_symbol[symbol] = new this.classes.pnl(stub, symbol, groups); 


        });

        return pnl_by_symbol;

    }

    // PNL Per Day

    async pnl_per_day(user, stub, days) {

        var pnl = await this.get({user: user, stub: stub, days: days});
        var totals = {};
        var symbols = Object.keys(pnl);

        for (var i = 0; i < symbols.length; i++) {

            var symbol = symbols[i];

            var groups = pnl[symbol].hasOwnProperty('groups') ? pnl[symbol].groups.sort((a, b) => a.end < b.end ? -1 : 1) : []
            for (var j = 0; j < groups.length; j++) {
                var group = groups[j];
                var date = Math.floor(group.end / 86400000) * 86400000;  // Round to date

                if (totals[date] == undefined) totals[date] = 0
                totals[date] += parseFloat(group.pnl);
            }

        }

        var result = [];
        
        for (const [ts, total] of Object.entries(totals)) {
            var row = {
                Date: new Date(parseInt(ts)).toJSON(),
                Daily: total,
            };
            result.push(row);
        }
        var sorted = result.filter(result =>  result.total != 0).sort((a, b) => a.Date < b.Date ? -1 : 1)
        for (var i = 0; i < sorted.length; i++) {
            var today = sorted[i].Daily != undefined ? sorted[i].Daily : 0;
            var yesterday = i != 0 ? sorted[i-1].Total : 0;
            sorted[i].Total = today + yesterday
        }
        /*
        if (days > 90) days = 90
        var ts = (Math.floor((new Date()).getTime() / 86400000) * 86400000) - (days * 86400000)
        var testdata = [];
        var total = 0;
        for (i = 0; i < days; i++) {
            var daily = (Math.random() * 20) - 5;
            total += daily;
            testdata.push({
                Date: (new Date(ts + (i * 86400000))).toJSON(),
                Daily: daily,
                Total: total
            })
        }
        console.log(testdata)
        return testdata;
        */
        return sorted;
    }

    // PNL Per Trade

    async pnl_per_trade(user, stub, days) {

        var pnl = await this.get({user: user, stub: stub, days: days});
        var trades = [];
        var symbols = Object.keys(pnl);

        for (var i = 0; i < symbols.length; i++) {

            var symbol = symbols[i];

            var groups = pnl[symbol].hasOwnProperty('groups') ? pnl[symbol].groups.sort((a, b) => a.end < b.end ? -1 : 1) : []
            for (var j = 0; j < groups.length; j++) {
                var group = groups[j];
                var orders = group.orders;
                var orders_sorted = orders.sort((a, b) => a.timestamp < b.timestamp ? -1 : 1)
                if (orders.length > 1) {
                    var trade = {
                        symbol: symbol,
                        direction: orders_sorted[0].direction == "buy" ? "long" : "short",
                        entered: new Date(group.start).toJSON(),
                        exited: new Date(group.end).toJSON(),
                        dcas: group.orders.length - 1,
                        initial_size: orders_sorted[0].size_base,
                        exit_size: (orders.sort((a, b) => a.timestamp > b.timestamp ? -1 : 1))[0].size_base,
                        pnl: group.pnl
                    }
                }
                trades.push(trade)
            }

        }

        var sorted = trades.sort((a, b) => a.entered > b.entered ? -1 : 1)
        return sorted;
    }

    // PNL By Pair Total

    async pnl_by_pair_total(user, stub, days) {

        var pnl = await this.get({user: user, stub: stub, days: days});
        var totals = {};
        var symbols = Object.keys(pnl);

        //console.log(symbols)

        for (var i = 0; i < symbols.length; i++) {

            var symbol = symbols[i];
            var total = 0;

            var groups = pnl[symbol].hasOwnProperty('groups') ? pnl[symbol].groups.sort((a, b) => a.end < b.end ? -1 : 1) : []
            for (var j = 0; j < groups.length; j++) {
                var group = groups[j];
                total += parseFloat(group.pnl);
            }

            totals[symbol] = total;

        }

        var result = [];

        for (const [symbol, total] of Object.entries(totals)) {
            var row = {
                Symbol: symbol,
                Total: total
            };
            result.push(row);
        }

        var sorted = result.filter(result =>  result.Total != 0).sort((a, b) => a.Total > b.Total ? -1 : 1)
        return sorted;
    }

    // PNL By Pair Over Time

    async pnl_by_pair_overtime(user, stub, days) {

        var pnl = await this.get({user: user, stub: stub, days: days});
        var totals = {};
        var symbols = Object.keys(pnl);

        for (var i = 0; i < symbols.length; i++) {

            var symbol = symbols[i];
            var total = 0;

            var groups = pnl[symbol].hasOwnProperty('groups') ? pnl[symbol].groups.sort((a, b) => a.end < b.end ? -1 : 1) : []
            for (var j = 0; j < groups.length; j++) {
                var group = groups[j];
                var date = Math.floor(group.end / 86400000) * 86400000;  // Round to date
                total += parseFloat(group.pnl);
                if (totals[date] == undefined) totals[date] = {}
                totals[date][symbol] = total;
            }

        }

        var result = [];
        
        for (const [ts, pnl] of Object.entries(totals)) {
            var row = {Date: new Date(parseInt(ts)).toJSON() };
            row = {...row, ...pnl}

            result.push(row);
        }

        var sorted = result.filter(result =>  result.total != 0).sort((a, b) => a.Date < b.Date ? -1 : 1)
        return {symbols: symbols, data: sorted};
    }




}