var fs = require('fs');
var path = require('path');

var uuid = require('uuid');

var requirejs = require('requirejs');
var async = requirejs('async');
var _ = requirejs('lodash');

// --------------------------------------------------------------------------------------

var clients = [];

module.exports = function(io) {

    var datasource_requests = ['fetch', 'subscribe', 'fetch_and_subscribe', 'record', 'unsubscribe', 'pause', 'unpause'];

    // load datasource modules
    // {dsname, <module>}
    var datasources = _.object(fs.readdirSync(path.join(__dirname, '../datasources')).map(function(ds) {
        return [_.first(ds.split('.')), require(path.join(__dirname, '../datasources', ds))];
    }));

    // --------------------------------------------------------------------------------------

    function Client(client_id, msg_callback) {
    	if (!(this instanceof Client)) return Client.apply(Object.create(Client.prototype), arguments);
        this.id = client_id;
        this.msg_callback = msg_callback;
        this.requests = {};
        this.queue = async.queue(function(task, cb) {
            msg_callback(task);
            cb();
        }, 1);
        return this;
    }

    _.each(datasource_requests, function(request_type) {
        Client.prototype[request_type] = function(datasrc, options) {
            options = _.isObject(options) ? options : {};
            var cl = this;
            var ds = datasrc.split(':');
            if (!ds[0]) throw Error('Invalid datasource: ' + datasrc);
            if (!_.has(datasources, ds[0]) || !_.isObject(datasources[ds[0]])) throw Error('Missing or invalid datasource module: ' + ds[0]);
            var dsmod = datasources[ds[0]];
            if (!_.isFunction(dsmod[request_type])) throw new Error('Datasource module \'' + ds[0] + '\' does not support \'' + request_type + '\' requests');
            var req = dsmod[request_type](cl, _.rest(ds), options, function(err) {
                if (err) return server_error('Error from datasource module \'' + ds[0] + '\' during \'' + request_type + '\' request: ' + err.toString());
            });
            return req;
        };
    });

    // --------------------------------------------------------------------------------------

    if (io) {

        io.sockets.on('connection', function(socket) {

            console.log("new client: " + socket.client.conn.id);
            var client = Client('socketio_' + socket.client.conn.id, function(msg) {
                socket.emit('data', msg);
            });

            _.each(datasource_requests, function(request_type) {
                socket.on(request_type, function(datasrc, options) {
                    if (_.isFunction(client[request_type])) {
                        client[request_type](datasrc, options);
                    } else {
                        server_error('\'' + request_type + '\' requests are not supported');
                    }
                });
            });

            socket.on('error', server_error);

            function server_error(err) {
                console.error(new Date(), "ERROR:", err);
                socket.emit('server_error', err);
            }

        });
    }

    return {

        // register a new (local) client
        register: function(client_id, msg_callback) {
            var client = Client(client_id, msg_callback);
            clients.push(client);
            return client;
        },

        unregister: function(client) {
            clients = _.reject(clients, function(cl) {
                return cl === client;
            });
        },

        // copy from one datasource to another
        copy: function(source, destination, callback) {
            try {
                var src_client = Client("copy_src_" + uuid.v1());
                var dest_client = Client("copy_dest_" + uuid.v1());
                this.register(src_client);
                this.register(dest_client);
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
