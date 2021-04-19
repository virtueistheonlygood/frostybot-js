// Frostybot Module Base Class

module.exports = class frostybot_module_base {

    // Constructor

    constructor() {
    }

    // Create mapping to other modules

    mod_map() {
        this['mod'] = global.frostybot._modules_;
        this['classes'] = global.frostybot._classes_;
        this['database'] = global.frostybot._modules_['database'];
    }

    // Create Module Mappings

    module_maps() {
        const modname = this.constructor.name.replace('frostybot_','').replace('_module','')
        Object.keys(global.frostybot._modules_).forEach(module => {
            if (!['core', modname].includes(module)) {
                this[module] = global.frostybot._modules_[module];
            }
        })
    }

    // Create a module link

    link(module) {
        this[module] = global.frostybot._modules_[module];
    }


}