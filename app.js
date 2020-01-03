const express = require('express')
const app = express()

// connect to database blogdb on localhost
const pgp = require('pg-promise')();
const connectionString = 'postgres://localhost:5432/blogdb'
const db = pgp(connectionString)

// setup mustache
const mustacheExpress = require('mustache-express');
app.engine('mustache',mustacheExpress());
app.set('views','./views');
app.set('view engine','mustache');

app.use(express.urlencoded({ extended: true }));

app.use(express.static('public'));

const session = require('express-session');
app.use(session({
    secret: '2Zo8raCxsyTbgcD06VkubtRwSj1zWXVVYDNkhz4AlxSRQEhsxYmxms49v2KA',
    resave: false,
    saveUninitialized: true
}));

const bcrypt = require('bcrypt');
const BCRYPT_SALT_ROUNDS = 12;

// middleware for user authentication
function authenticate(req,res,next) {
    if(req.session) {
        if(req.session.isAuthenticated) {
            next()
        } else {
            res.redirect('/')
        }
    } else {
        res.redirect('/')
    }
}


// root route shows login page
app.get('/',(req,res) => {
    res.render('login')
})

// login attempt
app.post('/',(req,res) => {
    db.any('SELECT user_id, name, password FROM users')
    .then((results) => {
        // verify that the username exists
        let checkName =  results.filter(item => item.name==req.body.username)
        if (checkName.length != 1) {
            req.session.destroy()
            res.redirect('/')
        }
        else {
            // verify correct password
            bcrypt.compare(req.body.password, checkName[0].password)
            .then((samePassword) => {
                if(!samePassword) {
                    // bad password
                    req.session.destroy()
                    res.redirect('/')
                }
                else {
                    // good password
                    req.session.isAuthenticated = true
                    req.session.username = checkName[0].name
                    req.session.user_id = checkName[0].user_id
                    res.redirect('/posts')
                }
            })
            .catch((error) => {
                // authentication error
                req.session.destroy()
                res.redirect('/')
            })
        }
    })
    .catch((error) => {
        console.log(error)
        req.session.destroy()
        res.redirect('/')
    })
})

// register attempt
app.post('/add-user',(req,res) => {
    db.any('SELECT name FROM users')
    .then((results) => {
        // verify that username is not already in users
        let checkName =  results.filter(item => item.name==req.body.username)
        if (checkName.length > 0) {
            req.session.destroy()
            res.redirect('/')
        }
        else {
            bcrypt.hash(req.body.password, BCRYPT_SALT_ROUNDS)
            .then((hashedPassword) => {
                db.one('INSERT INTO users(name, password) VALUES($1,$2) RETURNING user_id',[req.body.username, hashedPassword])
                .then((results) => {
                    req.session.isAuthenticated = true
                    req.session.username = req.body.username
                    req.session.user_id = results.user_id
                    res.redirect('/posts')
                })
                .catch((error) => {
                    console.log(error)
                    req.session.destroy()
                    res.redirect('/')
                })
            })
            .catch((error) => {
                console.log(error)
                req.session.destroy()
                res.redirect('/')
            });            
        }
    })
    .catch((error) => {
        console.log(error)
        req.session.destroy()
        res.redirect('/')
    })
})

// user logout route
app.get('/logout',(req,res) => {
    req.session.destroy()
    res.redirect('/')
})

// this is the main view...
app.get('/posts',authenticate,(req,res) => {
    db.any('SELECT post_id, title, body, user_id FROM posts WHERE user_id = $1 ORDER BY post_id',[req.session.user_id])
    .then(results => res.render('posts',{username: req.session.username, posts: results}))
    .catch((error) => {
        // something went really wrong if I can't read posts - go back to login
        console.log(error)
        req.session.destroy()
        res.redirect('/')
    })
})

// add or update an entry
app.post('/posts',authenticate,(req,res) => {
    // check to see if we are adding or updating based on the title
    db.any('SELECT post_id, title, body, user_id FROM posts WHERE user_id = $1',[req.session.user_id])
    .then(results => {
        let checkTitle = results.filter(item => item.title==req.body.title)
        if (checkTitle.length > 0) {
            // update an existing post
            db.none('UPDATE posts SET body=$1 WHERE post_id=$2',[req.body.body, checkTitle[0].post_id])
            .then(() => res.redirect('/posts'))
            .catch((error) => {
                console.log(error)
                res.redirect('/posts')
            })
        }
        else
        {
            // create a new post
            db.none('INSERT INTO posts(title,body,user_id) VALUES($1,$2,$3)',[req.body.title, req.body.body, req.session.user_id])
            .then(() => res.redirect('/posts'))
            .catch((error) => {
                console.log(error)
                res.redirect('/posts')
            })
        }
    })
    .catch((error) => {
        console.log(error)
        res.redirect('/posts')
    })
})

// delete an entry
app.post('/delete-post',authenticate,(req,res) => {
    db.none('DELETE FROM posts WHERE post_id=$1',[req.body.del_post])
    .then(() => res.redirect('/posts'))
    .catch((error) => {
        console.log(error)
        res.redirect('/posts')
    })
})

app.listen(3000, () => {
    console.log("Server is running on localhost:3000")
})
