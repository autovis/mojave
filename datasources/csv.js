'use strict';

var csv = require('csv');
var _ = require('lodash');
var path = require('path');

function fetch(connection, params, config) {

    var timeframe = params[1] || config.timeframe;
    config = _.defaults(config, default_config);

    console.log("fetch ---");
    console.log("connection", connection);
    console.log("params", params);
    console.log("config", config);

    return true;
}

module.exports = {
    fetch: fetch
}
