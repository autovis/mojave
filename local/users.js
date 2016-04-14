'use strict';


var query = require('pg-query');

var requirejs = require('requirejs');
var _ = requirejs('lodash');

query.connectionParameters = process.env.POSTGRES_URL_PRIMARY;

/*
var users = {};
query('SELECT * FROM users;', (err, rows, result) => {
    if (err) throw err;
    console.log('users: ', users);
});
*/

module.exports = {

    hasAccess: function(id) {
        //return _.has(users, id);
        return true;
    }

};
