'use strict';
var fs = require('fs');
var path = require('path');

var uuid = require('uuid');
var requirejs = require('requirejs');

var async = requirejs('async');
var EventEmitter2 = requirejs('eventemitter2');
var _ = requirejs('lodash');

// --------------------------------------------------------------------------------------

var io;
var clients = {}; // {client_id => <Client>}
var client_groups = {}; // {group_id => [<Client>]}

module.exports = function(io_) {
    if (io_) io = io_;

    // load datasource modules
    // {dsname => <module>}
    var datasources = _.object(fs.readdirSync(path.join(__dirname, '../datasources')).map(function(ds) {
        return [_.first(ds.split('.')), require(path.join(__dirname, '../datasources', ds))];
    }));

    // ----------------------------------------------------------------------------------

    function Connection(client, conn_id, datasource, type) {
        this.client = client;
        this.id = conn_id;
        this.datasource = datasource;
        this.type = type;
        this.module = null; // module loaded from first param of datasource
        this.data_queue = async.queue(function(task, cb) {
            this.emit('data', task);
            cb();
        }, 1);
        this.closed = false;
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
        var packet = {ds: this.datasource, type: type, data: data};
        this.emit('data', packet);
    };

    Connection.prototype.end = function() {
        this.emit('end', this.datasource);
        delete this.client.connections[this.id];
        this.closed = true;
    };

    Connection.prototype.error = function(err) {
        var ds = this.datasource.split('.');
        this.emit('error', 'Error from datasource module \'' + ds[0] + '\' during \'' + this.type + '\' connection: ' + err.toString());
    };

    // -------------------------------------
    // Methods called from client

    // Send data to datasource
    Connection.prototype.send = function(msg) {
        var packet = {};
        if (this.closed) {
            module.receive_data(msg);
        } else {
            this.error('Unable to send msg - connection is closed');
        }
    };

    Connection.prototype.close = function(config) {
        this.module.unsubscribe(this, config || {});
        this.emit('end', this.datasource);
        delete this.client.connections[this.id];
        this.closed = true;
    }

    // ----------------------------------------------------------------------------------

    function Client(group_id, client_id) {
        if (!(this instanceof Client)) return Client.apply(Object.create(Client.prototype), arguments);
        this.id = client_id;
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
        if (!_.has(datasources, ds[0]) || !_.isObject(datasources[ds[0]])) throw Error('Missing or invalid datasource module: ' + ds[0]);
        var dsmod = datasources[ds[0]];
        if (!_.isFunction(dsmod[connection_type])) throw new Error('Datasource module \'' + ds[0] + '\' does not support \'' + connection_type + '\' connection types');
        var conn_id = config.id || uuid.v4();
        var connection = new Connection(cl, conn_id, datasrc, connection_type);
        dsmod[connection_type](connection, _.rest(ds), config);
        connection.module = dsmod;
        cl.connections[connection.id] = connection;
        return connection;
    };

    // ----------------------------------------------------------------------------------

    if (io) {

        io.sockets.on('connection', function(socket) {

            console.log('new socket.io connection: ' + socket.client.conn.id);

            ///
            var client = Client('socketio_' + socket.client.conn.id, function(msg) {
                socket.emit('data', msg);
            });
            ///
            socket.on('dataprovider:new_client', function(client_id) {
                var dp = this;
                var client = dp.register(client_id);
            });

            socket.on('dataprovider:new_connection', function(client_id, connection_id, request_type, datasrc, options) {
                var client = clients[client_id]
                if (_.isFunction(client[request_type])) {
                    client[request_type](datasrc, options);
                } else {
                    server_error('\'' + request_type + '\' requests are not supported');
                }
            });

            socket.on('error', server_error);

            function server_error(err) {
                console.error(new Date(), 'ERROR:', err);
                socket.emit('server_error', err);
            }

        });
    }

    return {

        // register a new (local) client
        register: function(group_id, client_id) {
            var client = Client(group_id || null, client_id || uuid.v4());
            if (!_.has(clients, client_id)) clients[client_id] = [];
            clients[client_id].push(client);
            return client;
        },

        unregister: function(client) {
            clients = _.reject(clients[client.id], function(cl) {
                return cl === client;
            });
        },

        // copy from one datasource to another
        translate: function(src, dest, callback) {
            var dp = this;
            try {
                var id = uuid.v4();
                var src_client = Client('translate:src:' + id);
                var dest_client = Client('translate:dest:' + id);
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
    };

};

/////////////////////////////////////////////////////////////////////////////////////////

function server_error(err) {
    console.error(new Date(), "ERROR:", err);
}
