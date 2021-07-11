// Frostybot Custom Classes

md5 = require ('md5');
const { v4: uuidv4 } = require('uuid');
var context = require('express-http-context');

// The base class (All Frostybot classes are derived from this)
class frostybot_base {
  constructor () {}

   // Create mapping to other modules

  async fromdatasource(data) {
    Object.keys(data).forEach(key => {
      this[key] = data[key];
    })
    if (typeof(this['update']) == 'function') await this.update();
    return this;
  }

}


// API Command Object

class frostybot_command extends frostybot_base {

    constructor(command, permissions = null) {
        super();
        var[module, method] = command.split(':');
        this.command = command
        this.module = module
        this.method = method
        if (permissions != null) this.permissions = permissions;

    }

    // Set command caching

    cache(ttl = 30, autorefresh = false) {
        this.ttl = ttl;
        this.autorefresh = autorefresh;
    }

}


// Performance Metric

class frostybot_metric extends frostybot_base {

  constructor(metric) {
    super ();
    this.context = context.get('reqId');
    this.metric = metric;
    this.uuid = uuidv4();
    this.cached = false;
  }

  start() {
    this.start_time = (new Date).getTime();
  }

  end() {
    this.end_time = (new Date).getTime();
    this.duration = (this.end_time - this.start_time) / 1000;
  }

}

/*
// Frostybot Exchange Handler

class frostybot_exchange extends frostybot_base {

    // Constructor

    // The exchange can me initialized using either just a stub (in which case the exchange type will be retirved from the stub
    // or by providing the exchange type (for accessing public functions without authentication). Authentication can be done later using 
    // the auth(stub, uuid) method.

    constructor (stub_or_name) {  
      super ();
      if (typeof(stub_or_name) == 'string' ) {
        this.name = name
      } else {
        this.stub = stub;
      }
      this.exchanges = {};
      this.exhandler = null;
      this.load_modules();
      this.load_handler(stub);
    }

    // Create module shortcuts

    load_modules () {
      Object.keys (global.frostybot.modules).forEach (module => {
        if (!['core', 'classes'].includes (module)) {
          this['mod'] = global.frostybot.modules;
        }
      });
    }

    // Load exchange handler for stub

    async load_handler (stub) {
      this.load_modules ();
      //this['accounts'] = global.frostybot.modules['accounts'];
      if (stub == undefined) {
        stub = context.get('stub');
      }
      this.exhandler = null;
      var account = await this.mod.accounts.getaccount (stub);
      if (account) {
        account = this.mod.utils.lower_props (account);
        if (account && account.hasOwnProperty (stub)) {
          account = account[stub];
        }
        const exchange_id = (account.hasOwnProperty('exchange') ? account.exchange : undefined);
        if (exchange_id == undefined) {
          //return this.mod.output.error('account_retrieve', 'Undefined stub')
          return false;
        }
        this.exchange_id = exchange_id;
        var type = account.hasOwnProperty ('type') ? account.type : null;
        this.exchanges[exchange_id] = require ('../exchanges/exchange.' + exchange_id + (type != null ? '.' + type : ''));
        const exchange_class = this.exchanges[exchange_id];
        this.exhandler = new exchange_class (stub);
        if (this.exhandler.hasOwnProperty('ccxtparams')) {
          
        }
        this.exhandler.interfaces.methods.forEach(method => this.load_method(method));
      }
    }

    // Load Method

    load_method(method) {
      this[method] =  async (params) => {return await this.execute (method, params);}
    }

    // Normalizer and CCXT Execution Handler

    async execute (stub, method, params = []) {
      if (this.exhandler == undefined) await this.load_handler (stub);
      if (this.exhandler != undefined) {
          return await this.exhandler.execute (method, params);
      }
      return false;
    }

    // Get Exchange property

    async get (stub, property) {
      if (this.exhandler == undefined) await this.load_handler (stub);
      return this.exhandler[property];
    }

}


// Frostybot Websocket Ticker

class frostybot_websocket_ticker extends frostybot_base {
  constructor (exchange, stub, timestamp, symbol, bid, ask) {
    super ();
    this.message_type = 'ticker';
    this.exchange = exchange;
    this.stub = stub;
    this.timestamp = timestamp;
    this.datetime = new Date (timestamp).toJSON ();
    this.symbol = symbol;
    this.bid = bid;
    this.ask = ask;
  }
}

// Frostybot Websocket Trade

class frostybot_websocket_trade extends frostybot_base {
  constructor (exchange, stub, timestamp, symbol, side, base, quote, price) {
    super ();
    this.message_type = 'trade';
    this.exchange = exchange;
    this.stub = stub;
    this.timestamp = timestamp;
    this.datetime = new Date (timestamp).toJSON ();
    this.symbol = symbol;
    this.side = side;
    this.base = base;
    this.quote = quote;
    this.price = price;
  }
}

// Frostybot Websocket Order

class frostybot_websocket_order extends frostybot_base {
  constructor (
    exchange,
    stub,
    symbol,
    id,
    timestamp,
    type,
    direction,
    price,
    trigger,
    size_base,
    size_quote,
    filled_base,
    filled_quote,
    status,
    raw = null
  ) {
    super ();
    this.message_type = 'order';
    this.exchange = exchange;
    this.stub = stub;
    this.symbol = symbol;
    this.id = id;
    this.timestamp = timestamp;
    this.datetime = new Date (timestamp).toJSON ();
    this.type = type;
    this.direction = direction;
    this.price = price;
    this.trigger = trigger;
    this.size_base = size_base;
    this.size_quote = size_quote;
    this.filled_base = filled_base;
    this.filled_quote = filled_quote;
    this.status = status;
    this.raw = raw;
  }
}

  */

module.exports = {
  command: frostybot_command,
  metric: frostybot_metric,
  //exchange: frostybot_exchange,
  //websocket_trade: frostybot_websocket_trade,
  //websocket_ticker: frostybot_websocket_ticker,
  //websocket_order: frostybot_websocket_order,
};
