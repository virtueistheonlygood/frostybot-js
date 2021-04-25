// Frostybot Websocket interface for Binance Futures

const axios = require("axios"); 
var binance_api = require('node-binance-api');

const frostybot_websocket_base = require('./websocket.base');

class frostybot_websocket_binance_futures extends frostybot_websocket_base {

    // Constructor

    constructor() {
        super()
        this.exchange = 'binance_futures'
        this.handle = new binance_api();
    }

    // Initialize all the market symbols in the ticker

    async start() {
        var self = this;
        this.handle.futuresBookTickerStream(function (data) {
            self.updateticker(data.symbol, data.bestBid, data.bestAsk)
        });
    }
    
}

module.exports = new frostybot_websocket_binance_futures();
