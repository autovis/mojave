'use strict';

var fs = require('fs');
var path = require('path');

var requirejs = require('requirejs');

var async = requirejs('async');
var EventEmitter2 = requirejs('eventemitter2');
var _ = requirejs('lodash');
var uuid = requirejs('node-uuid');

// --------------------------------------------------------------------------------------

var io;
var clients = {}; // {client_id => <Client>}
var client_groups = {}; // {group_id => [<Client>]}
//var group_datasources = {}; // {group_id => [datasource]}
var socket_clients = {}; // {socket_id => [client_id]}
var connections = {}; // {conn_id => <Connection>}

module.exports = function(io_) {
    if (io_) io = io_;

    // load datasource modules
    // {dsname => <module>}
    var datasources = _.object(fs.readdirSync(path.join(__dirname, '../datasources')).map(function(ds) {
        return [_.first(ds.split('.')), require(path.join(__dirname, '../datasources', ds))];
    }));

    // ----------------------------------------------------------------------------------

    function Connection(client, conn_id, datasource, type) {
        var conn = this;
        conn.client = client;
        conn.id = conn_id;
        conn.datasource = datasource;
        conn.type = type;
        conn.module = null; // module loaded from first param of datasource
        conn.data_queue = async.queue(function(packet, cb) {
            conn.emit('data', packet);
            cb();
        }, 1);
        conn.closed = false;
        conn.socket = null; // defined when connection created from remote socket.io event
    }

    Connection.prototype = Object.create(EventEmitter2.prototype, {
        constructor: {
            value: Connection,
            enumerable: false,
            writable: true,
            configurable: true
        }
    });

    // -------------------------------------
    // Methods called from datasource

    Connection.prototype.transmit_data = function(type, data) {
        var packet = {ds: this.datasource, conn: this.id, type: type, data: data};
        if (this.socket) {
            this.socket.emit('dataprovider:data', packet);
        } else {
            this.data_queue.push(packet);
        }
    };

    Connection.prototype.end = function() {
        if (this.socket) {
            this.socket.emit('dataprovider:close_connection', this.id);
        } else {
            this.emit('end');
        }
        delete connections[this.id];
        delete this.client.connections[this.id];
        this.closed = true;
    };

    Connection.prototype.error = function(err) {
        var ds = this.datasource.split('.');
        var errmsg = 'Error from datasource module \'' + ds[0] + '\' during \'' + this.type + '\' connection: ' + err.toString();
        if (this.socket) {
            this.socket.emit('dataprovider:error', this.id, errmsg);
        } else {
            this.emit('error', errmsg);
        }
    };

    // -------------------------------------
    // Methods called from client

    // Send data to datasource
    Connection.prototype.send = function(data) {
        var conn = this;
        if (!conn.closed) {
            var packet = {conn: conn.id, ds: conn.datasource, type: conn.type, data: data};
            module.receive_data(packet);
        } else {
            conn.error('Unable to send msg - connection is closed');
        }
    };

    Connection.prototype.close = function(config) {
        this.module.unsubscribe(this, config || {});
        this.emit('closed', this.datasource);
        delete connections[this.id];
        delete this.client.connections[this.id];
        this.closed = true;
    };

    // ----------------------------------------------------------------------------------

    function Client(client_id, group_id) {
        if (!(this instanceof Client)) return Client.apply(Object.create(Client.prototype), arguments);
        this.id = client_id;
        this.group_id = group_id;
        this.connections = {};
        this.socket = null; // defined when connection created from remote socket.io event
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
        if (!_.has(datasources, ds[0]) || !_.isObject(datasources[ds[0]])) throw Error('Missing or invalid datasource module: ' + ds[0]);
        var dsmod = datasources[ds[0]];
        if (!_.isFunction(dsmod[connection_type])) throw new Error('Datasource module \'' + ds[0] + '\' does not support \'' + connection_type + '\' connection types');
        var conn_id = config.id || 'conn:' + uuid.v4();
        var connection = new Connection(cl, conn_id, datasrc, connection_type);
        dsmod[connection_type](connection, _.rest(ds), config);
        connection.module = dsmod;
        cl.connections[connection.id] = connection;
        return connection;
    };

    Client.prototype.close_all = function() {
        _.each(this.connections, function(conn) {
            conn.close();
        });
    };

    // ----------------------------------------------------------------------------------

    if (io) {

        io.sockets.on('connection', function(socket) {

            var socket_id = socket.client.conn.id;
            socket_clients[socket_id] = [];
            console.log('new socket.io connection: ' + socket_id);

            // Top-level socket.io events

            socket.on('disconnect', function(reason) {
                _.each(socket_clients[socket_id], function(client) {
                    unregister(client);
                });
                if (_.has(socket_clients, socket_id)) delete socket_clients[socket_id];
                console.log("socket.io client '" + socket_id + "' disconnected: " + reason.toString());
            });

            socket.on('error', server_error);

            // Dataprovider events

            socket.on('dataprovider:new_client', function(client_id, group_id) {
                var client = register(client_id, group_id);
                client.socket = socket;
                socket_clients[socket_id].push(client);
            });

            socket.on('dataprovider:remove_client', function(client_id) {
                var client = clients[client_id];
                if (!client) return;
                unregister(client);
                socket_clients[socket_id] = _.reject(socket_clients[socket_id], function(cl) {
                    return cl.id === client.id;
                });
                if (_.isEmpty(socket_clients[socket_id])) delete socket_clients[socket_id];
            });

            socket.on('dataprovider:new_connection', function(client_id, connection_id, type, datasrc, config) {
                var client = clients[client_id];
                if (!client) return server_error('Client does not exist: ' + client_id);
                var connection = client.connect(type, datasrc, _.assign(config, {id: connection_id}));
                connection.socket = socket;
                connection.on('data', function(data) {
                    socket.emit('dataprovider:data', data);
                });
            });

            socket.on('dataprovider:close_connection', function(connection_id) {
                var connection = connections[connection_id];
                connection.close();
            });

            socket.on('dataprovider:data', function(data) {
                var conn_id = data.conn;
                var connection = connections[conn_id];
                if (connection) {
                    connection.send(data);
                } else {
                    server_error('Unknown connection id: ' + conn_id);
                }
            });

            // -----------------------------

            function server_error(err) {
                console.error(new Date(), 'ERROR:', err);
                socket.emit('server_error', err);
                throw err;
            }

        });
    }

    // ----------------------------------------------------------------------------------

    // register a new (local) client
    function register(client_id, group_id) {
        client_id = client_id || 'client:' + uuid.v4();
        group_id = group_id || 'grp:' + uuid.v4();
        var client = new Client(client_id, group_id);
        clients[client_id] = client;
        if (!_.has(client_groups, group_id)) client_groups[group_id] = [];
        client_groups[group_id].push(client);
        return client;
    }

    function unregister(client) {
        client.close_all();
        clients = _.reject(clients[client.id], function(cl) {
            return cl === client;
        });
        if (_.has(client_groups, client.group_id)) {
            client_groups[client.group_id] = _.reject(client_groups[client.group_id], function(cl) {
                return cl.id === client.id;
            });
            if (_.isEmpty(client_groups[client.group_id])) delete client_groups[client.group_id];
        }
    }

    // copy from one datasource to another
    function translate(src, dest, callback) {
        var dp = this;
        try {
            var id = uuid.v4();
            var src_client = new Client('translate:src:' + id);
            var dest_client = new Client('translate:dest:' + id);
            dp.register(src_client);
            dp.register(dest_client);
        } catch (e) {
            return callback(e);
        }

        // TODO: execute copy
        do_copy(function() {
            // on finish
            this.unregister(src_client);
            this.unregister(dest_client);
            callback();
        });
    }

    return {
        register: register,
        unregister: unregister,
        translate: translate
    };

};

/////////////////////////////////////////////////////////////////////////////////////////

function server_error(err) {
    console.error(new Date(), 'ERROR: ', err);
}
