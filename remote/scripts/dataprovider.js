'use strict';

define(['require', 'socketio', 'eventemitter2', 'async', 'lodash', 'jquery', 'node-uuid'], function(requirejs, io, EventEmitter2, async, _, $, uuid) {

    var socket = io();

    var clients = {}; // {client_id => <Client>}
    var client_groups = {}; // {group_id => [<Client>]}
    var connections = {}; // {conn_id => <Connection>}

    // --------------------------------------------------------------------------------------

    function Connection(client, conn_id, config, type) {
        var conn = this;
        conn.client = client;
        conn.id = conn_id;
        conn.config = config;
        conn.type = type;
        conn.event_queue = async.queue(function(packet, cb) {
            if (packet === 'end') {
                conn.emit('end');
            } else {
                conn.emit('data', packet);
            }
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

    // send data to datapath (via socket.io)
    Connection.prototype.send = function(data) {
        var conn = this;
        if (!conn.closed) {
            var packet = {conn: conn.id, type: conn.type, data: data};
            socket.emit('dataprovider:send', packet);
        } else {
            conn.error('Unable to send msg - connection is closed');
        }
    };

    Connection.prototype.pause = function() {
        this.event_queue.pause();
    };

    Connection.prototype.resume = function() {
        this.event_queue.resume();
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

    Client.prototype.connect = function(connection_type, config) {
        var cl = this;
        if (!_.isObject(config)) throw new Error('Invalid config provided to client');
        if (!_.isString(config.source)) throw new Error('Invalid data source provided to client');

        ///
        var conn_id = config.id || 'conn:' + uuid.v4();
        var connection = new Connection(cl, conn_id, config, connection_type);
        connections[connection.id] = connection;
        cl.connections[connection.id] = connection;
        socket.emit('dataprovider:new_connection', cl.id, conn_id, connection_type, config);
        return connection;
    };

    Client.prototype.close_all = function() {
        _.each(this.connections, function(conn) {
            conn.close();
        });
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
        conn.event_queue.push('end');
        delete connections[conn_id];
        delete conn.client.connections[conn_id];
        conn.closed = true;
    });

    socket.on('dataprovider:data', function(packet) {
        var conn = connections[packet.conn];
        if (!conn) console.error("Received 'dataprovider:data' packet with no corresponding connection");
        conn.event_queue.push(packet);
    });

    socket.on('dataprovider:error', function(conn_id, err) {
        var conn = connections[conn_id];
        conn.emit('error', 'Error from datapath module \'' + conn.config.source + '\' during \'' + this.type + '\' connection: ' + err.toString());
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

        load_resource: function(resource_path, callback) {

            $.ajax({
                url: requirejs.toUrl(resource_path),
                dataType: 'text',
                success: function(data) {
                    callback(null, data);
                },
                error: function(err, a) {
                    return callback(new Error('Error loading resource: "' + resource_path + '": ' + JSON.stringify(err)));
                }
            });

        }

    };

    /////////////////////////////////////////////////////////////////////////////////////

    function rebuild_server_connections() {
        _.each(clients, function(client, client_id) {
            socket.emit('dataprovider:new_client', client_id, client.group_id);
            _.each(client.connections, function(conn, conn_id) {
                socket.emit('dataprovider:new_connection', client_id, conn_id, conn.type, conn.config);
            });
        });
    }

});
