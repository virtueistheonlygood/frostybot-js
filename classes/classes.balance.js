const frostybot_base = require('./classes.base')

// Frostybot Balance Object

module.exports = class frostybot_balance extends frostybot_base {

  constructor (userinfo, exchange, currency, free, total) {
    super ();
    if (userinfo == undefined) return this;
    this.uuid = userinfo.uuid;
    this.stub = userinfo.stub;
    free = parseFloat(free);
    total = parseFloat(total);
    var used = total - free;
    this.exchange = exchange;
    this.currency = currency;
    this.base = {
      free: free,
      used: used,
      total: total,
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
    //var stablecoins = ['USDT','BUSD']; //global.frostybot.exchanges[this.exchange].stablecoins;
    //var balances_market_map = global.frostybot.exchanges[this.exchange].balances_market_map;
    //var price = null;
    //if (stablecoins.includes(this.currency)) {
    var price = 1;
    //}
    /* else {
        for (var i = 0; i < stablecoins.length; i++) {
            var stablecoin = stablecoins[i];
            var mapsymbol = balances_market_map.replace('{currency}', this.currency).replace('{stablecoin}', stablecoin);
            var market = this.find(mapsymbol);
            if (market != false) {
                //global.frostybot.modules.output.debug('custom_object', ['Converting using symbol', mapsymbol]);
                price = ((market.bid * 1) + (market.ask * 1)) / 2;
                break;
            }
        };
    }
    */
    if (price == null) {
      //global.frostybot.modules.debug('custom_object', ['Cannot find conversion market for currency: ', this.currency]);
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
