'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var http = require('http');
//var auth = require('http-auth'); // for basic auth
//var google = require('googleapis');
//var oauth2 = google.auth.OAuth2;
var oauth = require('oauth');
var express = require('express');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');

var requirejs = require('requirejs');
require('./local/rjs-config');
var _ = requirejs('lodash');

// ----------------------------------------------------------------------------

//var oauth2Client = new oauth2(process.env.GOOGLE_CLIENT_ID, process.env.GOOGLE_CLIENT_SECRET, 'http://localhost:3000/callback');

var google_scopes = [
    //'https://www.googleapis.com/auth/plus.me',              // to authenticate alone
    'https://www.googleapis.com/auth/userinfo.email'          // to email trade-related notifications
    // via incremental authorization:
    //'https://www.googleapis.com/auth/drive.file'            // to publish reports, etc.
    //'https://www.googleapis.com/auth/calendar.readonly'     // to reference manually-entered periods of no trading
];

/*
var consent_url = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: google_scopes
});
*/

var app = express();
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

// Restrict by origin
/*
if (process.env.ALLOWED_HOSTS) {
    var allowed_hosts = _.compact((process.env.ALLOWED_HOSTS || '').split(/[\uFFFD\n]+/).map(function(line) {
        return line.replace(/#.*$/, '').trim();
    }));
    app.use(function(req, res, next) {

        var origin_list = (req.headers['x-forwarded-for'] || '').trim().split(',').map(str => str.trim());
        var origin = _.last(origin_list); // Last IP in 'x-forwarded-for' guaranteed to be real origin: http://stackoverflow.com/a/18517550/880891

        // Check origin IP against list of ALLOWED_HOSTS config var if defined
        if (!_.isEmpty(allowed_hosts)) {
            if (_.some(allowed_hosts, function(allowed) {
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

    function in_subnet(ip, subnet) {
        var mask, base_ip, long_ip = ip2long(ip);
        if ((mask = subnet.match(/^(.*?)\/(\d{1,2})$/)) && ((base_ip = ip2long(mask[1])) >= 0)) {
            var freedom = Math.pow(2, 32 - parseInt(mask[2]));
            return (long_ip >= base_ip) && (long_ip <= base_ip + freedom - 1);
        } else return false;
    }

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
        } else return -1;
    }
}
*/

// Force use of HTTPS
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'development' && !req.headers['x-forwarded-proto']) {
        // accept request if in dev mode and no x-forwarded-proto header
        next();
    } else if (req.headers['x-forwarded-proto'] === 'http') {
        res.redirect('https://' + req.headers['host'] + req.url);
    } else if (req.headers['x-forwarded-proto'] === 'https') {
        next();
    } else {
        // unknown protocol: log event and don't reply to client
        console.warn("Unknown protocol in 'x-forwarded-proto' header: " + req.headers['x-forwarded-proto']);
    }
});

// Restrict access with http basic auth (uncomment "require('http-auth')" above)
/*
if (process.env.USERS) {
    var basic_auth = auth.basic({
            realm: 'Mojave Charting'
        }, function (user, pass, cb) {
            if (_.isEmpty(process.env.USERS)) return cb(); // allow if no USERS var defined
            var creds = _.compact(process.env.USERS.split(/[\uFFFD\n]+/).map(function(line) {
                var match = line.trim().match(/^([a-z]+)\s*:\s*([^\s]+)\s*$/);
                return match ? [match[1], match[2]] : null;
            }));
            if (_.some(creds, function(cred) {
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
*/

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
if (process.env.NODE_ENV !== 'production') {
    require('longjohn');
}

///////////////////////////////////////////////////////////////////////////////
// URL ROUTES

var _oa;

app.get('/auth', function(req, res) {
    var _response_type = 'code';

    //clientId, clientSecret, baseSite, authorizePath, accessTokenPath, customHeaders
    _oa = new oauth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        'https://accounts.google.com/o',
        '/oauth2/auth',
        '/oauth2/token'
    );

    res.redirect(_oa.getAuthorizeUrl({
        scope: google_scopes.join(' '),
        response_type: _response_type,
        redirect_uri: req.protocol + '://' + req.get('host') + '/oauth2callback'
    }));
});

app.get('/oauth2callback', function(req, res) {
    var _code = req.param('code', false);

    _oa.getOAuthAccessToken(_code, {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: req.protocol + '://' + req.get('host') + '/oauth2callback',
        grant_type: 'authorization_code'
    }, function(err, access_token, refresh_token) {
        if (err) {
            res.end('error: ' + JSON.stringify(err));
        } else {
            res.write('access token: ' + access_token + '\n');
            res.write('refresh token: ' + refresh_token);
            res.end();
        }
    });
});

app.get('/', (req, res) => {
    //res.redirect('/chart/eurusd/2016-02-17');
    //res.redirect('/backtest');
    //res.render('index', {title: 'mojave'});
    res.setHeader('content-type', 'application/json');
    res.end(util.inspect(req));
});

app.get('/home', (req, res) => {
    res.render('home', {title: 'mojave'});
});

// live price stream view
app.get('/live_stream/:datasource/:chart_setup', (req, res) => {
    res.render('live_stream', {title: 'Live Stream', params: req.params, theme: 'dark'});
});

// history browser chart view
app.get('/chart/:instrument/:date', (req, res) => {
    res.render('chart', {title: 'Chart', params: req.params});
});

// backtesting view
app.use('/backtest', require('./routes/backtest'));

// browse/analyze/modify selection data
app.get('/selection_viewer/:sel_id/', (req, res) => {
    res.render('selection_viewer', {title: 'Selection: ' + req.params.sel_id, params: req.params});
});

/*
app.get('/colvis', (req, res) => {
    res.render('colvis', {title: 'ColVis', params: req.params});
});
app.get('/replay/:datasource/:chart_setup', (req, res) => {
    res.render('replay_chart', {title: 'Replay Market', params: req.params});
});
*/

// --------------------------------------------------------------------------------------

// serve static content
app.use(favicon(path.join(__dirname, 'remote/img/favicon.ico')));
app.use(require('stylus').middleware(path.join(__dirname, 'remote')));
app.use(express.static(path.join(__dirname, 'remote')));
app.use('/scripts', express.static(path.join(__dirname, 'common')));
app.use('/data', express.static(path.join(__dirname, 'data')));

// --------------------------------------------------------------------------------------

var io;
var server;

function start_webserver() {
    if (server) server.close();
    server = http.createServer(app).listen(app.get('port'), function(){
        console.log('Mojave listening for connections on port ' + app.get('port') + ' (' + process.env.NODE_ENV + ' mode)');
    });
    io = require('socket.io').listen(server);
    require('./local/dataprovider')(io);
}
start_webserver();

// initialize oauth if app is running in production
if (process.env.NODE_ENV === 'production') oauth.initialize(process.env.OAUTHIO_PUBLIC_KEY, process.env.OAUTHIO_SECRET_KEY);

process.on('uncaughtException', function(err) {
    console.error(new Date(), '#### Handling uncaught exception:\n', err);
    fs.writeFile(path.join(__dirname, 'last_uncaught_exception.log'), (new Date()).toString() + '\n' + util.inspect(err), function(err) {
        if (err) console.error("Error writing to 'last_uncaught_exception.log:", err);
    });
});
