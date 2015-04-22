"use strict";

define(['socketio', 'async', 'underscore'], function(io, async, _) {

var socket = io();

var event_queue = async.queue(function(event, cb) {


});

function DataProvider(config) {
	if (!(this instanceof DataProvider)) return DataProvider.apply(Object.create(DataProvider.prototype), arguments);

    return this;
};

DataProvider.prototype = {

	constructor: DataProvider,

    init: function() {
    },

    subscribe: function(datasource, cb) {

    }

};

return DataProvider;

});
