if (process.env.NEW_RELIC_LICENSE_KEY) require('newrelic');

var fs = require('fs');
var path = require('path');
var http = require('http');
var _ = require('lodash');
var auth = require('http-auth');
var express = require('express');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');

var requirejs = require("requirejs").config({

    baseUrl: path.join(__dirname, "common"),

    shim: {
        'simple-statistics': {
            exports: 'ss'
        },
        'sylvester': {
            exports: 'Matrix',
            init: function() {
                return {
                    Matrix: Matrix,
                    Vector: Vector
                }
            }
        }
    },

    paths: {
        'underscore': 'lib/underscore',
        'async': 'lib/async',
        'd3': 'lib/d3_stripped',
        'machina': 'lib/machina',
        'moment': 'lib/moment.min',
        'simple-statistics': 'lib/simple-statistics',
        'convnetjs': 'lib/convnet',
        'eventemitter2': 'lib/eventemitter2',
        'sylvestor': 'lib/sylvester.src',
        'jsep': 'lib/jsep.min'
    },

    nodeRequire: require
});

var async = requirejs("async");
var dsconfig = requirejs("config/datasources");

// ----------------------------------------------------------------------------

var app = express();
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Apply access restrictions when deployed on Heroku
if (process.env.HEROKU) {

    // Restrict by origin
    var allowed_hosts = _.compact((process.env.ALLOWED_HOSTS || "").split(/\s*[\uFFFD\n]+\s*/).map(function(line) {return line.replace(/#.*$/, "").trim()}));
    app.use(function(req, res, next) {

        var origin_list = (req.headers['x-forwarded-for'] || "").trim().split(/\s*,\s*/);
        var origin = _.last(origin_list); // Last IP in 'x-forwarded-for' guaranteed to be real origin: http://stackoverflow.com/a/18517550/880891

        // Check origin IP against list of ALLOWED_HOSTS config var if defined
        if (!_.isEmpty(allowed_hosts)) {
            if (_.any(allowed_hosts, function(allowed) {return in_subnet(origin, allowed)})) {
                next();
            } else {
                console.log("Blocking host "+origin+": no match in ALLOWED_HOSTS: "+JSON.stringify(allowed_hosts));
                res.setHeader('Content-Type', 'text/plain');
                res.status(403).end("403 Forbidden");
            }
        } else {
            next();
        }
    });

    // Force use of HTTPS
    app.use(function(req, res, next) {
        if (req.headers['x-forwarded-proto'] === 'http') {
            res.redirect('https://'+req.headers['host']+req.url);
        } else if (req.headers['x-forwarded-proto'] === 'https') {
            next();
        } else {
            // unknown protocol: log event and don't reply to client
            console.log("Unknown protocol: "+req.headers['x-forwarded-proto']);
        }
    });

    // Restrict with user authentication (basic auth)
    var basic_auth = auth.basic({
            realm: "Mojave Charting"
        }, function (user, pass, cb) {
            if (_.isEmpty(process.env.USERS)) return cb(); // allow if no USERS var defined
            var creds = _.compact(process.env.USERS.split(/\s*[\uFFFD\n]+\s*/).map(function(line) {
                var match = line.match(/^([a-z]+)\s*:\s*([^\s]+)\s*$/);
                return match ? [match[1], match[2]] : null;
            }));
            if (_.any(creds, function(cred) {return user === cred[0] && pass === cred[1]})) { // auth successful
                //console.log('Login successful for user "'+user+'"');
                cb(true);
            } else { // auth failed
                console.log('Login FAILED for user "'+user+'"');
                cb(false);
            }
        }
    );
    app.use(auth.connect(basic_auth));
}

//app.use(logger('dev'));
app.use(bodyParser.json());
//app.use(express.methodOverride());
//app.use(app.router);

// development only
/*
if (app.get('env') === 'development') {
    app.use(express.errorHandler());
}
*/

///////////////////////////////////////////////////////////////////////////////
// URL ROUTES

app.get('/', function(req, res) {
  //res.redirect("/replay/csv:eurusd.csv/SDL89_chart");
  res.redirect("/live_stream/oanda:eurusd:m5/2015.03.MACD_OBV");
  //res.render('index', {title: 'mojave'});
});

app.get('/home', function(req, res) {
  res.render('home', {title: 'mojave'});
});

// Live tick stream
app.get('/live_stream/:datasource/:chart_setup', function(req, res) {
    res.render('live_stream', {title: 'Live Stream', params: req.params, theme: "dark"});
});

// COLVIS - Collection visualization
app.get('/colvis', function(req, res) {
    res.render('colvis', {title: 'ColVis', params: req.params});
});

// Replay market data
app.get('/replay/:datasource/:chart_setup', function(req, res) {
    res.render('replay_chart', {title: 'Replay Market', params: req.params});
});

app.get('/chart/fixed/:datasource/:chart_setup', function(req, res) {
    res.render('fixed_chart', {title: 'Chart Testing', params: req.params});
});

app.get('/darkchart/fixed/:datasource/:chart_setup', function(req, res) {
    res.render('fixed_chart', {title: 'DarkChart Testing', params: req.params, theme: "dark"});
});

// assume scrolling_chart
app.get('/chart/:datasource/:collection/:chart_setup', function(req, res) {
});

app.get('/bardata/:table/:startdate/:enddate', function(req, res) {
  res.send(JSON.stringify([req.params.table, req.params.startdate, req.params.enddate]));
});

///////////////////////////////////////////////////////////////////////////////

// direct unhandled requests to static content
app.use(favicon(path.join(__dirname, 'remote/img/favicon.ico')));
app.use(require('stylus').middleware(path.join(__dirname, 'remote')));
app.use(express.static(path.join(__dirname, 'remote')));
app.use('/scripts', express.static(path.join(__dirname, 'common')));
app.use('/data', express.static(path.join(__dirname, 'data')));

var server = http.createServer(app).listen(app.get('port'), function(){
    console.log('Mojave app listening for connections on port ' + app.get('port'));
});

var io = require('socket.io').listen(server);

///////////////////////////////////////////////////////////////////////////////
// SOCKET.IO

// {dsname, <module>}
var datasrc = _.object(fs.readdirSync(path.join(__dirname, "datasources")).map(function(ds) {return [_.first(ds.split('.')), require(path.join(__dirname, "datasources", ds))]}));

io.sockets.on('connection', function(socket) {

    var datasource_actions = ['subscribe', 'unsubscribe', 'play', 'record'];
    _.each(datasource_actions, function(action) {
        socket.on(action, function(datasource, options) {
            var ds = datasource.split(':');
            var dstype = _.first(ds);
            if (_.has(datasrc, dstype)) {
                if (_.isFunction(datasrc[dstype][action])) {
                    datasrc[dstype][action](socket, _.rest(ds), options || {});
                } else {
                    server_error("Datasource '"+dstype+"' does not support '"+action+"'");
                }
            } else {
                server_error("Datasource '"+dstype+"' does not exist");
            }
        });
    });

});

///////////////////////////////////////////////////////////////////////////////

function server_error(err) {
    console.log(new Date(), "ERROR:", err);
}

function ip2long(ip) {
    var components;

    if(components = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/))
    {
        var iplong = 0;
        var power  = 1;
        for(var i=4; i>=1; i-=1)
        {
            iplong += power * parseInt(components[i]);
            power  *= 256;
        }
        return iplong;
    }
    else return -1;
};

function in_subnet(ip, subnet) {
    var mask, base_ip, long_ip = ip2long(ip);
    if( (mask = subnet.match(/^(.*?)\/(\d{1,2})$/)) && ((base_ip=ip2long(mask[1])) >= 0) ) {
        var freedom = Math.pow(2, 32 - parseInt(mask[2]));
        return (long_ip >= base_ip) && (long_ip <= base_ip + freedom - 1);
    }
    else return false;
};
