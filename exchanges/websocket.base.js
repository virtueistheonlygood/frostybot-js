// Websocket Market Data Base Class

const WebSocket = require('ws-reconnect');
const EventEmitter = require('events');
const READY_STATE = ['CONNECTING', 'OPEN', 'CLOSING', 'CLOSED'];
const RATE_LIMIT = 250; // Messages per second rate limit per websocket
const rateLimit = require('ws-rate-limit');

module.exports = class frostybot_websocket_base extends EventEmitter {

    constructor(exchange, url) {
        super()
        this.ticker = {};
        var time = (new Date()).getTime()
        this.exchange = exchange;
        this.messages = 0;
        this.updated = time
        this.mps = null;
        this.last = time,
        this.updated = time,
        this.connected = false;
        this.initialized = false;
        this.lastping = null
        this.lastpong = null
        this.heartbeat = null;
        this.status = null;
        this.stats = {}
        this.debug = false;
        
        var _this = this;
        this.ws = new WebSocket(url, {reconnectInterval: 5 });
        this.limiter = rateLimit('1s', RATE_LIMIT)
        this.limiter(this.ws)

            
        // Statistics update timer
        this.statsTimer = setInterval(function () {
            var time = (new Date()).getTime();
            _this.mps = Math.floor(_this.messages / (time - _this.updated) * 1000);
            _this.updated = time;   
            _this.messages = 0;
            _this.stats = {
                exchange:   _this.exchange,
                symbols:    Object.keys(_this.ticker).length,
                mps:        _this.mps,
                last:       _this.last,
                connected:  _this.connected,
                status:     _this.status
            }
            _this.event('stats', _this.stats)
            //_this.logger(Object.keys(_this.ticker).length + ' symbols, ' + _this.mps + ' msg/s')
            //_this.emit('statsUpdate', _this.stats);
        }, 1000);

        // Alive timer
        setInterval(function () {
            var status = _this.readystate();
            _this.connected = status == 'OPEN'
            if (status != _this.status) {
                _this.logger('debug','Status: ' + status);
                _this.status = status;
            }
        }, 1000)

        // On connect handler
        this.ws.on('connect', async function() {
            _this.logger('success','Websocket connected');
            _this.event('connected')
            _this.lastpong = (new Date()).getTime();
            _this.connected = _this.readystate() == 'OPEN';
            if (typeof(_this.onconnected) == 'function') await _this.onconnected();
            if (typeof(_this.onsubscribe) == 'function') await _this.onsubscribe();
            _this.heartbeat = setInterval(async function() {
                _this.connected = _this.readystate() == 'OPEN';
                if (_this.connected) {
                    _this.lastping = (new Date()).getTime();
                    if (typeof(_this.onheartbeat) == 'function') await _this.onheartbeat();
                    //_this.logger('ping')
                }
            }, 5000);    
        });

        // On reconnect handler
        this.ws.on('reconnect', function() {
            _this.logger('warning', 'Websocket reconnecting...');
            _this.event('reconnecting')
            _this.connected = false;
        })

        // On message handler
        this.ws.on('message', function(data) {
            if (typeof(_this.onmessage) == 'function') _this.onmessage(data);
        })

        // On error handler
        this.ws.on('error', function(e) {
            _this.error(e);
        })

        // On close handler
        this.ws.on('close', function() {
            clearInterval(this.heartbeat);
            _this.logger('warning','Websocket disconnected');
            _this.event('disconnected')
            _this.connected = false;
        })
        
    }

    // Get Websocket Ready State

    readystate() {
        return READY_STATE[ (this.ws.socket != null ? this.ws.socket.readyState : 4) ];
    }

    // Log output

    logger(type, message) {
        var dtobj = new Date()
        var data = {
            timestamp: dtobj.getTime(),
            datetime: dtobj.toJSON().split('.')[0].replace('T',' '),
            type: type,
            message: message
        }
        this.event('log', data)
    }

    // Error Handler

    error(e) {
        this.logger('error', e);
        this.event('error', e)
    }

    // Send an event

    event(type, data) {
        var eventdata = {
            exchange:   this.exchange,
        }
        if (data != undefined) eventdata['data'] = data;
        this.emit(type, eventdata);
    }

    // Start the Websocket Interface

    async start() {
        this.logger('notice','Websocket starting...')
        this.ws.start();
    }
    
    // Stop the Websocket Interface

    async stop() {
        this.logger('notice','Websocket stopping...')
        try {
            this.ws.destroy();
        } catch(e) {          
        }
        return true;
    }
    
    // Update Ticker Symbol

    updateticker(symbol, bid, ask) {
        this.last = (new Date()).getTime();
        bid = parseFloat(bid)
        ask = parseFloat(ask)
        this.ticker[symbol] = {
            symbol: symbol,
            bid:    bid,
            ask:    ask
        }
        this.messages++;
        this.event('ticker', {symbol: symbol, bid: bid, ask: ask})
    }

    // Get statistics

    stats() {
        var stats = {
            exchange:   this.exchange,
            symbols:    Object.keys(this.ticker).length,
            mps:        this.mps,
            last:       this.last,
            connected:  this.connected,
            status:     this.status
        }
        return stats;
    }
    

}


