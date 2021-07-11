const frostybot_base = require('./classes.base')

// Frostybot Market Object

module.exports = class frostybot_market extends frostybot_base {

  constructor (exchange, id, options) {
    super ();
    if (exchange == undefined) return this;
    this.exchange = exchange;
    this.id = id;
    this.base = options.assets.base;
    this.quote = options.assets.quote;
    this.bid = parseFloat(options.prices.bid || null);
    this.ask = parseFloat(options.prices.ask || null);
    this.usd = ['USD', 'USDT', 'BUSD', 'USDC'].includes(this.quote) ? this.ask : null;
    this.avg = !(isNaN(this.bid) || isNaN(this.ask)) ? (this.bid + this.ask) / 2 : null;
    for (const [key,val] of Object.entries(options.metadata)) {
      this[key] = val;
    }
    this.update();
  }

  globalindex() {
    if (this.index != undefined) {
      if (global.frostybot.markets == undefined) global.frostybot.markets = {};
      if (global.frostybot.markets[this.exchange] == undefined) global.frostybot.markets[this.exchange] = {};
      if (global.frostybot.markets[this.exchange][this.id] == undefined) global.frostybot.markets[this.exchange][this.id] = this;
      if (global.frostybot.mapping == undefined) global.frostybot.mapping = {};
      if (global.frostybot.mapping[this.exchange] == undefined) global.frostybot.mapping[this.exchange] = {};
      Object.values(this.index).forEach(val => {
        global.frostybot.mapping[this.exchange][val] = this.id;
      });
    }
  }

  // Find market
  find(symbol) {
    var markets = global.frostybot.markets[this.exchange];
    var mapping = global.frostybot.mapping[this.exchange];
    if (markets != undefined)
        return markets[mapping[symbol]] != undefined ? markets[mapping[symbol]] : false;

  }

  // Update tickers and USD pricing
  async update() {
    this.globalindex();
    var ticker = await global.frostybot.modules.exchange.findticker(this.exchange, this.id)
    if (![false, undefined, null].includes(ticker)) {
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
      ['base','quote'].forEach(type => {
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
