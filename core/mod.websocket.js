// Websocket handler module


const frostybot_module = require('./mod.base');


const RESPONSE_CODES = {
    'success'   :   {
                        200:    'Ok',
                        201:    'PONG',
                        202:    'Successfully authenticated',
                        203:    'Successfully subscribed to channel',
                        204:    'Channel data',
                        205:    'Response data',
    },
    'error'     :   {
                        900:    'Unknown op code',
                        901:    'Authentication required',
                        902:    'Authentication failed',
    }
                    
}

module.exports = class frostybot_websocket_module extends frostybot_module {

    // Constructor

    constructor() {
        super()
        this.description = 'Websocket Handler'
        this.websockets = {}
        global.frostybot.tickers = {}

        this.stats = {}
    }

    // Initialize Module

    async initialize() {

        var _this = this;
        var exchanges = ['binance_futures'];
        //var exchanges = [];

        for (var i = 0; i < exchanges.length; i++) {
            var exchange = exchanges[i];
            global.frostybot.tickers[exchange] = {}

            this.websockets[exchange] = require('../exchanges/websocket.' + exchange.replace('_','.'));
            await this.startfeed(exchange);

            this.websockets[exchange].on('ticker', function(e) {
                if (_this.mod.redis.is_connected()) {
                    _this.mod.redis.set(['ticker', e.exchange, e.data.symbol].join(':'), {
                        symbol: e.data.symbol,
                        bid: e.data.bid,
                        ask: e.data.ask
                    }, 60);
                } else {
                    global.frostybot.tickers[e.exchange][e.data.symbol] = {
                        symbol: e.data.symbol,
                        bid: e.data.bid,
                        ask: e.data.ask
                    }    
                }
            })

            this.websockets[exchange].on('stats', function(e) {
                _this.stats[e.exchange] = e.data;
            })

            this.websockets[exchange].on('log', function(e) {
                var type = String(e.data.type).toLowerCase();
                var exchange= e.exchange
                var message = e.data.message;
                if (['debug', 'notice', 'success', 'warning', 'error'].includes(type)) {
                    _this.mod.output[type]('websocket_message', [exchange, message]);
                }
            })
            
        }

        /*
        var _this = this
        setInterval(async function() {
            var uuids = _this.all_subscribed('gui');
            for (var i = 0; i < uuids.length; i++) {
                var uuid = uuids[i];
                var uuidstubs = await _this.mod.accounts.uuids_and_stubs({user: uuid})
                var stubs = uuidstubs.hasOwnProperty(uuid) ? uuidstubs[uuid] : [];
                for (var i = 0; i < stubs.length; i++) {
                    var stub = stubs[i].stub
                    //var positions = await _this.mod.exchange.positions([uuid, stub])
                    //_this.gui(uuid, 'positions', positions)
                    var balances = await _this.mod.exchange.balances([uuid, stub])
                    _this.gui(uuid, 'balances', balances)

                }
                stubs.forEach(async (stub) => {
                })
            }
        }, 2000)*/
    
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
            'websocket:status':       [],            // Get status of websocket connections
            'websocket:startfeed':    [],            // Start websocket feed on this node for an exchange
            'websocket:stopfeed':     [],            // Stop websocket feed on this node for an exchange
            'websocket:enablefeed':   [],            // Enable websocket feed on this node for one or more exchanges
            'websocket:disablefeed':  [],            // Disable websocket feed on this node for one or more exchanges
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions); // Defined in mod.base.js
        }
        
    }

    // Start websocket exchange feed on this node for an exchange

    async startfeed(exchange) {
        var enabled = await this.is_enabled(exchange);
        if (enabled) {
            this.websockets[exchange].start();
            return this.mod.output.success('websocket_started', [exchange]);
        } else {
            this.mod.output.warning('websocket_disabled', [exchange]);
            return false;
        }
    }

    // Stop websocket exchange feed on this node for an exchange

    async stopfeed(exchange) {
        this.websockets[exchange].stop();
        return this.mod.output.success('websocket_stopped', [exchange]);
    }

    // Enable websocket exchange feed on this node for one or more exchanges

    async enablefeed(params) {
        var schema = {
            exchange: { optional: 'string', format: 'lowercase', }
        }
        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        const os = require('os')
        var nodename = os.hostname().toLowerCase();

        var exchange = params.exchange
        if (exchange == undefined) {
            var exchanges = Object.keys(this.websockets);
            exchanges.forEach(async (exchange) => {
                var subkey = ['disabled', nodename, exchange].join(':');
                await this.mod.settings.set('websocket', subkey, false);
                this.mod.output.success('websocket_enabled', [exchange]);
                await this.startfeed(exchange);        
            });
        } else {
            var subkey = ['disabled', nodename, exchange].join(':');
            await this.mod.settings.set('websocket', subkey, false);
            this.mod.output.success('websocket_enabled', [exchange]);
            await this.startfeed(exchange);        
        }
    }

    // Disable websocket exchange feed on this node for one or more exchanges

    async disablefeed(params) {
        var schema = {
            exchange: { optional: 'string', format: 'lowercase', }
        }
        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        const os = require('os')
        var nodename = os.hostname().toLowerCase();

        var exchange = params.exchange
        if (exchange == undefined) {
            var exchanges = Object.keys(this.websockets);
            exchanges.forEach(async (exchange) => {
                var subkey = ['disabled', nodename, exchange].join(':');
                await this.mod.settings.set('websocket', subkey, true);
                this.mod.output.success('websocket_disabled', [exchange]);
                await this.stopfeed(exchange);        
            });
        } else {
            var subkey = ['disabled', nodename, exchange].join(':');
            await this.mod.settings.set('websocket', subkey, true);
            this.mod.output.success('websocket_disabled', [exchange]);
            await this.stopfeed(exchange);        
        }
    }

    // Check if exchange websocket feed is enabled on this node

    async is_enabled(exchange) {
        const os = require('os')
        var nodename = os.hostname().toLowerCase();
        var subkey = ['disabled', nodename, exchange].join(':');
        var result = await this.mod.settings.get('websocket', subkey, false);
        return result == false ? true : false;
    }

    // Get status of websocket clients

    async status() {

        return this.stats;

    }

    // Create an error response object

    error(code, message = undefined, data = undefined) {
        return {
            response: "error",
            code: code,
            message: message == undefined ? RESPONSE_CODES.error[code] : undefined,
            data: data
        };
    }

    // Create a success response object

    success(code, message = undefined, data = undefined) {
        return {
            response: "success",
            code: code,
            message: message == undefined ? RESPONSE_CODES.success[code] : undefined,
            data: data
        };
    }

    // Send GUI content

    gui(uuid, type, data) {
        //if (this.is_subscribed(uuid, 'gui')) {
            this.send_authenticated(uuid, {
                code: 204,
                channel: "gui",
                timestamp: (new Date()).toJSON(),
                type: type,
                data: data,
            });
        //}
        //return true;
    }

    // Send immediate reponse to a websocket request

    respond(type, data) {
        return {
            code: 204,
            channel: "gui",
            timestamp: (new Date()).toJSON(),
            type: type,
            data: data,
        }
    }

    // Send message to authenticated socket

    send_authenticated(uuid, message) {
        var socketuuid = this.get_socketuuid(uuid);
        for( const client of global.frostybot.wss.clients) {
            if (client.id == socketuuid) {
                client.send(JSON.stringify(message));
                return true;
            }
        }
        return false;
    }

    // Get socket UUID for an authenticated user

    get_socketuuid(uuid) {
        if (![null, undefined].includes(global.frostybot.wssidx)) {
            for (const [socketuuid, user] of Object.entries(global.frostybot.wssidx)) {
                if (user == uuid) return socketuuid;
            }
        }
        return false;
    }

    // Handle incoming websocket message

    async handle(socketuuid, message) {
        //this.mod.output.debug('custom_message', ['Message on websocket from Socket UUID: ' + socketuuid])
        //this.mod.output.debug('custom_object', ['Messsage',message] )
        var op = message.op.toLowerCase();
        if (op == 'auth') {
            return await this.authenticate(socketuuid, message.token);
        } else {
            var token = this.is_authenticated(socketuuid);
            if (token !== false)
                message['token'] = token;
        }
        var method = 'handle_' + op;
        if (typeof(this[method]) == 'function') {
            return await this[method](message);
        } else {
            return this.error(900);
        }
    }

    // Handle ping

    async handle_ping() {
        return this.success(201);
    }

    // Handle auth

    async authenticate(socketuuid, token) {
        var verify = await this.mod.user.verify_token(token);
        if (verify !== false) {
            if (global.frostybot.wsauth == undefined) global.frostybot['wsauth'] = {};
            global.frostybot.wsauth[socketuuid] = token;
            this.subscribe(token.uuid, 'gui')
            return this.success(202);
        } else {
            return this.error(902);
        }
    }

    // Check if socket is authenticated

    is_authenticated(socketuuid) {
        if (global.frostybot.wsauth != undefined) {
            if (global.frostybot.wsauth[socketuuid] != undefined) {
                return global.frostybot.wsauth[socketuuid];
            }
        }
        return false
    }

    // Subscribe uuid to channel

    subscribe(uuid, channel) {
        if (global.frostybot.wssubs == undefined) global.frostybot['wssubs'] = {};
        if (global.frostybot.wssubs[uuid] == undefined) global.frostybot.wssubs[uuid] = [];
        if (!global.frostybot.wssubs[uuid].includes(channel)) {
            global.frostybot.wssubs[uuid].push(channel);
        }
        return true;
    }

    // Unsubscribe uuid from channel

    unsubscribe(uuid, channel) {
        channel = channel.toLowerCase()
        if (global.frostybot.wssubs != undefined)
            if (global.frostybot.wssubs[uuid] != undefined) 
                if (global.frostybot.wssubs[uuid] != undefined)
                    if (global.frostybot.wssubs[uuid].includes(channel))
                        global.frostybot.wssubs[uuid] = global.frostybot.wssubs[uuid].filter(channels => channels != channel)
        return true;
    }

    // Handle subscribe

    async handle_subscribe(message) {
        const token = message.token;
        const channel = message.channel.toLowerCase();
        var verify = await this.mod.user.verify_token(token);
        if (verify !== false) {
            var uuid = token.uuid;
            this.subscribe(uuid, channel)
            return this.success(203, undefined, channel);
        } else {
            return this.error(902);
        }
    }

    // Get account positions

    async handle_positions(message) {
        const token = message.token;
        if (token !== undefined) {
            const uuid = token.uuid;
            this.mod.output.debug('custom_message','Request for websocket position data received for user: ' + uuid)
            var rawpositions = await this.mod.datasource.select('exchange:positions', {user: uuid});
            var positions = [];
            for (const position of Object.values(rawpositions)) {
                position.update()
                positions.push(position);
            }
            return this.respond('positions',positions);
        }
        this.error(901)
    }

    // Get account balances

    async handle_balances(message) {
        const token = message.token;
        if (token !== undefined) {
            const uuid = token.uuid;
            this.mod.output.debug('custom_message','Request for websocket balance data received for user: ' + uuid)
            var rawbalances = await this.mod.datasource.select('exchange:balances', {user: uuid});
            var balances = [];
            for (const balance of Object.values(rawbalances)) {
                if (balance.base != undefined && balance.usd != undefined) {
                    balance.update()
                    balance['base_free'] = balance.base.free;
                    balance['base_used'] = balance.base.used;
                    balance['base_total'] = balance.base.total;
                    balance['usd_free'] = balance.usd.free;
                    balance['usd_used'] = balance.usd.used;
                    balance['usd_total'] = balance.usd.total;
                    delete balance.base
                    delete balance.usd
                    balances.push(balance);
                }
            }
            return this.respond('balances',balances);
        }
        this.error(901)
    }

    // Check if user is subscribed to channel

    is_subscribed(uuid, channel) {
        if (global.frostybot.wssubs !== undefined && global.frostybot.wssubs[uuid] !== undefined && global.frostybot.wssubs[uuid].includes(channel)) {
            return true
        }
        return false;
    }

    // Get all UUIDs subscribed to a channel

    all_subscribed(channel) {
        var uuids = [];
        if (global.frostybot.wssubs !== undefined) {
            for (const [uuid, subscriptions] of Object.entries(global.frostybot.wssubs)) {
                if (subscriptions.includes(channel.toLowerCase())) {
                    uuids.push(uuid);
                }
            }
        }
        return uuids;
    }

}
