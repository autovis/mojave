"use strict";

define(['socketio', 'async', 'underscore'], function(io, async, _) {

var socket = io();

function DataProvider(config) {
	if (!(this instanceof DataProvider)) return DataProvider.apply(Object.create(DataProvider.prototype), arguments);
    this.next_client_id = 1;
    this.clients = {};
    return this;
};

DataProvider.prototype = {

	constructor: DataProvider,

    init: function(cb) {
        // TODO: find and initialize each datasource

        cb();
    },

    register_client: function(client_name, msg_callback) {
        var client = Client(client_name + '_' + this.next_client_id, msg_callback);
        this.next_client_id++;
        return client;
    }

};

// TODO: listen for io subscribe events here

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

Client.prototype = {

    fetch: function(type, datasource) {

    },

    subscribe: function(type, datasource) {

    },

    fetch_and_subscribe: function(type, datasource) {

    },

    record: function(options) {

    },

    unsubscribe: function(datasource) {

    },

    pause: function(datasource) {

    },

    unpause: function(datasource) {

    }

};

/////////////////////////////////////////////////////////////////////////////////////////

return DataProvider;

});
