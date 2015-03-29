var path = require('path');
var csv = require('csv');

var requirejs = require('requirejs');
var _ = requirejs('underscore');

function play() {

    var filepath = path.join(__dirname, "data/csv", ds[1]);
    var parser = csv.parse();
    var linecount = 0;
    var header;
    var data;
    parser.on('readable', function() {
        while (data = parser.read()) {
            if (linecount == 0) {
                header = data;
            } else {
                socket.emit('data', {datasource: datasource, data: _.object(_.zip(header, data))});
            }
            linecount++;
        }
    });
    parser.on('error', function(err) {
        socket.emit('error', err);
    });
    parser.on('finish', function() {
        socket.emit('end', datasource);
    });
    fs.createReadStream(filepath).pipe(parser);

    return true;
}

module.exports = {
    play: play
}
