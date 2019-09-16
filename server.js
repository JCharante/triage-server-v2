var express = require('express');
var passport = require('passport');
var Strategy = require('passport-local').Strategy;
const mongo = require('./mongo');


// Configure the local strategy for use by Passport.
//
// The local strategy require a `verify` function which receives the credentials
// (`username` and `password`) submitted by the user.  The function must verify
// that the password is correct and then invoke `cb` with a user object, which
// will be set at `req.user` in route handlers after authentication.
passport.use(new Strategy(
    async function(username, password, cb) {
        try {
            var userDoc = await mongo.verifyPassword(username, password);
        } catch (error) {
            cb(null, false, { message: error.toString() })
        }
        const sessionDoc = await mongo.createSession(userDoc._id)
        cb(null, sessionDoc);
    }));


// Configure Passport authenticated session persistence.
//
// In order to restore authentication state across HTTP requests, Passport needs
// to serialize users into and deserialize users out of the session.  The
// typical implementation of this is as simple as supplying the user ID when
// serializing, and querying the user record by ID from the database when
// deserializing.
passport.serializeUser(function(user, cb) {
    cb(null, user.sessionKey);
});

passport.deserializeUser(function(id, cb) {
    cb(null, {});
});

// Create a new Express application.
var app = express();

// Use application-level middleware for common functionality, including
// logging, parsing, and session handling.
app.use(require('morgan')('combined'));
// parse application/x-www-form-urlencoded
app.use(require('body-parser').urlencoded({ extended: true }));
// parse application/json
app.use(require('body-parser').json());
// app.use(require('express-session')({ secret: 'keyboard cat', resave: false, saveUninitialized: false }));

// Initialize Passport and restore authentication state, if any, from the
// session.
app.use(passport.initialize());
app.use(passport.session());
app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
    next();
});

// Define routes.
app.get('/',
    function(req, res) {
        res.status(200).end();
    }
);

app.post('/', async function(req, res) {
    try {
        // make sure session key is included
        if (!('sessionKey' in req.body)) {
            res.status(403).end();
        }
        // make sure session key is valid and get associated user
        const user = await mongo.getUserFromSessionKey(req.body.sessionKey);
        console.log('Got user', user);
        if (!('requestType' in req.body)) {
            res.status(400).end();
        }
        switch (req.body.requestType) {
            case 'userDetails': {
                res.status(200).end(JSON.stringify({
                    displayName: user.displayName
                }))
                break;
            }
            default: {
                res.status(200).end(JSON.stringify(user));
                break;
            }
        }
    } catch (error) {
        res.status(500).end(JSON.stringify({
            error: error.toString()
        }));
    }
});

app.get('/error', function(req, res) {
    res.status(400).end('Error while logging in');
})

app.get('/login', (req, res) => res.status(403).end())

app.post('/login',
    passport.authenticate('local', { failureRedirect: '/error' }),
    function(req, res) {
        res.append('Content-Type', 'application/json');
        res.status(200).end(JSON.stringify({
            sessionKey: req.user.sessionKey
        }));
    }
);

app.post('/signup', async function(req, res) {
    try {
        if (!('username' in req.body) || !('password' in req.body) || !('displayName' in req.body)) {
            res.status(400).end(JSON.stringify({
                error: 'missing fields',
            }));
        }
        const doc = await mongo.createUser(req.body.username, req.body.password, req.body.displayName);
        const sessionDoc = await mongo.createSession(doc._id);
        res.status(200).end(JSON.stringify(sessionDoc))
    } catch (error) {
        res.status(500).end(JSON.stringify({error: error.toString()}));
    }
})


app.listen(3000);
