$( document ).ready(function() {


    /* ---------------------------
        Authetication token
    ----------------------------*/    

    window['token'] = false;

    /* ---------------------------
        Websocket Data Hub
    ----------------------------*/
    
    var data = {
        positions: {},
        balances: {},
        markets: {}
    }

    /* ---------------------------
        Websocket Client
    ----------------------------*/

    window.wsclient = {

        reconnectInterval: 5000,
        reconnected: false,

        open: function(url) {

            var that = this;
            this.url = url;
            this.instance = new WebSocket(this.url);

            this.instance.onopen = function (ev) {
                if (that.reconnected)
                    window.logmessage(null, 'success', 'Websocket reconnected')
                that.onopen(ev);
            }

            this.instance.onmessage = function(data, flags) {
                that.onmessage(data, flags);
            }

            this.instance.onclose = function(e) {
                switch (e){
                    case 1000:
                        window.logmessage(null, 'warning', 'Websocket disconnected')
                        break;
                    default:
                        that.reconnect(e);
                        break;
                }
                that.onclose(e);
            }

            this.instance.onerror = function(e) {
                switch (e.code){
                    case 'ECONNREFUSED':
                        that.reconnect(e);
                        break;
                    default:
                        that.onerror(e);
                        break;
                }
            }
        },

        sendRaw: function(data, option) {
            try {
                this.instance.send(data, option);
            } catch (e) {
                this.instance.emit('error', e);
            }
        },

        send: function(content) {
            this.instance.send(content);
        },

        reconnect: function(e) {
            var that = this;
            window.logmessage(null, 'warning', 'Websocket reconnecting in ' + (this.reconnectInterval / 1000) + ' seconds.')
            setTimeout(function() {
                window.logmessage(null, 'notice', 'Websocket reconnecting in ' + (that.reconnectInterval / 1000) + ' seconds.')
                that.reconnected = true;
                that.open(that.url);
            }, this.reconnectInterval);
        },
    }

    var ws = wsclient;

    ws.onopen = function() {
        if (this.ping_timer != undefined) clearInterval(this.ping_timer)
        if (this.balance_timer != undefined) clearInterval(this.balance_timer)
        window.logmessage((new Date()).getTime(), 'success', 'Websocket connected')
        window['ping_timer'] = setInterval(function() {
            ws.send(JSON.stringify({op: 'ping'}));
        }, 10000)
        window['positions_timer'] = setInterval(function() {
            window.logmessage(null, 'notice', 'Requesting position data...')
            ws.send(JSON.stringify({op: 'positions'}))
        }, 10000)
        window['balance_timer'] = setInterval(function() {
            window.logmessage(null, 'notice', 'Requesting balance data...')
            ws.send(JSON.stringify({op: 'balances'}))
        }, 10000)
        
    };
    
    
    ws.onmessage = function (evt) { 
        var msg = evt.data;
        msg = JSON.parse(msg);
        switch (msg.code) {
            case 201    :   window.logmessage((new Date()).getTime(), 'notice', 'Websocket received ping reply')
                            break;
            case 202    :   window.logmessage((new Date()).getTime(), 'success', 'Websocket authenticated successfully')
                            window.logmessage((new Date()).getTime(), 'notice', 'Subscribing to GUI channel for content updates')
                            ws.send(JSON.stringify({op: "subscribe", channel: "gui"}));
                            break;
            case 204    :   switch (msg.type) {
                                case 'log'          :   window.logmessage(msg.data.timestamp, msg.data.type, msg.data.message)
                                                        break;

                                case 'positions'    :   window.update_positions(msg.data);
                                                        break;

                                case 'balances'     :   window.update_balances(msg.data);
                                                        break;
                            }
                            break;
        }
    };
    
    ws.onclose = function() { 
        clearInterval(window.ping_timer)
        clearInterval(window.balance_timer)
    };
      
    /* ---------------------------
        Auth Button
    ----------------------------*/

    $("#authbutton").on('click', function() {
        var params = {
            email: 'andrew.rall@gmail.com',
            password: 'Epetikij69*'
        }
        $.post( "/ui/auth", params)
            .done(function( json ) {
                var result = JSON.parse(json);
                if (result.response == 'success' ** result.token != undefined) {
                    window.token = result.token;
                    window.logmessage(null, 'success', 'Authenticated successfully, opening websocket connection')
                    ws.open('ws://127.0.0.1:8900')
                }
                return true;
            })
            .fail(function( jqxhr, textStatus, error ) {
                var err = textStatus + ", " + error;
                alert(err)
            });
    });

    /* ---------------------------
        Stub Selector Dropdown
    ----------------------------*/

    $(".fb-stub-selector").jqxDropDownList({ width: 200, height: 38, checkboxes: true, theme: 'metrodark' });


    /* ---------------------------
        Docking Layout
    ----------------------------*/

    var layout = [{
        type: 'layoutGroup',
        orientation: 'horizontal',
        items: [{
            type: 'layoutGroup',
            orientation: 'vertical',
            width: '75%',
            items: [{
                type: 'documentGroup',
                height: '70%',
                minHeight: '20%',
                items: [{
                    type: 'documentPanel',
                    title: 'Positions',
                    contentContainer: 'PositionsPanel'
                }, {
                    type: 'documentPanel',
                    title: 'Document 2',
                    contentContainer: 'Document2Panel'
                }]
            }, {
                type: 'tabbedGroup',
                height: '30%',
                pinnedHeight: '10%',
                items: [{
                    type: 'layoutPanel',
                    title: 'Error List',
                    contentContainer: 'ErrorListPanel'
                }, {
                    type: 'layoutPanel',
                    title: 'Log Viewer',
                    contentContainer: 'OutputPanel',
                    selected: true
                }]
            }]
        }, {
            type: 'tabbedGroup',
            width: '25%',
            items: [{
                type: 'layoutPanel',
                title: 'Balances',
                contentContainer: 'RightPanel'
            }]
        }]
    }];

    
    $('.layout').jqxLayout({ width: '100%', height: '100%', layout: layout, theme: 'metrodark' });


    /* --------------------------------------
        Sizing and posisitioning functions
    ---------------------------------------*/

    function get_parent_width(e) {
        return $(e).parent().width() - 3
    }

    function get_parent_height(e) {
        return $(e).parent().height() - 30
    }


    /* ---------------------------
        Positions Table
    ----------------------------*/

    var positions_data = [];

    var positions_source = {
        localData: positions_data,
        dataType: "json",
        dataFields:
        [
            { name: 'user', type: 'string', },
            { name: 'stub', type: 'string', },
            { name: 'symbol', type: 'string', },
            { name: 'type', type: 'string', },
            { name: 'direction', type: 'string', },
            { name: 'base_size', type: 'number' },
            { name: 'quote_size', type: 'number' },
            { name: 'usd_size', type: 'number' },
            { name: 'entry_price', type: 'number' },
            { name: 'current_price', type: 'number' },
            { name: 'liquidation_price', type: 'number' },
            { name: 'entry_value', type: 'number' },
            { name: 'current_value', type: 'number' },
            { name: 'pnl', type: 'number' },
            { name: 'actions', type: 'string', },
            { name: 'tvsymbol', type: 'string', },
        ]
    };
    var positions_adapter = new $.jqx.dataAdapter(positions_source);


    window['update_positions'] = function(data) {
        positions_source.localdata = data.sort((a,b) => a.user+':'+a.stub < a.user+':'+b.stub ? -1 : 1);
        $(".fb-positions-table").jqxGrid('updateBoundData');
    }


    $(".fb-positions-table").jqxGrid({
        width: get_parent_width(".fb-positions-table"),
        height: get_parent_height(".fb-positions-table"),
        source: positions_adapter,
        columnsresize: true,
        filterable: true,
        sortable: true,
        showaggregates: true,
        showstatusbar: true,
        statusbarheight: 23,
        columnsheight: 20,
        rowsheight: 20,
        theme: 'metrodark',
        showemptyrow: false,
        columnsmenu: true,
        //autosavestate: true,
        //autoloadstate: true,
        columns: [
            { text: 'Account', datafield: 'stub', width: 'auto', hideable: true, filtertype: 'checkedlist', width: 'auto', aggregates: ['count'], aggregatesrenderer: function (aggregates) { var renderstring = ""; $.each(aggregates, function (key, value) { renderstring += '<div style="position: relative; margin: 4px; overflow: hidden;"><b>Positions: </b><font>' + value +'</div>'; }); return renderstring; } },
            { text: 'Symbol', datafield: 'symbol', filtertype: 'checkedlist', width: 'auto' },
            { text: 'Type', datafield: 'type', hideable: true, filtertype: 'checkedlist', width: 75 },
            { text: 'Direction', datafield: 'direction', hideable: true, width: 80, cellclassname: function(row, column, value, data) { return data.direction == "short" ? "red" : "green" }  },
            { text: 'Base Size', datafield: 'base_size', hideable: true, width: 100, align: 'right', cellsalign: 'right', cellsformat: 'd4', cellclassname: function(row, column, value, data) { return data.direction == "short" ? "red" : "green" } },
            { text: 'Quote Size', datafield: 'quote_size', hideable: true, width: 100, align: 'right', cellsalign: 'right', cellsformat: 'd4', cellclassname: function(row, column, value, data) { return data.direction == "short" ? "red" : "green" } },
            { text: 'USD Size', datafield: 'usd_size', hideable: true, width: 100, align: 'right', cellsalign: 'right', aggregates: ['sum'], aggregatesrenderer: function (aggregates) { var renderstring = ""; $.each(aggregates, function (key, value) { renderstring += '<div style="position: relative; margin: 4px; overflow: hidden;"><b>' + value +'</b></div>'; }); return renderstring; }, cellsformat: 'c2', cellclassname: function(row, column, value, data) { return data.direction == "short" ? "red" : "green" } },
            { text: 'Entry Price', datafield: 'entry_price', hideable: true, hidden: false, width: 100, align: 'right', cellsalign: 'right', cellsformat: 'd4' },
            { text: 'Mark Price', datafield: 'current_price', hideable: true, hidden: false, width: 100, align: 'right', cellsalign: 'right', cellsformat: 'd4' },
            { text: 'Est Liq Price', datafield: 'liquidation_price', hideable: true, width: 100, align: 'right', cellsalign: 'right', cellsformat: 'd4' },
            //{ text: 'Current Value ($)', datafield: 'usd_size', width: 100, align: 'right', cellsalign: 'right', cellsformat: 'c2', cellclassname: function(row, column, value, data) { return data.pnl < 0 ? "red" : "green" }, aggregates: ['sum'] },
            { text: 'PNL', datafield: 'pnl', hideable: true, width: 100, align: 'right', aggregates: ['sum'], aggregatesrenderer: function (aggregates) { var renderstring = ""; $.each(aggregates, function (key, value) { renderstring += '<div style="position: relative; margin: 4px; overflow: hidden;"><font class="' + ((value.replace('$','').replace(',','') * 1) < 0 ? 'red' : 'green') + '"><b>' + value +'</b></font></div>'; }); return renderstring; }, cellsalign: 'right', cellsformat: 'c2', cellclassname: function(row, column, value, data) { return value < 0 ? "red" : "green" }, aggregates: ['sum'] },
            { text: 'Actions', datafield: 'actions', align: 'center', cellsalign: 'center', width: 75 },
          ]
    });

    positions_adapter.dataBind();

    $(".fb-positions-table-columnchooser").jqxButton({ width: 25, height: 25, theme: 'metrodark' });
    $(".fb-positions-table-columnchooser").on('click', function () {
        $(".fb-positions-table").jqxGrid('openColumnChooser');
    });

    /* ---------------------------
        Balances Table
    ----------------------------*/

    var balances_data = [];

    var balances_source = {
        localData: balances_data,
        dataType: "json",
        dataFields:
        [
            { name: 'user',         type: 'string', },
            { name: 'stub',         type: 'string', },
            { name: 'exchange',     type: 'string', },
            { name: 'currency',     type: 'string', },
            { name: 'base_free',    type: 'number' },
            { name: 'base_used',    type: 'number' },
            { name: 'base_total',   type: 'number' },
            { name: 'usd_free',     type: 'number' },
            { name: 'usd_used',     type: 'number' },
            { name: 'usd_total',    type: 'number' },
        ]
    };
    var balances_adapter = new $.jqx.dataAdapter(balances_source);


    window['update_balances'] = function(data) {
        balances_source.localdata = data.sort((a,b) => a.user+':'+a.stub < a.user+':'+b.stub ? -1 : 1);
        $(".fb-balances-table").jqxGrid('updateBoundData');
    }

    $(".fb-balances-table").jqxGrid({
        width: get_parent_width(".fb-balances-table"),
        autoheight: true,
        source: balances_adapter,
        columnsresize: true,
        filterable: true,
        sortable: true,
        showaggregates: true,
        showstatusbar: true,
        statusbarheight: 23,
        columnsheight: 20,
        rowsheight: 20,
        theme: 'metrodark',
        showemptyrow: false,
        columnsmenu: true,
        enablehover: false,
        selectionmode: 'none',
        //autosavestate: true,
        //autoloadstate: true,
        columns: [
            { text: 'Account', datafield: 'stub', width: 'auto', hideable: true, filtertype: 'checkedlist', width: 'auto', aggregates: ['count'], aggregatesrenderer: function (aggregates) { var renderstring = ""; $.each(aggregates, function (key, value) { renderstring += '<div style="position: relative; margin: 4px; overflow: hidden;"><b>Balances: </b><font>' + value +'</div>'; }); return renderstring; } },
            { text: 'Currency', datafield: 'currency', filtertype: 'checkedlist',  hideable: false, width: 60 },
            { text: 'Free (Base)', datafield: 'base_free', columngroup: 'base', hideable: true, hidden: true, width: 80, align: 'right', cellsalign: 'right', cellsformat: 'd4'},
            { text: 'Used (Base)', datafield: 'base_used', columngroup: 'base', hideable: true, hidden: true, width: 80, align: 'right', cellsalign: 'right', cellsformat: 'd4'},
            { text: 'Total (Base)', datafield: 'base_total', columngroup: 'base', hideable: true, hidden: true, width: 80, align: 'right', cellsalign: 'right', cellsformat: 'd4' },
            { text: 'Free (USD)', datafield: 'usd_free', columngroup: 'usd', hideable: true, width: 80, align: 'right', cellsalign: 'right', cellsformat: 'c2' },
            { text: 'Used (USD)', datafield: 'usd_used', columngroup: 'usd', hideable: true, width: 80, align: 'right', cellsalign: 'right', cellsformat: 'c2' },
            { text: 'Total (USD)', datafield: 'usd_total', columngroup: 'usd', hideable: true, width: 80, align: 'right', cellsalign: 'right', aggregates: ['sum'], aggregatesrenderer: function (aggregates) { var renderstring = ""; $.each(aggregates, function (key, value) { renderstring += '<div style="position: relative; margin: 4px; overflow: hidden;"><b>' + value +'</b></div>'; }); return renderstring; }, cellsformat: 'c2' },
        ],
        columngroups: [
            { text: 'Base Currency', align: 'center', name: 'base' },
            { text: 'USD Value', align: 'center', name: 'usd' },
        ],
      });

    balances_adapter.dataBind();

    $(".fb-balances-table").on('rowSelect', function (event) {
        var args = event.args;
        var row = args.row;
        $(".fb-balances-table").jqxGrid('unselectRow', row.uid);
    });

    $(".fb-balances-table-columnchooser").jqxButton({ width: 25, height: 25, theme: 'metrodark' });
    $(".fb-balances-table-columnchooser").on('click', function () {
        $(".fb-balances-table").jqxGrid('openColumnChooser');
    });


    /* ---------------------------
        Log Viewer
    ----------------------------*/

    $(".fb-log-panel").jqxPanel({ 
        height: get_parent_height(".fb-log-panel"), 
        width: get_parent_width(".fb-log-panel"), 
        sizeMode: 'fixed', 
        autoUpdate: true, 
        scrollBarSize: 20,
        theme: 'log'
    });

    window['logmessage'] = function(timestamp, type, message) {
        if (timestamp == null) timestamp = (new Date()).getTime();
        var datetime = (((new Date(timestamp)).toJSON().split('.'))[0]).replace('T',' ');
        message = message.replace(/\ \ /g,'&nbsp;&nbsp;');
        var cellclass = 'fb-log-' + type.toLowerCase();
        $('.fb-log-table').append('<tr><td class="' + cellclass + '">' + [datetime, '│', type.toUpperCase(), '│', message].join('</td><td class="' + cellclass + '">') + '</td></tr>');
        var height = $('.fb-log-panel').jqxPanel('getScrollHeight');
        $('.fb-log-panel').jqxPanel('scrollTo', 0, height);
    }

    $(".fb-log-filter").jqxDropDownList({ 
        width: 200, 
        height: 20, 
        checkboxes: true, 
        dropDownHeight: 150,
        theme: 'metrodark',
    });

    /* ---------------------------------
        Autologin and start websocket
    ----------------------------------*/    

    setTimeout(function () {
        ws.open('ws://127.0.0.1:8900')
    }, 2000);

});