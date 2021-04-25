// Frostybot Module Base Class

module.exports = class frostybot_module_base {

    // Constructor

    constructor() {
    }

    // Create mapping to other modules

    mod_map() {
        this['mod'] = global.frostybot.modules;
        this['classes'] = global.frostybot.classes;
        this['database'] = global.frostybot.modules['database'];
    }

    // Create Module Mappings

    module_maps() {
        const modname = this.constructor.name.replace('frostybot_','').replace('_module','')
        Object.keys(global.frostybot.modules).forEach(module => {
            if (!['core', modname].includes(module)) {
                this[module] = global.frostybot.modules[module];
            }
        })
    }

    // Create a module link

    link(module) {
        this[module] = global.frostybot.modules[module];
    }

// Add /frostybot webhook
/*
api['/frostybot'] = {

    'post|/'                            :   'this:execute',     // Catch-all router for /frostybot Webhook
    'post|/:uuid'                       :   'this:execute',     // Catch-all router for /frostybot/:uuid Webhook (Multi User)

}
*/
    // Register published module and method

    register_api_command(command, permissions) {
        var commandobj = new this.classes.command(command, permissions);
        global.frostybot.commands[command] = commandobj;
        var [module, method] = command.split(':');
        if (global.frostybot.methodmap[module] == undefined) global.frostybot.methodmap[module] = [];
        global.frostybot.methodmap[module].push(method);
    }

    // Register command and endpoints with the REST and Webhook APIs

    register_api_endpoint(command, endpoints, permissions) {
        // Prepare storage if required
        if (global.frostybot.api['/rest'] == undefined) global.frostybot.api['/rest'] = {};
        this.register_api_command(command, permissions);
        // Cycle through endpoints and map them to the command
        if (typeof(endpoints) == 'string') endpoints = [endpoints];
        if (this.mod.utils.is_array(endpoints)) {
            endpoints.forEach(endpoint => {
                global.frostybot.api['/rest'][endpoint] = command;
            })
        }
    }


}