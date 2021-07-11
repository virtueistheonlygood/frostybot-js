const frostybot_base = require('./classes.base')

// Frostybot Output Object

module.exports = class frostybot_output extends frostybot_base {

  constructor (result, message, type, data, stats, messages) {
    
    super()
    this.result = result;
    this.message = message;
    this.type = type;
    this.data = data;
    this.stats = stats;
    this.messages = messages;
    //if (message == null) delete this.message;

  }

}