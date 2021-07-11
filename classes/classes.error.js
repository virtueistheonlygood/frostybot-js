// Frostybot Error Object

module.exports = class frostybot_error extends Error {

  constructor (message, code = undefined) {
    super (message);
    this.message = message;
    this.code = code;
  }

}
