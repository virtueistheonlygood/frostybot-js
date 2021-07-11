$( document ).ready(function() {
    
    // ---------------------------------------------------------
    //   Show Toast Message
    // ---------------------------------------------------------

    $("#info").jqxNotification({ width: 300, appendContainer: "#frostybot-notifications", opacity: 0.9, autoClose: true, autoCloseDelay: 5000, template: "info" });
    $("#warning").jqxNotification({ width: 300, appendContainer: "#frostybot-notifications", opacity: 0.9, autoClose: true, autoCloseDelay: 5000, template: "warning" });
    $("#success").jqxNotification({ width: 300, appendContainer: "#frostybot-notifications", opacity: 0.9, autoClose: true, autoCloseDelay: 5000, template: "success" });
    $("#error").jqxNotification({ width: 300, appendContainer: "#frostybot-notifications", opacity: 0.9, autoClose: true, autoCloseDelay: 5000, template: "error" });

    function createNotification(type, message) {
        var icons = {
            info: 'fa-info-circle',
            warning: 'fa-exclamation-triangle',
            success: 'fa-check-circle',
            error: 'fa-exclamation-circle',
        }
        var id = "#" + type.toLowerCase()
        $(id).html('<div><span class="fa ' + icons[type] + '"></span> ' + message + '</div>');
        $(id).jqxNotification("open");

    }

    // Show success toast message
    var showSuccess = function(message, time=2000) {
        createNotification('success', message);
    }

    // Show notice toast message
    var showNotice = function(message, time=2000) {
        createNotification('info', message);
    }

    // Show warning toast message
    var showWarning = function(message, time=2000) {
        createNotification('warning', message);
    }

    // Show error toast message
    var showError = function(message, time=2000) {
        createNotification('error', message);
    }

    // ---------------------------------------------------------
    //   Cache Subsystem
    // ---------------------------------------------------------

    function cache_get(key) {
        if (localStorage)
            var data = localStorage.getItem('cache:' + key);
            if (data != null) 
                return JSON.parse(data);
        return null;
    }

    function cache_set(key, data) {
        if (localStorage)
            localStorage.setItem('cache:' + key, JSON.stringify(data));
    }

    function cache_api(command, params, callback) {
        var key = md5(command + JSON.stringify(params));
        var data = cache_get(key);
        if (data == null) {
            api(command, params, function(result) {
                cache_set(key, result);
                callback(result);
            });
        } else 
            return data;
    }


    // --------------------------------------------------------------------------------------
    //  Websocket Client
    // --------------------------------------------------------------------------------------

    /*
    var frostybot_wss = new WebSocket("ws://127.0.0.1:8900")
    var wss_is_authenticated = false

    frostybot_wss.onopen = function() {
        setInterval(function() {
            frostybot_wss.send(JSON.stringify({op: "PING"}));
            if (wss_is_authenticated == false) {
                var token = getToken()
                if (token != null) {
                    frostybot_wss.send(JSON.stringify({op: "auth", token: token}));
                }
            }
        }, 5000)
    };
    
    
    frostybot_wss.onmessage = function (evt) { 
        var msg = evt.data;
        msg = JSON.parse(msg);
        switch (msg.code) {
            case 201    :   console.log('PONG received');
                            break;
            case 202    :   console.log('Websocket authenticated')
                            wss_is_authenticated = true
                            console.log('Subscribing to GUI channel')
                            frostybot_wss.send(JSON.stringify({op: "subscribe", channel: "gui"}));
                            break;
            case 204    :   switch (msg.type) {
                                case 'positions'    :   var stub = msg.data.length > 0 ? msg.data[0].stub : null;
                                                        if (stub != null)
                                                            localStorage.setItem(['positions', stub].join(':'), JSON.stringify(msg.data));
                                                        break;
                                case 'balances'     :   var stub = msg.data.length > 0 ? msg.data[0].stub : null;
                                                        if (stub != null)
                                                            localStorage.setItem(['balances', stub].join(':'), JSON.stringify(msg.data));
                                                        break;
                            }
                            break;
        }
    };
    
    frostybot_wss.onclose = function() { 
        console.log("Websocket connection is closed..."); 
        wss_is_authenticated = false;
    };
      
    
    function subscribe(stub, channel, symbol = null) {
        if (symbol != null) {
          var data = { symbol : symbol };
        } else {
          var data = {};
        }
        $.post(frostybot_rest + '/websocket/' + stub + '/subscribe/' + channel, data, function( data ) {
          //$( ".result" ).html( data );
        });  
    }
    */

    // ---------------------------------------------------------
    //   AJAX Loading Icon
    // ---------------------------------------------------------

    $(document).ajaxStart(function() {
        $(".loading").show();
    });

    $(document).ajaxStop(function() {
        $(".loading").hide();
    });

    $(".loading").hide();

    // ---------------------------------------------------------
    //   Form field validators
    // ---------------------------------------------------------

    function validateEmail(mail) {
        if (/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)*$/.test(mail)) {
            return true
        }
        return false
    }

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

    function setConfig(keyname, val) {
        api('config:set', {keyname: val}, function(json) {
            if (json.result == "success") {
                showSuccess("Successfully set configuration option: " + keyname + " => " + val, 5000);
                return true;
            } else {
                showError("Failed to set set configuration option: " + keyname, 5000);
            }
            return false;
        });
    }

    function loadPage(key) {
        document.location.href = key;
        setTimeout(function () { updateContent('menu_main'); }, 2000);
    }


    var defaultContent = {
    }

    var contentHooks = {
    }

    function updateContent(key, params = {}, callback = null) {
        var token = getToken();
        if (token != null) {
            params['token'] = token;
        }
        $.get( "/ui/content/" + key, params)
        .done(function( html ) {
            if (html.error !== undefined) {
                if (html.error == 'invalid_token') {
                    localStorage.setItem("token", null);
                    loadPage('/ui/login?sessiontimeout=true');
                }
            } else {
                $('#'+key).html( html);
                if (defaultContent.hasOwnProperty(key)) {
                    defaultContent[key].forEach(subkey => {
                        updateContent(subkey, {});
                    });
                }
                if (contentHooks.hasOwnProperty(key)) {
                    contentHooks[key]();
                }
                if (callback != null)
                    callback();
            }
        })
        .fail(function( jqxhr, textStatus, error ) {
            var err = textStatus + ", " + error;
        });
    }

    // ---------------------------------------------------------
    //   Session Management
    // ---------------------------------------------------------


    function checkTokenValidity() {
        if (localStorage) {
            var token = localStorage.getItem("token");
            if (token != null) {
                var token = JSON.parse(token);
                if (token != null && token.hasOwnProperty('expiry')) {
                    var expiry = token.expiry;
                    var ts = (new Date()).getTime();
                    if (ts > expiry) {
                        localStorage.setItem("token", null);
                        loadPage('/ui/login?sessiontimeout=true');
                    }
                }
            }
        }
    }

    setInterval(checkTokenValidity, 1000);

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

    function updateHeaderUUID() {
        if (localStorage) {
            var token = localStorage.getItem("token");
            if (token != null) {
                var token = JSON.parse(token);
                if (token != null && token.hasOwnProperty('uuid')) {
                    var uuid = token.uuid;
                    $('#header_uuid').html('<b>UUID:</b> ' + uuid);
                }
            }
        }
    }
    
    updateHeaderUUID();

    $('#tabs-logout-tab').on('click', function() {
        if (localStorage) 
            localStorage.setItem("token", null);
        loadPage('/ui/login');
    });

    // ---------------------------------------------------------
    //  User Registration
    // ---------------------------------------------------------

    function submitRegistrationForm() {
        var email = $("#inputemail").val();
        var password = $("#inputpassword").val();
        var confirm = $("#inputconfirm").val();
        if (!validateEmail(email)) {
            showError('Invalid email address');
            return false;
        }
        if (password != confirm) {
            showError('Password and confirm password do not match');
            return false;
        }
        var data = {
            email: email,
            password: password
        }
        api('user:register', data, function(json) {
            if (json.result == "success") {
                loadPage('/ui/login?regsuccess=true');
            } else {
                showError("Failed to register user.", 5000)
            }
        });

    }    

    $("#registerform").submit(function(event){
        event.preventDefault();
        var recaptchasite = $("#registerform").data('recaptchasite');
        if (recaptchasite == false) {
            submitRegistrationForm();    
        } else {
            grecaptcha.ready(function() {
                grecaptcha.execute(recaptchasite, {action: 'register'}).then(function(response) {
                    api('gui:verify_recaptcha', {response: response}, function(json) {
                        if (json.result == "success") 
                            submitRegistrationForm();
                        else
                            showError('reCaptcha Failure');
                    });
                });
            });
        }
    });

    // ---------------------------------------------------------
    //  User Login
    // ---------------------------------------------------------

    function submitLoginForm() {
        var email = $("#inputemail").val();
        var password = $("#inputpassword").val();
        var token2fa = $("#input2fa").val();
        if (!validateEmail(email)) {
            showError('Invalid email address');
            return false;
        }
        var data = {
            email: email,
            password: password,
            token2fa: token2fa
        }
        api('user:login', data, function(json) {
            if (json.result == "success") {
                var token = json.data;
                var uuid = token.uuid;
                if(localStorage)
                    localStorage.setItem("token", JSON.stringify(token));
                //wsAuth(token);
                loadPage('/ui');
            } else {
                showError("Login failed. Please check your credentials and try again.", 5000)
            }
        });

    }    

    $("#loginform").submit(function(event){
        event.preventDefault();
        var recaptchasite = $("#loginform").data('recaptchasite');
        if (recaptchasite == false) {
            submitLoginForm();    
        } else {
            grecaptcha.ready(function() {
                grecaptcha.execute(recaptchasite, {action: 'login'}).then(function(response) {
                    api('gui:verify_recaptcha', {response: response}, function(json) {
                        if (json.result == "success") {
                            submitLoginForm();
                        } else
                            showError('reCaptcha Failure');
                    });
                });
            });
        }
    });


    // ---------------------------------------------------------
    //   Main Content
    // ---------------------------------------------------------

    contentHooks['menu_main'] = function() {

        $(".frostybot-tab-main").each(function( index, element ) {
            if (!$(this).is( "#tab_accounts")) {
                $(this).hide();
            }
        });

        $('#mainmenu').on('itemclick', function (event) {
            // get the clicked LI element.
            var element = event.args;
            var tab_id = $('#' + element.id).data('content');
            updateContent(tab_id, {}, function() {
                $("#" + tab_id).show();
            
                $(".frostybot-tab-main").each(function( index, element ) {
                    if ($(this).is( "#" + tab_id)) {
                        localStorage.setItem("currentPage", tab_id);
                        $(this).show();
                    } else {
                        $(this).hide();
                    }
                });
                //if (tab_id == 'tab_accounts') {
                //    updateContent('table_accounts', {});
                //}
            });
            
        });

    }

    // ---------------------------------------------------------
    //   Branding
    // ---------------------------------------------------------

    updateContent("logo");

    // ---------------------------------------------------------
    //   Accounts Tab : Accounts Table
    // ---------------------------------------------------------
    
    updateContent('tab_accounts');

    // Accounts Tab Default Content
    defaultContent['tab_accounts'] = ['table_accounts', 'menu_main'];

    // Account Table Content Hooks
    contentHooks['table_accounts'] = function() {

        // Set Page Title
        $( "#accountstitle" ).html('Accounts');

        // Show/Hide Content
        $( "#table_accounts" ).show();
        $( "#accountsnavbar" ).show();
        $( "#form_accounts" ).hide();
        
        // Add Account Button
        $( "#addaccountlink" ).on( "click", function() {
            updateContent('form_accounts');
        });

        // Refresh Accounts Table
        $( "#accountsrefreshlink" ).on( "click", function() {
            updateContent('table_accounts');
        });    

        // Test Account
        $( ".testaccountlink" ).on( "click", function() {
            var stub = $(this).attr('data-stub');
            api('accounts:test', { stub: stub}, function(json) {
                if (json.result == "success") {
                    showSuccess('Account tested successfully: ' + stub);
                } else {
                    showFail('Account test failed: ' + stub)
                }
            });    
        });

        // Edit Account
        $( ".editaccountlink" ).on( "click", function() {
            var stub = $(this).attr('data-stub');
            updateContent('form_accounts', {stub: stub});
        });

        // Delete Account
        $( ".deleteaccountlink" ).on( "click", function() {
            if (confirm("Are you sure you wish to delete this account?")) {
                var stub = $(this).attr('data-stub');
                api('accounts:delete', { stub: stub}, function(json) {
                    if (json.result == "success") {
                        showSuccess('Account deleted successfully');
                        updateContent('tab_accounts');
                        updateContent('menu_main');
                    } else {
                        showFail('Failed to delete Account')
                    }
                });            
            }
        });

        // Account Config
        $( ".configlink" ).on( "click", function() {
            var stub = $(this).attr('data-stub');
            updateContent('form_config', {stub: stub})
        });

    }

    // ---------------------------------------------------------
    //   Accounts Tab : Accounts Form
    // ---------------------------------------------------------
    

    // Accounts Form Content Hooks
    contentHooks['form_accounts'] = function() {

        // Show/Hide Content
        $( "#table_accounts" ).hide();
        $( "#accountsnavbar" ).hide();
        $( "#form_accounts" ).show();
        
        // Set Page Title
        $( "#accountstitle" ).html('Configure Account');

        // Dynamic Form Fields        
        function accountsFormDynamicFields() {
            var val = $( "#inputexchange").val();
            if (['binanceus','ftx','ftxus'].includes(val)) {
                $( "#testnetfield" ).hide();
            } else {
                $( "#testnetfield" ).show();
            }
            if (['ftx','ftxus'].includes(val)) {
                $( "#subaccountfield" ).show();
            } else {
                $( "#subaccountfield" ).hide();
            }
        }

        $( "#inputexchange" ).on( "change", function() {
            accountsFormDynamicFields();
        });

        $( "#inputexchange" ).on( "click", function() {
            $("#inputexchange option[value='']").remove();
        });

        accountsFormDynamicFields();

        // Submit  Form
        $("#accountsform").submit(function(event){
            event.preventDefault();
            var ex = $("#inputexchange").val();
            var [exchange, type] = ex.split('_');
            var data = {
                uuid: getUUID(),
                stub: $("#inputstub").val(),
                exchange: exchange,
                type: type,
                testnet: $("#inputtestnet").is(":checked"),
                apikey: $("#inputapikey").val(),
                secret: $("#inputsecret").val(),
                description: $("#inputdescription").val(),
                subaccount: $("#inputsubaccount").val()
            }
            api('accounts:add', data, function(json) {
                if (json.result == "success") {
                    showSuccess("Successfully added API key", 5000);
                    updateContent('menu_main');
                    updateContent('table_accounts');
                } else {
                    showError("Failed to add account, please check the API key and secret and try again.", 5000)
                }
            });
        });
    
        // Cancel Form
        $( "#accountscancel" ).on( "click", function() {
            // Show/Hide Content
            $( "#table_accounts" ).show();
            $( "#accountsnavbar" ).show();
            $( "#form_accounts" ).hide();
            // Set Page Title
            $( "#accountstitle" ).html('Accounts');
        });

    }


    // ---------------------------------------------------------
    //   Accounts Tab : Account Config Management
    // ---------------------------------------------------------

    // Account Config Form Content Hooks
    contentHooks['form_config'] = function() {

        // Show Form
        $( "#table_accounts" ).hide();
        $( "#accountsnavbar" ).hide();
        $( "#form_config" ).show();

        var formLoaded = false;
        setTimeout(function() {
            formLoaded = true;
        }, 1000);

        // Set title
        $( "#accountstitle" ).html('Configuration Options');

        // Update Function
        function update(keyname, val) {
            var data = {};
            data[keyname] = String(val == '' ? "null" : val).replace('None','null');
            api('config:set', data, function(json) {
                if (keyname.substr(-7) == ':listed') {
                    var mode = $( "#pairmode").jqxSwitchButton('checked') == true ? 'whitelisted' : 'blacklisted';
                    keyname = keyname.replace(':listed', ':' + mode)
                }
                if (json.result == "success") {
                    showSuccess("Successfully set configuration option: " + keyname, 5000);
                    return true;
                } else {
                    showError("Failed to set set configuration option: " + keyname, 5000);
                }
                return false;
            });
        }

        // Get pair blacklist/whitelist mode
        function getPairMode() {
            return $("#configpairs").jqxGrid('getcolumnproperty', 'listed', 'text').toLowerCase();
            //return $( "#pairmode").jqxSwitchButton('checked') == true ? 'blacklist' : 'whitelist';
        }

        // Load Pair Config Grid
        $("#configpairs").on('cellendedit', function (event) {
            var stub = $( "#inputproviderstub" ).val();
            var column = $("#configpairs").jqxGrid('getcolumn', event.args.datafield);
            var symbol = event.args.row.symbol;
            var field = event.args.datafield;
            var keyname = stub + ":" + symbol + ":" + field;
            if (column.displayfield != column.datafield) {
                var val = event.args.value.value;
            } else {
                var val = event.args.value;
            }
            update(keyname, val);
            
        });

        // Load Combo Boxes
        if ( $("#inputprovider").length ) {
            $("#inputprovider").jqxDropDownList({ dropDownHeight: 250, width: 150, height: 30, autoDropDownHeight: true});
        }
        $("#inputmaxposqty").jqxDropDownList({ dropDownHeight: 250, width: 150, height: 30});
        $("#inputdcascale").jqxComboBox({ dropDownHeight: 250, width: 150, height: 30});
        $("#inputdefstoptrigger").jqxComboBox({ dropDownHeight: 250, width: 150, height: 30});
        $("#inputdefprofittrigger").jqxComboBox({ dropDownHeight: 250, width: 150, height: 30});
        $("#inputdefprofitsize").jqxComboBox({ dropDownHeight: 250, width: 150, height: 30});
        //$("#inputdisablelossclose").jqxCheckBox({ width: 180, height: 25});
        //$('#lossclose').jqxSwitchButton({ height: 25, width: 145, checked: disablelossclose, onLabel: 'Allowed', offLabel: 'Never', thumbSize: '20%'});
                    
        // Signal Provider Update

        $( "#inputprovider").on('change', function() {
            var stub = $( "#inputproviderstub" ).val();
            var val = $( "#inputprovider" ).val();
            update(stub + ':provider', val);
        });

        // Max Positions Update

        $( "#inputmaxposqty").on('change', function() {
            var stub = $( "#inputproviderstub" ).val();
            var val = $( "#inputmaxposqty" ).val();
            update(stub + ':maxposqty', val);
        });

        // Default Size Update

        $( "#inputdefsize").on('blur', function() {
            var stub = $( "#inputproviderstub" ).val();
            var val = $( "#inputdefsize" ).val();
            update(stub + ':defsize', val);
        });

        // DCA Scale Size Update

        $( "#inputdcascale").on('change', function() {
            var stub = $( "#inputproviderstub" ).val();
            var val = $( "#inputdcascale" ).val();
            if (formLoaded) update(stub + ':dcascale', val);
        });

        // Default Stop Trigger Update

        $( "#inputdefstoptrigger").on('change', function() {
            var stub = $( "#inputproviderstub" ).val();
            var val = $( "#inputdefstoptrigger" ).val();
            if (formLoaded) update(stub + ':defstoptrigger', val);
        });

        // Default Take Profit Update
        $( "#inputdefprofittrigger").on("change", function() {
            var stub = $( "#inputproviderstub" ).val();
            var val = $( "#inputdefprofittrigger" ).val();
            if (formLoaded) update(stub + ':defprofittrigger', val);
        });

        // Default Profit Size Update
        $( "#inputdefprofitsize").on("change", function() {
            var stub = $( "#inputproviderstub" ).val();
            var val = $( "#inputdefprofitsize" ).val();
            if (formLoaded) update(stub + ':defprofitsize', val);
        });

        // Disable Close at Loss Update
        /*
        $( "#inputdisablelossclose").on("change", function(event) {
            var checked = event.args.checked;
            var stub = $( "#inputproviderstub" ).val();
            if (formLoaded) update(stub + ':disablelossclose', checked);
        });
        */
        $( "#lossclose").on("change", function(event) {
            var stub = $( "#inputproviderstub" ).val();
            var checked = !($( "#lossclose").jqxSwitchButton('checked'));
            if (formLoaded) update(stub + ':disablelossclose', checked);
        });
        
        $( "#pairmode").on("change", function(event) {
            var stub = $( "#inputproviderstub" ).val();
            var mode = $( "#pairmode").jqxSwitchButton('checked') == true ? 'blacklist' : 'whitelist';
            update(stub + ':pairmode', mode)
            /*
            if (formLoaded) {
                $("#configpairs").jqxGrid({disabled: true});
                $( "#pairmode").jqxSwitchButton({disabled: true});
                updateContent('form_config', {stub: stub, switchpairmode: mode}, function() {
                    showSuccess('Switched the pair selection mode successfully', 3000)
                })
            }
            */
        });
        

        // Check to enable the set leverage button
        $("#inputlevtypecross").on("change", function() {
            var cross = $("#inputlevtypecross").val();
            var isolated = $("#inputlevtypeisolated").val();
            var leverage = $("#inputlevsize").val();
            if ((cross == true || isolated == true) && (leverage != '')) {
                $("#setleverage").attr("disabled", false);
            } else {
                $("#setleverage").attr("disabled", true);
            }
        });

        $("#inputlevtypeisolated").on("change", function() {
            var cross = $("#inputlevtypecross").val();
            var isolated = $("#inputlevtypeisolated").val();
            var leverage = $("#inputlevsize").val();
            if ((cross == true || isolated == true) && (leverage != '')) {
                $("#setleverage").attr("disabled", false);
            } else {
                $("#setleverage").attr("disabled", true);
            }
        });

        $("#inputlevsize").on("change", function() {
            var cross = $("#inputlevtypecross").val();
            var isolated = $("#inputlevtypeisolated").val();
            var leverage = $("#inputlevsize").val();
            if ((cross == true || isolated == true) && (leverage != '')) {
                $("#setleverage").attr("disabled", false);
            } else {
                $("#setleverage").attr("disabled", true);
            }
        });

        // Set Global Leverage

        $("#setleverage").on( "click", function() {
            if (confirm("WARNING: Be careful when using this feature. This will set the global leverage across all pairs. If you are currently in a position for any of these pairs, incorrectly setting the leverage may result in liquidation. Once started, this process will run in the background. You can continue to use Frostybot and can monitor the process of this task via the Log Viewer.")) {
                var stub = $( "#inputproviderstub" ).val();
                var cross = $("#inputlevtypecross").val();
                var isolated = $("#inputlevtypeisolated").val();
                var leverage = $("#inputlevsize").val();
                var type = cross == true ? 'cross' : (isolated == true ? 'isolated' : null)
                var data = {
                    stub: stub,
                    type: type,
                    leverage: leverage
                }
                api('trade:globalleverage', data, function(json) {
                    if (json.result == "success") {
                        showSuccess("Successfully set leverage", 5000);
                    } else {
                        showError("Failed to set leverage, please check log for details.", 5000)
                    }
                });    
            }
        });

        // Cancel Button
        $( "#configcancel" ).on( "click", function() {
            $( "#table_accounts" ).show();
            $( "#accountsnavbar" ).show();
            $( "#form_config" ).hide();
            $( "#accountstitle" ).html('Accounts');
    
        }); 

    }

    // ---------------------------------------------------------
    //   Positions Tab
    // ---------------------------------------------------------

    contentHooks['tab_positions'] = function() {


    }


    // ---------------------------------------------------------
    //   PNL Tab
    // ---------------------------------------------------------

    contentHooks['tab_pnl'] = function() {


    }


    // ---------------------------------------------------------
    //   Security Tab : Change Password Form
    // ---------------------------------------------------------

    // Secuurity Tab Content Hooks
    contentHooks['tab_security'] = function () {
        
        // Load 2FA form
        updateContent('form_2fa', {});

        // Submit Change Password Form
        $("#changepasswordform").submit(function(event){
            event.preventDefault();
            var oldpassword = $('#inputoldpassword').val();
            var newpassword = $('#inputnewpassword').val();
            var confirmpassword = $('#inputconfirmpassword').val();
            if (newpassword != confirmpassword) {
                showError('New password and confirm password do not match');
                return false;
            }
            if (newpassword == "") {
                showError('New password cannot be blank');
                return false;
            }
            var uuid = getUUID();
            var data = {
                uuid: uuid,
                oldpassword: oldpassword,
                newpassword: newpassword
            }
            api('user:change_password', data, function(json) {
                if ((json.result == "success") && (json.data == true)) {
                    showSuccess("Successfully changed password", 5000);
                    $('#inputoldpassword').val('');
                    $('#inputnewpassword').val('');
                    $('#inputconfirmpassword').val('');
                } else {
                    showError("Failed to change password, please ensure you supplied the correct old password.", 5000)
                }
            });
        });

    };

    // ---------------------------------------------------------
    //   Security Tab : 2FA Form
    // ---------------------------------------------------------

    // Account Config Form Content Hooks
    contentHooks['form_2fa'] = function() {

        // Enable 2FA button
        $( "#enable2fabutton" ).on( "click", function() {
            updateContent('form_2fa', {enable: true});        
        });

        // Verify 2FA Submit

        $( "#formregister2fa" ).submit(function(event){
            event.preventDefault();
            var token = $( "#input2faverify" ).val();
            var secret = $('#input2fasecret').val();
            var data = {
                key: secret,
                checktoken: token
            }
            api('user:enable_2fa', data, function(json) {
                if ((json.result == "success") && (json.data == true)) {
                    showSuccess('2FA Enabled');
                    updateContent('form_2fa', {});
                } else {
                    showError('There was an error enabling 2FA, please verify your token');
                }
            });
        });    

        // Unregister 2FA 
        $( "#formunregister2fa" ).submit(function(event){
            event.preventDefault();
            var token = $('#input2faverify').val();
            var data = {
                checktoken: token
            }
            api('user:disable_2fa', data, function(json) {
                if ((json.result == "success") && (json.data == true)) {
                    showSuccess('2FA Disabled');
                    updateContent('form_2fa', {});
                } else {
                    showError('There was an error disbling 2FA, please verify your token');
                }
            });
        });
    
    };


    // ---------------------------------------------------------
    //   Log Viewer
    // ---------------------------------------------------------

    contentHooks['tab_logviewer'] = function() {

    }

    // ---------------------------------------------------------
    //   Logout 
    // ---------------------------------------------------------


    contentHooks['tab_logout'] = function() {

    }
    
    
});