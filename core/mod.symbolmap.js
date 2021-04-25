// Symbol Mapping Module

const frostybot_module = require('./mod.base')

module.exports = class frostybot_symbolmap_module extends frostybot_module {

    // Constructor

    constructor() {
        super()
        this.description = 'Symbol Mapping Module'
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
            'symbolmap:get':  [
                                'get|/symbolmap/:exchange',            // Retrieve all symbol mapping for an exchange
                                'get|/symbolmap/:exchange/:symbol',    // Retrieve specific symbol mapping for an exchange and symbol
                              ],
            'symbolmap:add':  [
                                'post|/symbolmap/:exchange',           // Create new symbol mapping for an exchange
                                'put|/symbolmap/:exchange',            // Update symbol mapping for an exchange
                              ],
            'symbolmap:delete': 'delete|/symbolmap/:exchange/:symbol', // Delete specific symbol mapping for an exchange and symbol
        }

        // Register endpoints with the REST and Webhook APIs
        for (const [method, endpoint] of Object.entries(api)) {   
            this.register_api_endpoint(method, endpoint, permissions); // Defined in mod.base.js
        }
        
    }

    // Get mappings

    async get(params) {

        var schema = {
            exchange: {
                required: 'string',
                format: 'lowercase',
                oneof: ['ftx', 'ftxus', 'deribit', 'binance', 'binanceus', 'bitmex'],
            },
            symbol: {
                optional: 'string',
                format: 'uppercase',
            }
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [exchange, symbol] = this.mod.utils.extract_props(params, ['exchange', 'symbol']);
        var exchange = exchange.toLowerCase();
        var symbol = symbol != undefined ? symbol.toUpperCase() : null;
        var result = (symbol == null ? await this.mod.settings.get('symbolmap:' + exchange) : await this.mod.settings.get('symbolmap:' + exchange, symbol));
        if ((typeof result == 'string') && (symbol != null)) {
            var mapping = result;
            result = {};
            result[symbol] = mapping;
            this.mod.output.debug('symbolmap_get', [exchange, symbol, mapping]);
            return result;
        } else {
            if (result !== false) {
                result = this.mod.utils.remove_values(result, [null, undefined, false]);
                for (var symbol in result) {
                    var mapping = result[symbol];
                    this.mod.output.debug('symbolmap_get', [exchange, symbol, mapping]);
                }
                return result;
            }
            return this.mod.output.error('symbolmap_get', [exchange, symbol]);
        }
    }


    // Add symbol mapping

    async add(params) {

        var schema = {
            exchange: {
                required: 'string',
                format: 'lowercase',
                oneof: ['ftx', 'ftxus', 'deribit', 'binance', 'binanceus', 'bitmex'],
            },
            symbol: {
                required: 'string',
                format: 'uppercase',
            },
            mapping: {
                required: 'string',
                format: 'uppercase',
            }
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [exchange, symbol, mapping] = this.mod.utils.extract_props(params, ['exchange', 'symbol', 'mapping']);
        var exchange = exchange.toLowerCase();
        var symbol = symbol.toUpperCase();
        var mapping = mapping.toUpperCase();
        var data = {
            value: mapping,
        }
        if (this.mod.settings.set('symbolmap:' + exchange, symbol, mapping)) {
            this.mod.output.success('symbolmap_add', [exchange, symbol, mapping]);
            return this.get({exchange: exchange, symbol: symbol});
        }
        return this.mod.output.error('symbolmap_add', [exchange, symbol, mapping]);
    }


    // Delete symbol mapping

    async delete(params) {

        var schema = {
            exchange: {
                required: 'string',
                format: 'lowercase',
                oneof: ['ftx', 'ftxus', 'deribit', 'binance', 'binanceus', 'bitmex'],
            },
            symbol: {
                required: 'string',
                format: 'uppercase',
            }
        }

        if (!(params = this.mod.utils.validator(params, schema))) return false; 

        var [exchange, symbol] = this.mod.utils.extract_props(params, ['exchange', 'symbol']);
        var exchange = exchange.toLowerCase();
        var symbol = symbol.toUpperCase();
        if (this.mod.settings.delete('symbolmap:' + exchange.toLowerCase(), symbol.toUpperCase())) {
            this.mod.output.success('symbolmap_delete', [exchange, symbol]);
            return true;
        }
        this.mod.output.error('symbolmap_delete', [exchange, symbol]);
        return false;
    }


    // Map symbol

    async map(exchange, symbol) {
        var result = await await this.mod.settings.get('symbolmap:' + exchange, symbol.toUpperCase())
        return (result === null ? false : result)
    }

};