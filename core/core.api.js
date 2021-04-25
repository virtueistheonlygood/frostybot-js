// API Routes

module.exports = {

    // Simple Webhook API

    '/frostybot' : {

        'post|/'                            :   'this:execute',     // Catch-all router for /frostybot Webhook
        'post|/:uuid'                       :   'this:execute',     // Catch-all router for /frostybot/:uuid Webhook (Multi User)

    },

    // Full REST API

    '/rest'      : {

    },

}

