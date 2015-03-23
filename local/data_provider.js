var util = require('util');
var mysql = require('mysql');

var requirejs = require('requirejs');
var _ = requirejs('underscore');
var async = requirejs('async');

function DataSource(config) {
    if (_.isObject(config)) throw new Error("Invalid DataSource config");

    switch (config.type) {
        case "db":
            return MysqlDataSource(config);
        case "csv":
        default:
            return CsvDataSource(config);
    }
}

function MysqlDataSource(config) {
	if (!(this instanceof MysqlDataSource)) return new MysqlDataSource(config);
    
    this.connection = mysql.createConnection(config.db);

}

MysqlConnection.prototype.open = function(table, iterator) {
    iterator();
}

MysqlConnection.prototype.close = function() {    
    this.connection.end();
}

util.inherits(MysqlDataSource, DataSource);

// -----------------------------------------------

function CsvDataSource(config) {
	if (!(this instanceof CsvDataSource)) return new CsvDataSource(config);
    
}

CsvDataSource.prototype.open = function(filename) {
    
}

util.inherits(MysqlDataSource, DataSource);

module.exports = {
    DataSource: DataSource
}