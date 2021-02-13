// ---------------------------------------------------------
//   API
// ---------------------------------------------------------

function api(command, params, callback) {
    params['command'] = command;
    var token = getToken();
    if (token != null) {
        params['token'] = token;
    }
    $.post( "/frostybot", params)
        .done(function( json ) {
            callback(json);
        })
        .fail(function( jqxhr, textStatus, error ) {
            var err = textStatus + ", " + error;
        });
}


function getUUID() {
    if (localStorage) {
        var token = localStorage.getItem("token");
        if (token != null) {
            var token = JSON.parse(token);
            if (token != null && token.hasOwnProperty('uuid')) {
                var uuid = token.uuid;
               return uuid;
            }
        }
    }
    return null;
}

function getToken() {
    if (localStorage) {
        var token = localStorage.getItem("token");
        if (token != null) {
            var token = JSON.parse(token);
            if (token != null) {
               return token;
            }
        }
    }
    return null;
}