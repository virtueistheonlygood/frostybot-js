// The base class (All Frostybot classes are derived from this)

module.exports = class frostybot_base {
  constructor () {}

   // Create mapping to other modules

  async fromdatasource(data) {
    Object.keys(data).forEach(key => {
      this[key] = data[key];
    })
    if (typeof(this['update']) == 'function') await this.update();
    return this;
  }

}

