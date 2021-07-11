const frostybot_base = require('./classes.base')

// Frostybot Node Info Object

module.exports = class frostybot_nodeinfo extends frostybot_base {

  constructor(hostname, os, uptime, cpu, memory, ip) {
    super()
    this.hostname = hostname
    this.os = os
    this.uptime = uptime
    this.cpu = cpu
    this.memory = memory
    this.ip = ip 
  }

  
}
