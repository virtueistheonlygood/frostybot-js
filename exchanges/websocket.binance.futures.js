// Frostybot Websocket interface for Binance Futures

const frostybot_websocket_base = require('./websocket.base');

class frostybot_websocket_binance_futures extends frostybot_websocket_base {

    // Constructor

    constructor() {
        super('binance_futures', 'wss://fstream.binance.com/ws')
    }

    // Connected handler
    
    async onconnected() {
        this.send({method: 'SUBSCRIBE',params: ['!bookTicker'],id: 1 });
    }

    // Send message

    send(data) {
        this.ws.send(JSON.stringify(data));
    }

    // Message handler

    onmessage(data) {
        var message = JSON.parse(data)
        var type = message.e
        switch (type) {
            case    'bookTicker'    :   var symbol = message.s;
                                        var bid = message.b;
                                        var ask = message.a;
                                        this.updateticker(symbol, bid, ask);
                                        break;
            default                 :   if (message.id == 'undefined') this.logger('warning', 'Unhandled message: ' + data)
                                        break;
        }
    }

    // Heartbeat handler

    onheartbeat() {
        if (this.connected) {
           // this.send({op: 'ping'})
        }
    }
    
}

module.exports = new frostybot_websocket_binance_futures();
