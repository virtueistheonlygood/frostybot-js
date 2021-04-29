// Frostybot Custom Classes

md5 = require ('md5');
const { v4: uuidv4 } = require('uuid');
var context = require('express-http-context');

// The base class (All Frostybot classes are derived from this)
class frostybot_base {
  constructor () {}

   // Create mapping to other modules

  fromdatasource(data) {
    Object.keys(data).forEach(key => {
      this[key] = data[key];
    })
    if (typeof(this['update']) == 'function') this.update();
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

// Account Balance Object

class frostybot_balance extends frostybot_base {

  constructor (user, stub, exchange, currency, free, used, total) {
    super ();
    total = total * 1;
    if (used == false && free != false && total != false) {
      used = total - (free * 1);
    }
    if (free == false && used != false && total != false) {
      free = total - (used * 1);
    }
    this.user = user;
    this.stub = stub;
    this.exchange = exchange;
    this.currency = currency;
    this.base = {
      free: parseFloat(free),
      used: parseFloat(used),
      total: parseFloat(total),
    };
  }

  // Find market
  find(symbol) {
    var markets = global.frostybot.markets[this.exchange];
    var mapping = global.frostybot.mapping[this.exchange];
    if (markets != undefined)
      return markets[mapping[symbol]] != undefined ? markets[mapping[symbol]] : false;
  }
  

  // Update USD prices
  update() {
    var stablecoins = global.frostybot.exchanges[this.exchange].stablecoins;
    var balances_market_map = global.frostybot.exchanges[this.exchange].balances_market_map;
    var price = null;
    if (stablecoins.includes(this.currency)) {
        price = 1;
    } else {
        for (var i = 0; i < stablecoins.length; i++) {
            var stablecoin = stablecoins[i];
            var mapsymbol = balances_market_map.replace('{currency}', this.currency).replace('{stablecoin}', stablecoin);
            var market = this.find(mapsymbol);
            if (market != false) {
                global.frostybot.modules.output.debug('custom_object', ['Converting using symbol', mapsymbol]);
                price = ((market.bid * 1) + (market.ask * 1)) / 2;
                break;
            }
        };
    }
    if (price == null) {
      global.frostybot.modules.debug('custom_object', ['Cannot find conversion market for currency: ', this.currency]);
      this.usd = {
        free: null,
        used: null,
        total: null,
      };  
    } else {
      this.price = price;
      this.usd = {
        free: parseFloat(this.base.free * this.price),
        used: parseFloat(this.base.used * this.price),
        total: parseFloat(this.base.total * this.price),
      };  
    }
  }


}

// Market Object

class frostybot_market extends frostybot_base {

  constructor (
    exchange, id, symbol, type, base, quote, bid, ask, expiration, contract_size, precision, tvsymbol, raw) {
    super ();
    this.exchange = exchange;
    this.id = id;
    this.symbol = symbol;
    this.tvsymbol = tvsymbol;
    this.type = type;
    this.base = base;
    this.quote = quote;
    this.bid = bid != null ? parseFloat(bid) : null;
    this.ask = ask != null ? parseFloat(ask) : null;
    this.usd = null;
    this.avg = bid != null && ask != null ? parseFloat((bid + ask) / 2) : null;
    this.expiration = expiration;
    this.contract_size = contract_size;
    this.precision = precision;
    //this.raw = raw;
  }

  // Find market
  find(symbol) {
    var markets = global.frostybot.markets[this.exchange];
    var mapping = global.frostybot.mapping[this.exchange];
    if (markets != undefined)
        return markets[mapping[symbol]] != undefined ? markets[mapping[symbol]] : false;

  }

  // Update tickers and USD pricing
  update() {
    var ticker_by_id = global.frostybot.tickers[this.exchange][this.id];
    var ticker_by_symbol = global.frostybot.tickers[this.exchange][this.symbol];
    var ticker = ticker_by_id != undefined ? ticker_by_id : (ticker_by_symbol != undefined ? ticker_by_symbol : undefined);
    if (ticker != undefined) {
      this.bid = ticker.bid;
      this.ask = ticker.ask;
      this.avg = (ticker.bid + ticker.ask) / 2
      this.update_usd_pricing();
    }
  }


  // Update USD pricing
  update_usd_pricing() {
    var stablecoins = global.frostybot.exchanges[this.exchange].stablecoins;
    if (this.usd == undefined) this.usd = {};
    if (!stablecoins.includes(this.quote)) {
      this.usd.pairs = {}
      'base:quote'.split(':').forEach(type => {
        var pair = this.find_usd_value_pair(type);
        var search = pair != false ? this.find(pair) : false;
        if (search != false) {
          search.update();
          this.usd.pairs[type] = pair; 
          this.usd[type] = search.avg
        }
      });
    } else {
      if (isNaN(this.avg) || this.avg == null) this.avg = (this.bid + this.ask) / 2;
      this.usd = this.avg;
    }
  }

  // Get USD pair 
  find_usd_value_pair(type) {
    if (this.usd.pairs[type] != undefined) {
      return this.usd.pairs[type];
    } else {
      var pair = null
      var stablecoins = global.frostybot.exchanges[this.exchange].stablecoins;
      for (var i = 0; i < stablecoins.length; i++) {
        pair = this[type] + '/' + stablecoins[i];
        if (this.find(pair) != false) return pair;
      }
    }
    return false;
  }
  

}

// Position Base Object

class frostybot_position extends frostybot_base {

  constructor (user, stub, exchange, symbol, type, direction, base_size, quote_size, raw = null) {
    super ();
    if (user == undefined) return this;
    if (user.user != undefined) { 
      this.fromdatasource(user) 
      this.user = user.user;
    } else {
      this.user = user;
    }
    this.stub = stub;
    this.exchange = exchange;
//    this.market = null;
    this.symbol = symbol;
    this.type = type; 
    this.direction = direction;
    this.base_size = base_size;
    this.quote_size = quote_size;
    this.update();
  }

  // Find market
  find(symbol) {
    var markets = global.frostybot.markets[this.exchange];
    var mapping = global.frostybot.mapping[this.exchange];
    if (markets != undefined)
        return markets[mapping[symbol]] != undefined ? markets[mapping[symbol]] : false;

  }

  async update() {

    var market = this.find(this.symbol);
    if (market != undefined) {
      this.symbol = market.symbol;
      if (typeof(market['update']) == 'function') market.update();
      //this.market = market;
      //this.type = market.type
      if (![undefined, null].includes(market.usd)) {
        var usdbase =  ![undefined, null].includes(market.usd.base)  ? market.usd.base  : (![undefined, null].includes(market.usd) ? market.usd : undefined);
        var usdquote = ![undefined, null].includes(market.usd.quote) ? market.usd.quote : (![undefined, null].includes(market.usd) ? market.usd : undefined);
      }
      var sizing = global.frostybot.exchanges[this.exchange]['order_sizing'];
      switch (sizing) {
        case 'base':
          this.base_size = Math.abs(this.base_size);
          this.quote_size = Math.abs(this.base_size * market.avg);
          this.usd_size = usdbase != undefined ? Math.abs(this.base_size * usdbase) : null;
          break;
        case 'quote':
          this.base_size = Math.abs(this.quote_size / market.avg);
          this.quote_size = Math.abs(this.quote_size);
          this.usd_size = usdquote != undefined ? Math.abs(this.base_size * usdquote) : null;
          break;
      }
  }
  if (this.type == 'futures') {
      this.updatepnl();
    }


  }

}

// Futures Position Object

class frostybot_position_futures extends frostybot_position {

  constructor (user, stub, exchange, symbol, direction, base_size, quote_size, entry_price, liquidation_price, raw = null) {
    super (user, stub, exchange, symbol, 'futures', direction, base_size, quote_size, entry_price, raw);
    if (user == undefined) return this;
    this.entry_price = entry_price;
    this.entry_value = Math.abs(this.base_size * this.entry_price);
    this.current_price = null;
    this.current_value = null;
    this.liquidation_price = liquidation_price;
    this.pnl = (this.direction == "short" ? -1 : 1) * (this.current_value - this.entry_value); // Calculate PNL is not supplied by exchange
  }

  // Update pricing

  async updatepnl() {
    var market = this.find(this.symbol);
    if (market != undefined) {
      this.symbol = market.symbol;
      this.current_price =  market.avg != null ? market.avg : (market.bid + market.ask) / 2;
      this.current_value = Math.abs(this.base_size * this.current_price);
      this.pnl = (this.direction == "short" ? -1 : 1) * (this.current_value - this.entry_value); // Calculate PNL is not supplied by exchange
    }
  }

}

// Spot Position Object

class frostybot_position_spot extends frostybot_position {

  constructor (user, stub, exchange, symbol, direction, base_size, quote_size, raw = null) {
    super (user, stub, exchange, symbol, 'spot', direction, base_size, quote_size, raw);
    if (user == undefined) return this;
  }

}

// Order Object

class frostybot_order extends frostybot_base {
  constructor (user, stub, exchange, symbol, id, timestamp, type, direction, price, trigger, size, filled, status, raw = null) {
    super ();
    if (user == undefined) return this;
    if (user.user != undefined) { 
      this.fromdatasource(user) 
      this.user = user.user;
    } else {
      this.user = user;
    }
    this.stub = stub;
    this.exchange = exchange;
    this.symbol = symbol;
    this.id = id;
    if (timestamp.length < 13) {
      // Convert epoch timestamp to millisecond timestamp
      timestamp = timestamp * 100;
    }
    let dateobj = new Date (parseInt(timestamp) * 1);
    /*
            let day = ("0" + dateobj.getDate()).slice(-2);
            let month = ("0" + (dateobj.getMonth() + 1)).slice(-2);
            let year = dateobj.getFullYear();
            let hour = dateobj.getHours();
            let minute = dateobj.getMinutes();
            let second = dateobj.getSeconds();
            this.datetime = year + "-" + month + "-" + day + " " + hour + ":" + minute + ":" + second;
        */
    this.timestamp = (timestamp * 1);
    this.datetime = dateobj;
    this.type = type;
    this.direction = direction;
    this.price = price;
    this.trigger = trigger;
    this.size = size;
    this.filled = filled;
    this.status = status;
    this.update();
    //this.raw = raw;
  }

  // Find market
  find(symbol) {
    var markets = global.frostybot.markets[this.exchange];
    var mapping = global.frostybot.mapping[this.exchange];
    if (markets != undefined)
        return markets[mapping[symbol]] != undefined ? markets[mapping[symbol]] : false;
  }

  async update() {
    var market = this.find(this.symbol);
    if (market != undefined) {
      this.symbol = market.symbol;
      market.update();
      if (![undefined, null].includes(market.usd)) {
        var usdbase =  ![undefined, null].includes(market.usd.base)  ? market.usd.base  : (![undefined, null].includes(market.usd) ? market.usd : undefined);
        var usdquote = ![undefined, null].includes(market.usd.quote) ? market.usd.quote : (![undefined, null].includes(market.usd) ? market.usd : undefined);
      }
      var sizing = global.frostybot.exchanges[this.exchange]['order_sizing'];
      switch (sizing) {
        case 'base':
          this.size = this.size_base != undefined ? this.size_base : (this.size != undefined ? this.size : undefined);
          this.size_base = Math.abs(this.size);
          this.size_quote = Math.abs(this.size * this.price);
          this.size_usd = usdbase != undefined ? Math.abs(this.size * usdbase) : null;
          this.filled_base = Math.abs(this.filled);
          this.filled_quote = Math.abs(this.filled * this.price);
          this.filled_usd = usdbase != undefined ? Math.abs(this.filled * usdbase) : null;
          delete this.size;
          break;
        case 'quote':
          this.size = this.size_quote != undefined ? this.size_quote : (this.size != undefined ? this.size : undefined);
          this.size_base = Math.abs(this.size / this.price);
          this.size_quote = Math.abs(this.size);
          this.size_usd = usdquote != undefined ? Math.abs(this.size * usdquote) : null;
          this.filled_base = Math.abs(this.filled / this.price);
          this.filled_quote = Math.abs(this.filled);
          this.filled_usd = usdquote != undefined ? Math.abs(this.filled * usdquote) : null;
          delete this.size;
          break;
      }
    }
  }

}

// PNL Object

class frostybot_pnl extends frostybot_base {

  constructor(stub, symbol, groups) {
    super();
    this.stub = stub,
    this.symbol = symbol,
    this.groups = groups
  }

}

// Output Object

class frostybot_output extends frostybot_base {
  constructor (command, params, result, message, type, data, stats, messages) {
    super ();
    this.command = command;
    this.params = params != null
      ? helper.censorProps (params, ['apikey', 'secret', 'password', 'oldpassword', 'newpassword'])
      : undefined;
    this.result = result;
    this.message = message;
    this.type = type;
    this.data = data;
    this.stats = stats;
    this.messages = messages;
    if (message == null) delete this.message;
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
  balance: frostybot_balance,
  position_futures: frostybot_position_futures,
  position_spot: frostybot_position_spot,
  market: frostybot_market,
  order: frostybot_order,
  pnl: frostybot_pnl,
  metric: frostybot_metric,
  output: frostybot_output,
  //exchange: frostybot_exchange,
  //websocket_trade: frostybot_websocket_trade,
  //websocket_ticker: frostybot_websocket_ticker,
  //websocket_order: frostybot_websocket_order,
};
