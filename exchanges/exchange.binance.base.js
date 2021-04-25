frostybot_exchange_base = require('./exchange.base');

module.exports = class frostybot_exchange_binance_base extends frostybot_exchange_base {

    // Class constructor

    constructor(user = undefined, stub = undefined) {
        super(user, stub);        
        this.ccxtmodule = 'binance'                  // CCXT module to use
        this.stablecoins = ['USDT','BUSD'];          // Stablecoins supported on this exchange
        this.order_sizing = 'base';                  // Exchange requires base size for orders
        this.collateral_assets = ['USDT','BUSD'];    // Assets that are used for collateral
        this.balances_market_map = '{currency}/USDT' // Which market to use to convert non-USD balances to USD
        this.param_map = {                           // Order parameter mappings
            limit             : 'LIMIT',
            market            : 'MARKET',
            stoploss_limit    : 'STOP_LOSS_LIMIT',
            stoploss_market   : 'STOP_LOSS_LIMIT',   // Market stops are not supported by the Binance Spot API, even through their documentation says it is
            takeprofit_limit  : 'TAKE_PROFIT_LIMIT', 
            takeprofit_market : 'TAKE_PROFIT',
            trailing_stop     : null, 
            post              : null,                // TODO
            reduce            : 'reduceOnly',
            ioc               : null,                // TODO
            tag               : null,                // TODO
            trigger           : 'stopPrice',
        };
    }


}
