'use strict';

var url = require('url');
var pg = require('pg');

var requirejs = require('requirejs');
var _ = requirejs('lodash');

var pg_params = url.parse(process.env.POSTGRES_URL_PRIMARY);
var auth = pg_params.auth.split(':');
var pg_client = new pg.Client({
    user: auth[0],
    password: auth[1],
    database: pg_params.pathname.slice(1),
    port: pg_params.port,
    host: pg_params.hostname
    //ssl: true
});

pg_client.connect();

module.exports = {

    hasAccess: function(id, callback) {

        pg_client.query({
            text: 'SELECT * FROM users WHERE id = $1;',
            values: [id]
        }, (err, result) => {
            if (err) return callback(err);
            return callback(null, result.rows && result.rows.length > 0);
        });
    }

};
