// Websocket handler module

const frostybot_module = require('./mod.base');

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
        var exchanges = ['ftx', 'binance_spot', 'binance_futures'];

        for (var i = 0; i < exchanges.length; i++) {
            var exchange = exchanges[i];
            global.frostybot.tickers[exchange] = {}

            this.websockets[exchange] = require('../exchanges/websocket.' + exchange.replace('_','.'));
            this.websockets[exchange].start();

            this.websockets[exchange].on('ticker', function(e) {
                global.frostybot.tickers[e.exchange][e.data.symbol] = {
                    symbol: e.data.symbol,
                    bid: e.data.bid,
                    ask: e.data.ask
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
    
    }

    // Register methods with the API (called by init_all() in core.loader.js)

    register_api_endpoints() {

        // Permissions are the same for all methods, so define them once and reuse
        var permissions = {
            'websocket:status': {
                'standard': ['any' ],
                'provider': ['any' ],
            }
        }

        // API method to endpoint mappings
        var api = {
            'websocket:status':  'get|/websocket/status',            // Get all markets for an exchange 
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions[method]); // Defined in mod.base.js
        }
        
    }

    // Get status of websocket clients

    async status() {

        return this.stats;

    }

}
