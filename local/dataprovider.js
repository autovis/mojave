var fs = require('fs');
var path = require('path');
var _ = require('lodash');

var io = require('socket.io');

// {dsname, <module>}
var ds = _.object(fs.readdirSync(path.join(__dirname, "datasources")).map(function(ds) {
    return [_.first(ds.split('.')), require(path.join(__dirname, "datasources", ds))];
}));

module.exports = {

    init: function(server) {
        io.listen(server);
    }

};
