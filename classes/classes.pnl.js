const frostybot_base = require('./classes.base')

// Frostybot PNL Object

module.exports = class frostybot_pnl extends frostybot_base {

  constructor(stub, symbol, groups) {
    super();
    this.stub = stub,
    this.symbol = symbol,
    this.groups = groups
  }

}
