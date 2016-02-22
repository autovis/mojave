'use strict';

if (process.env.NEW_RELIC_LICENSE_KEY) require('newrelic');

var fs = require('fs');
var path = require('path');
var util = require('util');

var http = require('http');
var auth = require('http-auth');
var express = require('express');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');

var requirejs = require('requirejs');
require('./local/rjs-config');
var _ = requirejs('lodash');

// ----------------------------------------------------------------------------

var app = express();
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Restrict by origin
if (process.env.ALLOWED_HOSTS) {
    var allowed_hosts = _.compact((process.env.ALLOWED_HOSTS || '').split(/\s*[\uFFFD\n]+\s*/).map(function(line) {
        return line.replace(/#.*$/, '').trim();
    }));
    app.use(function(req, res, next) {

        var origin_list = (req.headers['x-forwarded-for'] || '').trim().split(/\s*,\s*/);
        var origin = _.last(origin_list); // Last IP in 'x-forwarded-for' guaranteed to be real origin: http://stackoverflow.com/a/18517550/880891

        // Check origin IP against list of ALLOWED_HOSTS config var if defined
        if (!_.isEmpty(allowed_hosts)) {
            if (_.any(allowed_hosts, function(allowed) {
                return in_subnet(origin, allowed);
            })) {
                next();
            } else {
                console.log('Blocked host ' + origin + ': no match in ALLOWED_HOSTS: ' + JSON.stringify(allowed_hosts));
                res.setHeader('Content-Type', 'text/plain');
                res.status(403).end('403 Forbidden');
            }
        } else {
            next();
        }
    });
}

// Force use of HTTPS
app.use(function(req, res, next) {
    if (process.env.NODE_ENV === 'development' && !req.headers['x-forwarded-proto']) {
        // accept request if in dev mode and no x-forwarded-proto header
        next();
    } else if (req.headers['x-forwarded-proto'] === 'http') {
        res.redirect('https://' + req.headers['host'] + req.url);
    } else if (req.headers['x-forwarded-proto'] === 'https') {
        next();
    } else {
        // unknown protocol: log event and don't reply to client
        console.log("Unknown protocol in 'x-forwarded-proto' header: " + req.headers['x-forwarded-proto']);
    }
});

// Restrict with user authentication (basic auth)
if (process.env.USERS) {
    var basic_auth = auth.basic({
            realm: 'Mojave Charting'
        }, function (user, pass, cb) {
            if (_.isEmpty(process.env.USERS)) return cb(); // allow if no USERS var defined
            var creds = _.compact(process.env.USERS.split(/\s*[\uFFFD\n]+\s*/).map(function(line) {
                var match = line.match(/^([a-z]+)\s*:\s*([^\s]+)\s*$/);
                return match ? [match[1], match[2]] : null;
            }));
            if (_.any(creds, function(cred) {
                return user === cred[0] && pass === cred[1];
            })) { // auth successful
                //console.log('Login successful for user "'+user+'"');
                cb(true);
            } else { // auth failed
                console.log('Login FAILED for user: ' + user);
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
console.log('Starting in mode: ' + process.env.NODE_ENV);
if (process.env.NODE_ENV !== 'production') {
    require('longjohn');
}

///////////////////////////////////////////////////////////////////////////////
// URL ROUTES

app.use('/backtest', require('./routes/backtest'));

app.get('/', function(req, res) {
    res.redirect('/live_stream/oanda:eurusd:m5/2016-02_chart');
    //res.redirect('/backtest');
    //res.render('index', {title: 'mojave'});
});

app.get('/home', function(req, res) {
    res.render('home', {title: 'mojave'});
});

// Live tick stream
app.get('/live_stream/:datasource/:chart_setup', function(req, res) {
    res.render('live_stream', {title: 'Live Stream', params: req.params, theme: 'dark'});
});

// COLVIS - Collection visualization
app.get('/colvis', function(req, res) {
    res.render('colvis', {title: 'ColVis', params: req.params});
});

// Replay market data
app.get('/replay/:datasource/:chart_setup', function(req, res) {
    res.render('replay_chart', {title: 'Replay Market', params: req.params});
});

// --------------------------------------------------------------------------------------

// Serve static content
app.use(favicon(path.join(__dirname, 'remote/img/favicon.ico')));
app.use(require('stylus').middleware(path.join(__dirname, 'remote')));
app.use(express.static(path.join(__dirname, 'remote')));
app.use('/scripts', express.static(path.join(__dirname, 'common')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// --------------------------------------------------------------------------------------

var io;
var server;
var dataprovider;

function start_webserver() {
    if (server) server.close();
    server = http.createServer(app).listen(app.get('port'), function(){
        console.log('Mojave listening for connections on port ' + app.get('port'));
    });
    io = require('socket.io').listen(server);
    dataprovider = require('./local/dataprovider')(io);
}
start_webserver();

process.on('uncaughtException', function(err) {
    console.error(new Date(), '#### Handling uncaught exception:\n', err);
    fs.writeFile(path.join(__dirname, 'last_uncaught_exception.log'), (new Date()).toString() + '\n' + util.inspect(err), function(err) {
        if (err) console.error("Error writing to 'last_uncaught_exception.log:", err);
    });
});

/////////////////////////////////////////////////////////////////////////////////////////

function ip2long(ip) {
    var components;

    if (components = ip.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/)) {
        var iplong = 0;
        var power  = 1;
        for (var i = 4; i >= 1; i -= 1) {
            iplong += power * parseInt(components[i]);
            power  *= 256;
        }
        return iplong;
    }
    else return -1;
};

function in_subnet(ip, subnet) {
    var mask, base_ip, long_ip = ip2long(ip);
    if ((mask = subnet.match(/^(.*?)\/(\d{1,2})$/)) && ((base_ip = ip2long(mask[1])) >= 0)) {
        var freedom = Math.pow(2, 32 - parseInt(mask[2]));
        return (long_ip >= base_ip) && (long_ip <= base_ip + freedom - 1);
    }
    else return false;
};
