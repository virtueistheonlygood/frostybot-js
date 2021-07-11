const frostybot_base = require('./classes.base')

// Frostybot Balance Object

module.exports = class frostybot_order extends frostybot_base {

  constructor (userinfo, market, id, timestamp, type, direction, side, price, trigger, size, filled, status) {
    super ();
    if (userinfo == undefined) return this;
    this.uuid = userinfo.uuid;
    this.stub = userinfo.stub;
    //this.market = market;
    this.exchange = market.exchange;
    this.symbol = market.id;
    this.type = market.type;
    this.id = id;
    this.timestamp = parseInt(timestamp);
    this.datetime = new Date (this.timestamp);
    this.type = type;
    this.direction = direction;
    this.side = side;
    this.price = price;
    this.trigger = trigger;
    this.size = size;
    this.filled = filled;
    this.status = status;
    this.update();
  }

  // Find market
  async find(symbol) {
    return await global.frostybot.modules.exchange.findmarket(this.exchange, symbol)
  }

  async update() {
    var market = await this.find(this.symbol);
    if (market != undefined) {
      //await market.update();
      //this.market = market;
      if (![undefined, null].includes(market.usd)) {
        var usdbase =  ![undefined, null].includes(market.usd.base)  ? market.usd.base  : (![undefined, null].includes(market.usd) ? market.usd : undefined);
        var usdquote = ![undefined, null].includes(market.usd.quote) ? market.usd.quote : (![undefined, null].includes(market.usd) ? market.usd : undefined);
      }
      var sizing = global.frostybot.exchanges[market.exchange]['order_sizing'];
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
