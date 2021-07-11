const frostybot_module = require('./mod.base');
var context = require('express-http-context');
var axios = require('axios');

module.exports = class frostybot_loopback_module extends frostybot_module {

    // Constructor

    constructor() {
        super()
        this.description = 'Loopback Requests'
    }

    // Initialize module

    async initialize() {
        this.url = await global.frostybot.modules['core'].url();
    }

    // Make a Loopback Call

    async call(command, params, callback) {

        if (params.uuid == undefined) {
            params['uuid'] = context.get('uuid');
        }

        params['command'] = command;

        //this.mod.output.debug('loopback_url', [this.url]);

        // Create new request for the signal processing
        axios.post(this.url + '/frostybot',  params);

        return true;

    }

}