// PNL calculation module

const frostybot_module = require('./mod.base')
const frostybot_pnl = require('../classes/classes.pnl')
var context = require('express-http-context')
const axios = require('axios')
const { utils } = require('mocha')

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
            'pnl:cron': {
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
            'pnl:cron': [],
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

    // PNL Cron

    async cron() {

        var results = await this.database.select("pnl_cron");
        var url = await global.frostybot.modules['core'].url();
        this.mod.output.debug('loopback_url', [url]);
        var j = 0;
        for (var i = 0; i < results.length; i++) {
            var row = results[i];
            var user = row.user;
            var stub = row.stub;
            var symbol = String(row.symbol).toUpperCase();
            if (stub != '') {
                j++
                var cmd = {
                    command     : 'pnl:quick_import',
                    user        : user,
                    stub        : stub,
                    symbol      : symbol
                }
                
                // Create new request for the PNL Import
                
                axios.post(url + '/frostybot',  cmd);
            
                if (j == 5) {
                    await this.mod.utils.sleep(5);
                    j = 0;
                } else {
                    await this.mod.utils.sleep(1);
                }
                
            }
        }
    }

    // Quick import import specific symbol for a user when a close command is executed

    async quick_import(params) {
        if (params.user == undefined) params['user'] = params['uuid'] != undefined ? params.uuid : context.get('uuid');
        var schema = {
            user:        { required: 'string', format: 'lowercase', },
            stub:        { required: 'string', format: 'lowercase', },
            symbol:      { optional: 'string', format: 'uppercase', },
            days:        { optional: 'number' },
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [user, stub, symbol, days] = this.mod.utils.extract_props(params, ['user', 'stub', 'symbol', 'days']);

        if (days == undefined) days = 7

        var exchange = await this.mod.exchange.get_exchange_from_stub([user, stub])
        
        if (symbol != undefined) {
            var market = await this.mod.exchange.findmarket(exchange, symbol);
            if (market != false) symbol = market.id;
        }

        var order_history = await this.order_history(user, stub, symbol, days);
        if (Array.isArray(order_history)) {
            order_history.forEach(async(order) => {
                await this.update_order(user, stub, order);
            });
            return this.mod.output.success('custom_message', ['PNL imported successfully (' + order_history.length + ' orders)'])
        }
        return this.mod.output.error('custom_message', ['PNL import failed'])
    }


    // Round a timestmap to the start of the day

    startofday(ts) {
        
        var mspd = 1000 * 60 * 60 * 24   // Milliseconds per day
        return Math.floor(ts / mspd) * mspd
        
    }

    // Get order history for a given user uuid, stub, symbol and days


    async order_history(user, stub, symbol = undefined, days = 7) {

        var batchdays =  7              // Days per batch
        var mspd = 1000 * 60 * 60 * 24  // Milliseconds per day
        var mspb = batchdays * mspd     // Milliseconds per batch
        var batches = Math.ceil(days / batchdays)
        var ms = mspd * days
        var startts = this.startofday(Date.now() - ms)
        var all_orders = {}
        var order_params = { 
            stub: stub,
            since: startts
        }
        if (!['<ALL>',undefined,false,''].includes(symbol)) order_params['symbol'] = symbol;

//        var orders =  await this.mod.exchange.execute([user, stub], 'all_orders', order_params);

        for (var batch = 0; batch < batches; batch++) {

            var start = new Date(this.startofday(startts + (batch * mspb) + mspd));
            var end = new Date(this.startofday(startts + (batch * mspb) + mspb));
            var today = new Date(this.startofday(Date.now() + mspd));

            if (start >= today) break
            order_params.since = start.getTime();            
            var orders =  await this.mod.exchange.all_orders([user, stub], symbol, order_params.since);
            if (!Array.isArray(orders)) orders = [];
            var outobj = {
                symbol: symbol,
                start: (start.toJSON()).split('T')[0],
                end: (end.toJSON()).split('T')[0],
                orders: String(orders.length)
            }
            this.mod.output.debug('custom_object', ['PNL Import Batch', outobj])
            //var orders = await this.mod.exchange.execute([user, stub], 'order_history', {symbol: symbol, since: order_params.since})
            if (Array.isArray(orders) && orders.length > 0) {
                orders = orders.sort((a, b) => a.timestamp < b.timestamp ? -1 : 1)
                for (var i = 0; i < orders.length; i++) {
                    var order = orders[i];
                    if (!all_orders.hasOwnProperty(order.id)) {
                        all_orders[order.id] = order;
                    }
                }
            }
            await this.mod.utils.sleep(1)


            //while (orders.length > 0) {
            
            /*
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
            orders =  await this.mod.exchange.orders([user, stub], symbol, order_params.since);
            */
        }

        return Object.values(all_orders);

    }


    // Update order in the database

    async update_order(user, stub, order) {
        order.uuid = user
        order.stub = stub
        order.orderid = order.id
        order.order_price = order.price == null ? 0 : order.price;
        order.trigger_price = order.trigger;

        delete order.id
        delete order.user
        delete order.price
        delete order.trigger
        delete order.filled
        delete order.datetime
        if (order.direction != null) {
            order.metadata = {
                direction: order.direction
            }
        }
        order.direction = order.side
        delete order.side

        var existing = await this.database.select('orders', {uuid: user, stub: stub, orderid: order.id});
        if (Array.isArray(existing && existing.length == 1)) {                                
            order = {...existing, ...order};
        }
    
        if (!order.hasOwnProperty('size_usd')) order['size_usd'] = 0
        if (!order.hasOwnProperty('size_usd')) order['size_usd'] = 0
        if (!order.hasOwnProperty('filled_usd')) order['filled_usd'] = 0

        await this.database.insertOrReplace('orders', order);
    }

    // Round a number to a given precision

    round_num(num, precision) {
        return (Math.round(num / precision) * precision).toFixed(this.mod.utils.num_decimals(precision));
    }

    // Round an order amount to the supported market precision

    round_amount(market, amount) {
        return parseFloat(this.round_num(amount, market.precision.amount));
    }    

    // Find trade cycles in a batch of orders

    async findgroups(orders, bal_base, bal_quote) {
        // Cycle backwards through orders and reconstruct balance and group orders for the same position together
        var groups = [];
        var current = [];
        var ungrouped = [];

        if (orders.length > 0) {
            var market = await this.mod.exchange.findmarket(orders[0].exchange, orders[0].symbol)
        }

        for(var n = 0; n < orders.length; n++) {
            var order = orders[n];
            order.datetime = (new Date(order.timestamp)).toJSON()
            var entry = order;
            delete entry.trigger;
            delete entry.status;
            entry.balance_base = bal_base;
            entry.balance_quote = bal_base * order.order_price;
            current.push(entry);
            var filled = this.round_amount(market, order.filled_base);
            bal_base = this.round_amount(market, (order.side == 'sell' ? bal_base + filled : bal_base - filled));
            bal_quote = (order.side == 'sell' ? bal_quote + order.filled_quote : bal_quote - order.filled_quote);

            if (bal_base == 0) {
                var asc   = [...current].sort((a, b) => a.timestamp < b.timestamp ? -1 : 1);
                var desc  = [...current].sort((a, b) => a.timestamp > b.timestamp ? -1 : 1);
                var buys  = current.filter((ord) => ord.side == "buy")
                var sells = current.filter((ord) => ord.side == "sell")
                var entry_base = this.round_amount(market, this.mod.utils.sum_prop(direction == "long" ? buys : sells, "filled_base"))
                var exit_base = this.round_amount(market, this.mod.utils.sum_prop(direction == "long" ? sells : buys, "filled_base"))
                if (entry_base == exit_base) {
                    var first = asc[0]
                    var last = desc[0]
                    var direction = first.side == "buy" ? "long" : "short"
                    var start = first.timestamp
                    var end = last.timestamp
                    var entry_value = this.mod.utils.sum_prop(direction == "long" ? buys : sells, "filled_quote")
                    var exit_value = this.mod.utils.sum_prop(direction == "long" ? sells : buys, "filled_quote")
                    var pnl = exit_value - entry_value
                    var group = {
                        start: start,
                        end: end,
                        pnl: pnl,
                        direction: direction,
                        dcas: (direction == "long" ? buys : sells).length - 1,
                        entry_base: entry_base,
                        exit_base: exit_base,
                        entry_value: entry_value,
                        exit_value: exit_value,
                        orders: asc
                    }                
                    groups.push(group);
                } else {
                    ungrouped = [...ungrouped, ...current];
                }
                current = [];
                bal_quote = 0
            }
        }
        return groups;
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
           
        var query =  {uuid: user, stub: stub};

        if (symbol != undefined) {
            var exchange = await this.mod.exchange.get_exchange_from_stub([user, stub])
            var market = await this.mod.exchange.findmarket(exchange, symbol);
            if (market != false) symbol = market.id;
            query['symbol'] = symbol;
        }
        
        var ms = 1000 * 60 * 60 * 24 * days
        var ts = Math.ceil((Date.now() - ms)  / 86400000) * 86400000 ;

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
        sql += " ORDER BY timestamp DESC;"

        var orders = await this.database.query(sql, vals);

        var orders_by_symbol = {};

        if (Array.isArray(orders) && orders.length > 0) {
            for (var i = 0; i < orders.length; i++) {
                var order = orders[i];
                var dir = 'both';
                if (!['', null].includes(order.metadata)) {
                    var metadata = JSON.parse(order.metadata);
                    if (metadata != undefined) {
                        dir = metadata.direction != undefined ? metadata.direction : 'both'
                        order.side = order.direction;
                        order.direction = dir;
                    }
                } else {
                    order.side = order.direction
                    order.direction = 'both'
                }
                delete order.metadata;
                if (!orders_by_symbol.hasOwnProperty(order.symbol)) orders_by_symbol[order.symbol] = {};
                if (!orders_by_symbol[order.symbol].hasOwnProperty(dir)) orders_by_symbol[order.symbol][dir] = [];
                orders_by_symbol[order.symbol][dir].push(order);
            }    
        } else {
            return {};
        }

        var symbols = Object.keys(orders_by_symbol);
        var pnl_by_symbol = {}
        var directions = ['long', 'short', 'both'];

        for (var s = 0; s < symbols.length; s++) {

            var symbol = symbols[s];
            var symbol_groups = [];

            for (var d = 0; d < directions.length; d++) {

                var dir = directions[d];
                var qty = this.mod.utils.is_array(orders_by_symbol[symbol][dir]) ? orders_by_symbol[symbol][dir].length : 0;

                if (qty >= 2) {

                    var orders = orders_by_symbol[symbol][dir].sort((a, b) => a.timestamp > b.timestamp ? -1 : 1).filter(order => order.filled_base > 0)

                    // Check if currently in a position, if so use the position balance for unrealized PNL calc
                    var position = await this.mod.exchange.positions([user,stub], symbol, (dir == 'both' ? undefined : dir));

                    var bal_base = position.length == 1 ? position[0].base_size : 0;
                    var bal_quote = position.length == 1 ? position[0].quote_size : 0;

                    // Find trade cycles
                    var groups = await this.findgroups(orders, bal_base, bal_quote);
                    
                    if (orders.length >= 3) {
                        var groups2 = await this.findgroups(orders.slice(1), 0, 0);
                        var groups3 = await this.findgroups(orders.slice(2), 0, 0);
                        var groups4 = await this.findgroups(orders.slice(3), 0, 0);
                        if (groups2.length > groups.length) {
                            var groups = groups2
                        }
                        if (groups3.length > groups.length) {
                            var groups = groups3
                        }
                        if (groups4.length > groups.length) {
                            var groups = groups4
                        }
                    }
    
                    for (var g = 0; g < groups.length; g++) {
                        symbol_groups.push(groups[g]);
                    }
                }

            }

            symbol_groups = symbol_groups.sort((a, b) => a.end < b.end ? -1 : 1)
            pnl_by_symbol[symbol] = new frostybot_pnl(stub, symbol, symbol_groups);

        }
        return pnl_by_symbol;

    }


    // PNL Per Day

    async pnl_per_day(user, stub, days) {

        var pnl = await this.get({user: user, stub: stub, days: (days + 30)});
        var totals = {};
        var symbols = Object.keys(pnl);
        var mspd = 1000 * 60 * 60 * 24
        var start = this.startofday(Date.now() - (mspd * days)) + mspd

        for (var i = 0; i < symbols.length; i++) {

            var symbol = symbols[i];

            var groups = pnl[symbol].hasOwnProperty('groups') ? pnl[symbol].groups.sort((a, b) => a.end < b.end ? -1 : 1) : []
            for (var j = 0; j < groups.length; j++) {
                var group = groups[j];
                var date = this.startofday(group.end); 
                if (totals[date] == undefined) totals[date] = 0
                if (date >= start) totals[date] += parseFloat(group.pnl);
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

        return sorted.sort((a,b) => a.Date > b.Date ? -1 : 1).slice(0,days);
    }

    // PNL Per Trade

    async pnl_per_trade(user, stub, days) {

        var pnl = await this.get({user: user, stub: stub, days: days + 30});
        var trades = [];
        var symbols = Object.keys(pnl);
        var mspd = 1000 * 60 * 60 * 24
        var start = this.startofday(Date.now() - (mspd * days)) + mspd

        for (var i = 0; i < symbols.length; i++) {

            var symbol = symbols[i];

            var groups = pnl[symbol].hasOwnProperty('groups') ? pnl[symbol].groups.sort((a, b) => a.end < b.end ? -1 : 1) : []
            for (var j = 0; j < groups.length; j++) {
                var group = groups[j];
                var orders = group.orders;
                if (orders.length > 1) {
                    var trade = {
                        symbol: symbol,
                        direction: group.direction,
                        entered: new Date(group.start).toJSON(),
                        exited: new Date(group.end).toJSON(),
                        dcas: group.dcas,
                        entry_value: group.entry_value,
                        exit_value: group.exit_value,
                        pnl: group.pnl
                    }
                    if (group.end >= start) trades.push(trade)
                }
            }

        }

        var sorted = trades.sort((a, b) => a.exited > b.exited ? -1 : 1)
        return sorted;
    }

    // PNL By Pair Total

    async pnl_by_pair_total(user, stub, days) {

        var pnl = await this.get({user: user, stub: stub, days: (days + 30) });
        var totals = {};
        var symbols = Object.keys(pnl);
        var mspd = 1000 * 60 * 60 * 24
        var start = this.startofday(Date.now() - (mspd * days)) + mspd

        for (var i = 0; i < symbols.length; i++) {

            var symbol = symbols[i];
            var total = 0;

            var groups = pnl[symbol].hasOwnProperty('groups') ? pnl[symbol].groups.sort((a, b) => a.end < b.end ? -1 : 1) : []
            for (var j = 0; j < groups.length; j++) {
                var group = groups[j];
                if (group.end >= start) total += parseFloat(group.pnl);
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

        var pnl = await this.get({user: user, stub: stub, days: (days + 30)});
        var totals = {};
        var symbols = Object.keys(pnl);
        var mspd = 1000 * 60 * 60 * 24
        var start = this.startofday(Date.now() - (mspd * days)) + mspd

        for (var i = 0; i < symbols.length; i++) {

            var symbol = symbols[i];
            var total = 0;

            var groups = pnl[symbol].hasOwnProperty('groups') ? pnl[symbol].groups.sort((a, b) => a.end < b.end ? -1 : 1) : []
            for (var j = 0; j < groups.length; j++) {
                var group = groups[j];
                var date = this.startofday(group.end);  // Round to date
                total += parseFloat(group.pnl);
                if (date >= start) {
                    if (totals[date] == undefined) totals[date] = {}
                    totals[date][symbol] = total;
                }
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