'use strict';

define(['socketio', 'eventemitter2', 'async', 'lodash', 'node-uuid'], function(io, EventEmitter2, async, _, uuid) {

    var socket = io();

    var clients = {}; // {client_id => <Client>}
    var client_groups = {}; // {group_id => [<Client>]}
    var connections = {}; // {conn_id => <Connection>}

    // --------------------------------------------------------------------------------------

    function Connection(client, conn_id, datasource, type) {
        var conn = this;
        conn.client = client;
        conn.id = conn_id;
        conn.datasource = datasource;
        conn.type = type;
        conn.data_queue = async.queue(function(packet, cb) {
            conn.emit('data', packet);
            cb();
        }, 1);
        conn.closed = false;
    }

    Connection.prototype = Object.create(EventEmitter2.prototype, {
        constructor: {
            value: Connection,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });

    // Actions run from client

    // send data to datasource (via socket.io)
    Connection.prototype.send = function(data) {
        var conn = this;
        if (!conn.closed) {
            var packet = {conn: conn.id, ds: conn.datasource, type: conn.type, data: data};
            socket.emit('dataprovider:send', packet);
        } else {
            conn.error('Unable to send msg - connection is closed');
        }
    };

    Connection.prototype.pause = function() {
        this.data_queue.pause();
    };

    Connection.prototype.resume = function() {
        this.data_queue.resume();
    };

    Connection.prototype.close = function() {
        socket.emit('dataprovider:close_connection', this.id);
        delete this.client.connections[this.id];
        this.closed = true;
    };

    // --------------------------------------------------------------------------------------

    function Client(client_id, group_id) {
        if (!(this instanceof Client)) return Client.apply(Object.create(Client.prototype), arguments);
        this.id = client_id;
        this.group_id = group_id;
        this.connections = {};
        return this;
    }

    Client.prototype = Object.create(EventEmitter2.prototype, {
        constructor: {
            value: Client,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });

    Client.prototype.connect = function(connection_type, datasrc, config) {
        config = _.isObject(config) ? config : {};
        var cl = this;
        var ds = datasrc.split(':');
        if (!ds[0]) throw Error('Invalid datasource: ' + datasrc);
        var conn_id = config.id || 'conn:' + uuid.v4();
        var connection = new Connection(cl, conn_id, datasrc, connection_type);
        connection.config = config;
        connections[connection.id] = connection;
        cl.connections[connection.id] = connection;
        socket.emit('dataprovider:new_connection', cl.id, conn_id, connection_type, datasrc, config);
        return connection;
    };

    Client.prototype.error = function(err) {
        console.error('Dataprovider client error: ' + err.toString());
    };

    // ----------------------------------------------------------------------------------

    // Top-level socket.io events

    socket.on('disconnect', function(reason) {
        console.error('Disconnected from server: ' + reason);
    });

    socket.on('reconnecting', function(attempt) {
        console.log('Attempting reconnect #' + attempt + ' ...');
    });

    socket.on('reconnect', function(attempts) { // fired upon a successful reconnection
        console.log('Reconnected after ' + attempts + ' attempts');
        rebuild_server_connections();
    });

    socket.on('reconnect_error', function(err) {
        console.error('Failed to reconnect: ' + err.toString());
    });
    socket.on('reconnect_failed', function(attempts) {
        console.error('Giving up - failed to reconnect after ' + attempts + ' attempts');
    });

    // Dataprovider events

    socket.on('dataprovider:close_connection', function(conn_id) {
        var conn = connections[conn_id];
        conn.emit('end');
        delete connections[conn_id];
        delete conn.client.connections[conn_id];
        this.closed = true;
    });

    socket.on('dataprovider:data', function(packet) {
        var conn = connections[packet.conn];
        if (!conn) console.error("Received 'dataprovider:data' packet with no corresponding connection");
        conn.data_queue.push(packet);
    });

    socket.on('dataprovider:error', function(conn_id, err) {
        var conn = connections[conn_id];
        var ds = conn.datasource.split('.');
        conn.emit('error', 'Error from datasource module \'' + ds[0] + '\' during \'' + this.type + '\' connection: ' + err.toString());
    });

    return {

        register: function(client_id, group_id) {
            client_id = client_id || 'client:' + uuid.v4();
            group_id = group_id || 'grp:' + uuid.v4();
            var client = new Client(client_id, group_id);
            socket.emit('dataprovider:new_client', client_id, group_id);
            clients[client_id] = client;
            if (!_.has(client_groups, group_id)) client_groups[group_id] = [];
            client_groups[group_id] = client;
            return client;
        },

        unregister: function(client) {
            clients = _.reject(clients, function(cl) {
                return cl === client;
            });
            socket.emit('dataprovider:remove_client', client.id);

            // TODO: remove other references
        },

    };

    /////////////////////////////////////////////////////////////////////////////////////

    function rebuild_server_connections() {
        _.each(clients, function(client, client_id) {
            socket.emit('dataprovider:new_client', client_id, client.group_id);
            _.each(client.connections, function(conn, conn_id) {
                socket.emit('dataprovider:new_connection', client_id, conn_id, conn.type, conn.datasource, conn.config);
            });
        });
    }

});
