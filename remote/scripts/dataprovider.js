"use strict";

define(['socketio'], function(io) {

    var socketio_url = window.location.href.match(/^(https?:\/\/[^\/]+\/?)/);
    var socket = io(socketio_url[0]);



});
