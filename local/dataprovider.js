var fs = require('fs');
var path = require('path');

var async = require('async');
var io = require('socket.io');
var uuid = require('uuid');
var _ = require('lodash');

// --------------------------------------------------------------------------------------

var clients = [];

module.exports = {

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

// --------------------------------------------------------------------------------------

var socket = io();

// TODO: use socket.io to detect remote clients and events from them

/////////////////////////////////////////////////////////////////////////////////////////

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

// load datasource modules
// {dsname, <module>}
var datasources = _.object(fs.readdirSync(path.join(__dirname, '../datasources')).map(function(ds) {
    return [_.first(ds.split('.')), require(path.join(__dirname, '../datasources', ds))];
}));

_.each(['fetch', 'subscribe', 'fetch_and_subscribe', 'record', 'unsubscribe', 'pause', 'unpause'], function(request_type) {
    Client.prototype[request_type] = function(datasrc, options) {
        options = _.isObject(options) ? options : {};
        var cl = this;
        var ds = datasrc.split(':');
        if (!ds[0]) throw Error('Invalid datasource: ' + datasrc);
        if (!_.has(datasources, ds[0]) || !_.isObject(datasources[ds[0]])) throw Error('Missing or invalid datasource module: ' + ds[0]);
        var dsmod = datasources[ds[0]];
        if (!_.isFunction(dsmod[request_type])) throw new Error('Datasource module \'' + ds[0] + '\' does not support \'' + request_type + '\' requests');
        var req = dsmod[request_type](cl, _.rest(ds), options, function(err) {
            if (err) {
                var error_msg = 'Error from datasource module \'' + ds[0] + '\' during \'' + request_type + '\' request: ' + err.toString();
                console.error(new Date(), error_msg);
                socket.emit('server_error', error_msg);
            }
        });
        return req;
    };
});

/////////////////////////////////////////////////////////////////////////////////////////

/*
function Request(type, datasource) {
	if (!(this instanceof Request)) return Request.apply(Object.create(Request.prototype), arguments);
	this.paused = false;
	this.type = type;
	this.datasource = datasource;
    return this;
}

Request.prototype = {
    init: function(type, datasource, cb) {

    },
};
*/
