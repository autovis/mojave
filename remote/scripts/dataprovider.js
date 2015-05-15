'use strict';
define(['socketio', 'eventemitter2', 'async', 'lodash', 'uuid'], function(io, EventEmitter2, async, _, uuid) {

var socket = io();

//var datasource_requests = ['fetch', 'subscribe', 'fetch_and_subscribe', 'record', 'unsubscribe', 'pause', 'unpause'];
var clients = [];

// {datasource, [request]}
//var subscriptions = {};

// --------------------------------------------------------------------------------------

function Connection(client, datasource, type) {
    this.id = uuid.v4();
    this.type = type;
    this.client = client;
    this.datasource = datasource;
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

// Actions run from datasource

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

// Actions run from client

// Send data to datasource
Connection.prototype.send = function(msg) {
    if (this.closed) {
        //module.receive_data(msg);
        var packet = {ds: this.datasource, }
        io.emit('dataprovider:send', msg);
    } else {
        this.error('Unable to send msg - connection is closed');
    }
};

Connection.prototype.kill = function() {

    delete this.client.connections[this.id];
    this.closed = true;
}

// --------------------------------------------------------------------------------------

function Client(client_id) {
	if (!(this instanceof Client)) return Client.apply(Object.create(Client.prototype), arguments);
    this.id = client_id;
    this.requests = {};

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

Client.prototype.connect = function(connection_type, datasrc, options) {
    options = _.isObject(options) ? options : {};
    var cl = this;
    var ds = datasrc.split(':');
    if (!ds[0]) throw Error('Invalid datasource: ' + datasrc);

    socket.emit('dataprovider:connect')

    ///
    if (!_.has(datasources, ds[0]) || !_.isObject(datasources[ds[0]])) throw Error('Missing or invalid datasource module: ' + ds[0]);
    var dsmod = datasources[ds[0]];
    if (!_.isFunction(dsmod[connection_type])) throw new Error('Datasource module \'' + ds[0] + '\' does not support \'' + connection_type + '\' connection types');
    var connection = new Connection(cl, datasrc, connection_type);
    var mod = dsmod[connection_type](connection, _.rest(ds), options);
    connection.module = mod;
    return connection;
};

///

_.each(datasource_requests, function(request_type) {
    Client.prototype[request_type] = function(datasrc, options) {
        options = _.isObject(options) ? options : {};
        var cl = this;

        var req_id = uuid.v1();
        var req = _.create(EventEmitter2.prototype, {
            id: req_id,
            send: function(msg) {
                socket.emit('data', _.assign(msg, {ds: datasrc}));
            }
        });

        socket.emit(request_type, datasrc);
        socket.on('data', function(packet) {
            if (packet.ds === datasrc) {
                cl.queue.push(packet);
            }
        })
        socket.on('server_error', function(err) {
            console.error(err);
        })
        socket.on('end', function(ds) {
            delete cl.requests[req_id];
        });

        cl.requests[req_id] = req;
        return req;
    };
});

socket.on('connect', function() {

});

socket.on('disconnect', function() {

});

socket.on('reconnect', function() {

});

socket.on('data', function(data) {

})

/////////////////////////////////////////////////////////////////////////////////////////

return {

    register: function(client_name) {
        var client = Client(client_name + '_' + this.next_client_id);
        this.next_client_id++;
        return client;
    },

    unregister: function(client) {
        clients = _.reject(clients, function(cl) {
            return cl === client;
        });
    },

    copy: function() {

    }

};

});
