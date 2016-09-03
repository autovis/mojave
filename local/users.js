'use strict';

var query = require('pg-query');

var requirejs = require('requirejs');
var _ = requirejs('lodash');

query.connectionParameters = process.env.POSTGRES_URL_PRIMARY;

module.exports = {

    hasAccess: function(id, callback) {
        query('SELECT * FROM users;', [], (err, rows, result) => {
            callback(err, !!_.find(rows, row => row.id === id));
        });
    }

};
