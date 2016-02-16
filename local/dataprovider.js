'use strict';

var fs = require('fs');
var path = require('path');

var requirejs = require('requirejs');

var async = requirejs('async');
var EventEmitter2 = requirejs('eventemitter2');
var _ = requirejs('lodash');
var uuid = requirejs('node-uuid');
var moment = requirejs('moment');

var Stream = requirejs('stream');
var IndicatorInstance = requirejs('indicator_instance');

var jsonoc = requirejs('jsonoc');
var jsonoc_schema = requirejs('jsonoc_schema');
var jt = requirejs('jsonoc_tools');
jt.set_schema(jsonoc_schema);

// --------------------------------------------------------------------------------------

var io;
var clients = {}; // {client_id => <Client>}
var client_groups = {}; // {group_id => [<Client>]}
var socket_clients = {}; // {socket_id => [client_id]}
var connections = {}; // {conn_id => <Connection>}

module.exports = function(io_) {
    if (io_) io = io_;

    // load data source modules
    // {dsname => <module>}
    var datasources = _.object(fs.readdirSync(path.join(__dirname, '../datasources')).map(function(datasrc) {
        return [_.first(datasrc.split('.')), require(path.join(__dirname, '../datasources', datasrc))];
    }));

    // ----------------------------------------------------------------------------------

    function Connection(client, conn_id, config, type) {
        var conn = this;
        conn.client = client;
        conn.id = conn_id;
        conn.config = _.clone(config);
        conn.type = type;
        conn.module = null;
        conn.stream = new Stream(200, 'rawinput:' + config.id, {type: 'object'});
        conn.event_queue = async.queue(function(packet, cb) {
            if (packet === 'end') {
                conn.emit('end');
            } else {
                conn.emit('data', packet);
            }
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
    // Methods called from datapath

    Connection.prototype.transmit_data = function(type, data) {
        this.stream.next();
        this.stream.set(data);
        this.interpreter.indicator.on_bar_update.apply(this.interpreter.context, [this.interpreter.params, this.interpreter.input_streams, this.interpreter.output_stream, 0]);
        var packet = {conn: this.id, type: type, data: this.interpreter.output_stream.get()};
        if (this.closed) throw Error('Connection is closed - unable to transmit data');
        if (this.socket) {
            this.socket.emit('dataprovider:data', packet);
        } else {
            this.event_queue.push(packet);
        }
    };

    Connection.prototype.end = function() {
        if (this.socket) {
            this.socket.emit('dataprovider:close_connection', this.id);
        } else {
            this.event_queue.push('end');
        }
        delete connections[this.id];
        delete this.client.connections[this.id];
        this.closed = true;
    };

    Connection.prototype.error = function(err) {
        var errmsg = 'Error from datapath module \'' + this.config.source + '\' during \'' + this.type + '\' connection: ' + err.toString();
        if (this.socket) {
            this.socket.emit('dataprovider:error', this.id, errmsg);
        } else {
            this.emit('error', errmsg);
        }
    };

    // -------------------------------------
    // Methods called from client

    // Send data to datapath
    Connection.prototype.send = function(data) {
        var conn = this;
        if (!conn.closed) {
            var packet = {conn: conn.id, type: conn.type, data: data};
            conn.module.receive_data(packet);
        } else {
            conn.error('Unable to send msg - connection is closed');
        }
    };

    Connection.prototype.close = function(config) {
        this.module.unsubscribe(this, config || {});
        this.emit('closed', this.config);
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

    Client.prototype.connect = function(connection_type, config) {
        var cl = this;
        if (!_.isString(connection_type)) throw new Error('Invalid parameter provided for "connection_type": ' + connection_type);
        if (!_.isObject(config)) throw new Error('Invalid config provided to client');
        if (!_.isString(config.source)) throw new Error('Invalid data source provided to client');
        if (!_.has(datasources, config.source)) throw new Error('Unknown data source provided to client: ' + config.source);
        var mod = datasources[config.source];
        if (!_.isFunction(mod[connection_type])) throw new Error('Data source \'' + config.source + '\' does not support \'' + connection_type + '\' connection types');
        var conn_id = config.id || 'conn:' + uuid.v4();
        var connection = new Connection(cl, conn_id, config, connection_type);
        mod[connection_type](connection, config);
        connection.module = mod;
        // if applicable, use interpreter to convert text fields to native types
        if (mod.properties.use_interpreter && config.interpreter) {
            connection.interpreter = IndicatorInstance(jt.create('$Collection.$Timestep.Ind', [config.interpreter]), [connection.stream]);
        } else { // otherwise default to identity indicator
            connection.interpreter = IndicatorInstance(jt.create('$Collection.$Timestep.Ind', [null]), [connection.stream]);
        }
        connection.interpreter.output_stream.id = 'input:' + config.id;
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

            socket.on('error', function(err) {
                server_error(null, err);
            });

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

            socket.on('dataprovider:new_connection', function(client_id, connection_id, type, config) {
                var client = clients[client_id];
                if (!client) return server_error(connection_id, 'Client does not exist: ' + client_id);
                var connection;
                try {
                    connection = client.connect(type, _.assign(config, {id: connection_id}));
                } catch (e) {
                    return server_error(connection_id, e);
                }
                connection.socket = socket;
                connection.on('data', function(data) {
                    socket.emit('dataprovider:data', data);
                });
            });

            socket.on('dataprovider:close_connection', function(connection_id) {
                var connection = connections[connection_id];
                connection.close();
            });

            socket.on('dataprovider:data', function(packet) {
                var conn_id = packet.data.conn;
                var connection = connections[conn_id];
                if (connection) {
                    if (_.has(packet.data, 'date')) {
                        // Hack to convert JSON-serialized dates back to native Date objects
                        packet.data.date = moment(packet.data.date).toDate();
                    }
                    connection.send(packet);
                } else {
                    server_error(conn_id, 'Unknown connection id: ' + conn_id);
                }
            });

            // -----------------------------

            function server_error(conn_id, err) {
                console.error(new Date(), 'ERROR:', err);
                socket.emit('dataprovider:error', conn_id, err);
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

    function load_resource(resource_path, callback) {

        async.auto({
            local: function(cb) {
                fs.readFile(path.join('local', resource_path), function(err, data) {
                    cb(null, err ? null : data);
                });
            },
            common: function(cb) {
                fs.readFile(path.join('common', resource_path), function(err, data) {
                    cb(null, err ? null : data);
                });
            },
        }, function(err, results) {
            if (err) return callback(err);
            var result = _.first(_.compact(_.values(results)));
            if (!result) return callback(new Error('Resource not found: ' + resource_path));
            callback(null, result);
        });

    }

    return {
        register: register,
        unregister: unregister,
        load_resource: load_resource
    };

};

/////////////////////////////////////////////////////////////////////////////////////////

function server_error(err) {
    console.error(new Date(), 'ERROR: ', err);
}
