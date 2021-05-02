// Frostybot Websocket interface for Binance Futures

const frostybot_websocket_base = require('./websocket.base');

class frostybot_websocket_binance_spot extends frostybot_websocket_base {

    // Constructor

    constructor() {
        super('binance_spot', 'wss://stream.binance.com/ws')
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
        if (message.id != undefined) return true;
        if (message.u != undefined && message.s != undefined && message.b != undefined && message.a != undefined) {
            var symbol = message.s;
            var bid = message.b;
            var ask = message.a;
            this.updateticker(symbol, bid, ask);
            return true;
        } else {
            this.logger('warning', 'Unhandled message: ' + data)
        }
        return false;
    }

    // Heartbeat handler

    onheartbeat() {
        if (this.connected) {
           // this.send({op: 'ping'})
        }
    }
    
}

module.exports = new frostybot_websocket_binance_spot();
