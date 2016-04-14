'use strict';

var fs = require('fs');
var path = require('path');
var util = require('util');
var http = require('http');
//var auth = require('http-auth'); // for basic auth
var oauth = require('oauth');
var request = require('request');
var express = require('express');
var session = require('express-session');
var favicon = require('serve-favicon');
var bodyParser = require('body-parser');

var requirejs = require('requirejs');
require('./local/rjs-config');
var _ = requirejs('lodash');

// ----------------------------------------------------------------------------

var google_scopes = [
    //'https://www.googleapis.com/auth/plus.me',              // to authenticate alone
    'https://www.googleapis.com/auth/userinfo.email'          // to email trade-related notifications
    // via incremental authorization:
    //'https://www.googleapis.com/auth/drive.file'            // to publish reports, etc.
    //'https://www.googleapis.com/auth/calendar.readonly'     // to reference manually-entered periods of no trading
];

var users = require('./local/users.js');

var app = express();
app.set('port', process.env.PORT || 3000);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(session({
  secret: 'wasabi young man!',
  resave: false,
  saveUninitialized: false
}));

// Silently drop any connections on sessions marked as rejected
app.use((req, res, next) => {
    if (!(req.session && req.session.reject)) next();
});

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

var oauth_client = new oauth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    'https://accounts.google.com/o',
    '/oauth2/auth',
    '/oauth2/token'
);

app.get('/auth', function(req, res) {
    var _response_type = 'code';
    var proto = req.headers['x-forwarded-proto'] || req.protocol;
    res.redirect(oauth_client.getAuthorizeUrl({
        scope: google_scopes.join(' '),
        response_type: _response_type,
        redirect_uri: proto + '://' + req.get('host') + '/oauth2callback'
    }));
});

app.get('/oauth2callback', function(req, res) {
    var authorization_code = req.query.code;
    var proto = req.headers['x-forwarded-proto'] || req.protocol;
    oauth_client.getOAuthAccessToken(authorization_code, {
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: proto + '://' + req.get('host') + '/oauth2callback',
        grant_type: 'authorization_code'
    }, function(err, access_token, refresh_token) {
        if (err) {
            res.status(500).send('Error: ' + JSON.stringify(err));
        } else {
            if (_.isObject(req.session)) {
                req.session.auth_access_token = access_token;
                req.session.auth_refresh_token = refresh_token;
            }
            // get user info
            request({
                method: 'GET',
                url: 'https://www.googleapis.com/userinfo/v2/me',
                headers: {
                    'Authorization': 'Bearer ' + access_token
                }
            }, function(err, res2, body) {
                var userinfo;
                try {
                    userinfo = JSON.parse(body);
                } catch (e) {
                    console.error('While parsing Google API response body: ' + JSON.stringify(e));
                }
                if (req.session) {
                    users.hasAccess(userinfo.email, (err, has_access) => {
                        if (err) res.status(500).send('Error: ' + JSON.stringify(err));
                        if (has_access) {
                            req.session.user = userinfo.email;
                            if (req.session.referrer) {
                                var ref = req.session.referrer;
                                delete req.session.referrer;
                                res.redirect(ref);
                            } else {
                                res.end('No referrer');
                            }
                        } else {
                            req.session.reject = true;
                            res.status(403).send('403 Forbidden');
                        }
                    });
                } else {
                    res.status(500).send('Error: No session object exists');
                }
            });
        }
    });
});

app.get('/signoff', (req, res) => {
    req.session.destroy(() => {
        res.end('You have been signed out.');
    });
});

app.get('/signin', (req, res) => {
    if (req.session && req.session.user) {
        var ref = req.session.referrer;
        delete req.session.referrer;
        res.redirect(ref);
    } else {
        res.render('signin');
    }
});

// From here down, ensure user is authenticated to a Google account via OAuth2
app.use((req, res, next) => {
    if (false && process.env.NODE_ENV === 'development') {
        req.session.user_id = 0;
        req.session.user_name = 'test user';
    } else if (req.session && !req.session.user) {
        if (!_.has(req.session, 'referrer')) {
            req.session.referrer = req.originalUrl;
        }
        res.redirect('/signin');
    } else {
        next();
    }
});

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

app.get('/', (req, res) => {
    //res.redirect('/chart/eurusd/2016-02-17');
    //res.redirect('/backtest');
    //res.render('index', {title: 'mojave'});
    res.setHeader('content-type', 'application/json');
    res.send(util.inspect(req));
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

process.on('uncaughtException', function(err) {
    console.error(new Date(), '#### Handling uncaught exception:\n', err);
    fs.writeFile(path.join(__dirname, 'last_uncaught_exception.log'), (new Date()).toString() + '\n' + util.inspect(err), function(err) {
        if (err) console.error("Error writing to 'last_uncaught_exception.log:", err);
    });
});
