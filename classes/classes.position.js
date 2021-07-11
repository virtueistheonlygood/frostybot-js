const frostybot_base = require('./classes.base')

// Frostybot Position Object

module.exports = class frostybot_position extends frostybot_base {

  constructor (userinfo, market, direction, size, entryPrice, liqPrice = null) {
    super ();
    if (userinfo == undefined) return this;
    this.uuid = userinfo.uuid;
    this.stub = userinfo.stub;
    this.symbol = market.id;
    this.market = market;
    this.direction = direction;
    this.base_size = size;
    this.quote_size = this.base_size * entryPrice;
    this.entry_price = entryPrice;
    this.entry_value = this.roundusd(Math.abs(this.base_size * this.entry_price));
    this.current_price = null;
    this.current_value = null;
    this.liquidation_price = liqPrice;
    this.pnl = (this.direction == "short" ? -1 : 1) * (this.current_value - this.entry_value);
    this.update();
  }

  // Round USD values to 2 decimal places
  roundusd(val) {
    return Math.round(val * 100) / 100
  }

  // Find market
  find(symbol) {
    var markets = global.frostybot.markets[this.market.exchange];
    var mapping = global.frostybot.mapping[this.market.exchange];
    if (markets != undefined)
        return markets[mapping[symbol]] != undefined ? markets[mapping[symbol]] : false;

  }

  async update() {
    var market = this.find(this.market.id);
    if (market != undefined) {
      this.market = market;
      if (typeof(market['update']) == 'function') await market.update();
      //this.market = market;
      //this.type = market.type
      if (![undefined, null].includes(market.usd)) {
        var usdbase =  ![undefined, null].includes(market.usd.base)  ? market.usd.base  : (![undefined, null].includes(market.usd) ? market.usd : undefined);
        var usdquote = ![undefined, null].includes(market.usd.quote) ? market.usd.quote : (![undefined, null].includes(market.usd) ? market.usd : undefined);
      }
      var sizing = global.frostybot.exchanges[this.exchange] != undefined ? global.frostybot.exchanges[this.exchange].order_sizing : 'base';
      switch (sizing) {
        case 'base':
          this.base_size = Math.abs(this.base_size);
          this.quote_size = Math.abs(this.base_size * this.entry_price);
          this.usd_size = usdbase != undefined ? this.roundusd(Math.abs(this.base_size * usdbase)) : null;
          break;
        case 'quote':
          this.base_size = Math.abs(this.quote_size / this.entry_price);
          this.quote_size = Math.abs(this.quote_size);
          this.usd_size = usdquote != undefined ? this.roundusd(Math.abs(this.base_size * usdquote)) : null;
          break;
      }
  }
  if (this.market.type == 'futures') {
      this.updatepnl();
    }


  }

  // Update pricing

  async updatepnl() {
    this.current_price = this.market.avg != null ? this.market.avg : (this.market.bid + this.market.ask) / 2;
    this.current_value = this.roundusd(Math.abs(this.base_size * this.current_price));
    this.pnl = this.roundusd((this.direction == "short" ? -1 : 1) * (this.current_value - this.entry_value)); // Calculate PNL is not supplied by exchange
  }

}
