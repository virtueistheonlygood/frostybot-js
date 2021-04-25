// Frostybot Websocket interface for FTX

const axios = require('axios'); 

const frostybot_websocket_base = require('./websocket.base');

class frostybot_websocket_ftx extends frostybot_websocket_base {

    // Constructor

    constructor() {
        super('ftx', 'wss://ftx.com/ws/')
    }

    // Connected handler
    
    async onconnected() {
        axios.get('https://ftx.com/api/markets')
        .then((response) => {
            var result = response.data;
            if (result.success == true) {
                let markets = result.result;
                markets.forEach(market => {
                    if (market.enabled == true) {
                        let symbol = market.name;
                        let bid = market.bid;
                        let ask = market.ask;
                        this.updateticker(symbol, bid, ask)
                        this.send({op: 'subscribe', channel: 'ticker', market: symbol});
                    }
                });

            }
        });
    }

    // Send message

    send(data) {
        try {
            this.ws.send(JSON.stringify(data));
        } catch (e) {
            this.error(e);
        }
    }

    // Message handler

    onmessage(data) {
        var message = JSON.parse(data)
        var type = message.type
        var channel = message.channel
        switch (type) {
            case    'update'    :   if (channel == 'ticker') {
                                        var symbol = message.market;
                                        var bid = message.data.bid;
                                        var ask = message.data.ask;
                                        this.updateticker(symbol, bid, ask)                                        
                                    };
                                    break;
            case    'pong'      :   this.lastpong = (new Date()).getTime();
                                    //this.logger('notice', 'Pong received')
                                    break;
        }
    }

    // Heartbeat handler

    onheartbeat() {
        if (this.connected) {
            //this.logger('notice', 'Ping sent')
            this.send({op: 'ping'})
        }
    }
    
}

module.exports = new frostybot_websocket_ftx();
