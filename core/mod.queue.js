// Order processing queue

const frostybot_module = require('./mod.base')
var context = require('express-http-context');

module.exports = class frostybot_queue_module extends frostybot_module {

    // Constructor

    constructor() {
        super()
        this.description = 'Order Queue Processor'
    }

    // Initialize a queue
    
    create(stub, symbol) {
        var uuid = context.get('reqId')
        if (!this.hasOwnProperty('queue'))
            this.queue = {}
        if (!this.queue.hasOwnProperty(uuid))
            this.queue[uuid] = {}
        if (!this.queue[uuid].hasOwnProperty(stub))
            this.queue[uuid][stub] = {}
        if (!this.queue[uuid][stub].hasOwnProperty(symbol))
            this.queue[uuid][stub][symbol] = []
        if (!this.hasOwnProperty('results'))
            this.results = {}
        if (!this.results.hasOwnProperty(uuid))
            this.results[uuid] = {}
        if (!this.results[uuid].hasOwnProperty(stub))
            this.results[uuid][stub] = {}
        if (!this.results[uuid][stub].hasOwnProperty(symbol))
            this.results[uuid][stub][symbol] = []            
    }


    // Clear order queue
    
    clear(stub, symbol) {
        var uuid = context.get('reqId')
        this.create(stub, symbol)
        this.queue[uuid][stub][symbol] = []
        this.results[uuid][stub][symbol] = []
    }


    // Add order to queue
    
    add(stub, symbol, params) {
        var uuid = context.get('reqId')
        this.create(stub, symbol)
        if (!this.mod.utils.is_array(params)) {
            params = [params]
        }
        params.forEach(order => {
            this.mod.output.notice('order_queued', order)
            this.queue[uuid][stub][symbol].push(order)
        });
    }

    // Get queue contents

    get(stub, symbol) {
        var uuid = context.get('reqId')
        this.create(stub, symbol)
        return this.queue[uuid][stub][symbol];
    }

    // Check if order exists (ensure that it was successfully created on the exchange)

    async check(stub, symbol, id) {
        await this.mod.utils.sleep(3);
        let result = await this.mod.exchange.execute(stub, 'order', {id: id, symbol: symbol});
        return (result !== false ? true : false);
    }

    // Submit an order to the exchange

    async submit(stub, symbol, order) {
        try {
            var result = await this.mod.exchange.execute(stub, 'create_order', order);
        } catch (e) {
            this.mod.signals.output.error('Exchange Exception: ' + (e.msg || e.message || e))
            return false;
        }
        
        var id = result.id;
        var exchange = await this.mod.exchange.get_exchange_from_stub(stub)
        let doublecheck = await this.mod.exchange.setting(exchange, 'doublecheck');
            
        if (doublecheck == true) {
            this.mod.output.debug('order_check_enabled', [id]);
            var check = await this.check(stub, symbol, id);
            if (check == true) {
                // Doublecheck successful
                this.mod.signals.output.success('Signal executed successfully');
                this.mod.output.notice('order_check', [id]);
                return result;
            } else {
                // Doublecheck failed
                this.mod.signals.output.error('Doublecheck failed: Order ID: ' + id);
                this.mod.output.warning('order_submit', ['DoubleCheckError: Doublecheck failed for ID: ' + id] ); 
                return false;
            }
        } else {
            this.mod.signals.output.success('Signal executed successfully');
            // Doublecheck disabled and order successful
            //this.mod.output.debug('order_check_disabled');
            return result;
        }

        this.mod.output.warning('order_submit', [message] ); 
        return false;

    }

    // Process order queue (submit orders to the exchange)

    async process(stub, symbol) {
        var uuid = context.get('reqId')
        this.create(stub, symbol)
        var noexecute = await this.mod.config.get('debug:noexecute', false);
        var maxretry = parseInt(await this.mod.config.get(stub + ':maxretry', 3));
        var retrywait = parseInt(await this.mod.config.get(stub + ':retrywait', 5));
        if (noexecute == true) {
            this.mod.output.debug('debug_noexecute');
            this.mod.signals.output.error('User has configured debug:noexecute mode')
            var result = this.queue[uuid][stub][symbol];
            this.clear(stub, symbol);
            return result;
        }
        this.results[uuid][stub][symbol] = []
        var total = this.queue[uuid][stub][symbol].length;
        if (total > 0) { 
            var success = 0;
            this.mod.output.subsection('processing_queue', total);
            this.mod.output.notice('processing_queue', total); 
            
            for (const order of this.queue[uuid][stub][symbol]) {

                var result = await this.submit(stub, symbol, order);;

                if (result === false) {

                    for (var retry = 0; retry < maxretry; retry++) {
                        result = await this.submit(stub, symbol, order);
                        if (result === false) {
                            this.mod.output.warning('order_retry_wait', [retrywait])
                            await this.mod.utils.sleep(retrywait)
                            this.mod.output.warning('order_retry_num', [retry, maxretry])                
                        } else break
                    }
                }
                
                if (result == false) {
                    //output.set_exitcode(-1);
                    this.mod.output.error('order_submit', { ...{stub: stub}, ...order}); 
                } else {
                    success++;
                    this.mod.output.success('order_submit', { ...{stub: stub}, ...order}); 
                }
        
                this.results[uuid][stub][symbol].push(result);
            };
            var results = this.results[uuid][stub][symbol];
            this.mod.output.notice('processed_queue', [success, total]);   
            this.clear(stub, symbol);
            if (success == 0) {
                return false;
            }
            return results;
        } else return true;
    }


}