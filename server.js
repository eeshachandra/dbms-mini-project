const express = require('express');
const path = require('path');
const ejsMate = require('ejs-mate');
const methodOverride = require('method-override');
//express-session
const session = require('express-session');
//import moment
const moment = require('moment');
const isLoggedIn = require('./middleware');
//create an expres-session
const sessionConfig = {
    name: 'session',
    secret: 'keyboard cat',
    resave: false,
    saveUninitialized: true,
    cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 7
    }
};

//connect to mysql
const mysql = require('mysql');
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'dbmsproject'
});
//check if db is connected
db.connect((err) => {
    if (err) {
        throw err;
    }
    console.log('MySql Connected...');
});
const app = express();

app.engine('ejs', ejsMate);
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'))

app.use(express.urlencoded({ extended: true }));
app.use(methodOverride('_method'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, "public/index.css")));//used as one of  boilerplate scripts
app.use(session(sessionConfig));








//----------------------------------------------------Routes----------------------------------------------------------------------------------------------------------------------------------

//--------Home-------------
app.get('/', (req, res) => {
    console.log(req.body);
    res.render('home', { username: req.session.username });
})
app.post('/', (req, res) => {
    console.log(req.body);
    db.query('CREATE TABLE users(id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255), email VARCHAR(255), password VARCHAR(255))', (err, result) => {
        if (err) throw err;
        console.log(result);
    });
    res.render('home');
})
//----Test page-----
app.get('/test', (req, res) => {
    res.render('test', { username: null });
});
//---------------------LOGIN---------------------
app.get('/login', (req, res) => {
    res.render('login', { username: req.session.username });
});
app.post('/login', (req, res) => {
    let sql = 'SELECT * FROM users WHERE username = ? AND password = ?';
    let values = [req.body.username, req.body.password];
    db.query(sql, values, (err, results) => {
        if (err) {
            throw err;
        }
        if (results.length > 0) {
            req.session.loggedin = true;
            req.session.username = req.body.username;
            req.session.error_noseat = 0;
            console.log(req.session.username);
            res.redirect(req.session.returnTo || '/');
        } else {
            res.send('Incorrect Username and/or Password!');
        }
        res.end();
    });
});

//---------------------REGISTER---------------------
app.get('/register', (req, res) => {
    res.render('register', { username: req.session.username });
});
app.post('/register', (req, res) => {
    let name = req.body.name;
    let username = req.body.username;
    let email = req.body.email;
    let password = req.body.password;
    let is_admin = req.body.is_admin;
    let bank_ac = req.body.bank_ac;
    let phone_no = req.body.phone_no;
    console.log(req.body);
    let address = req.body.address;
    if (is_admin == 'on') {
        is_admin = true;
    }
    else {
        is_admin = false;
    }
    let sql = `INSERT INTO users(name,username,  email, password, is_admin, address,bank_ac,phone_no) VALUES('${name}','${username}' , '${email}', '${password}', '${is_admin}', '${address}', '${bank_ac}' , ${phone_no})`;
    db.query(sql, (err, result) => {
        if (err) throw err;
        console.log(result);
    });
    res.redirect('/login');
});
//---------------------LOGOUT---------------------
app.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/');
});
//----------Search------------
app.get('/search', (req, res) => {
    let sql = 'SELECT * FROM stations';
    db.query(sql, (err, results) => {
        if (err) throw err;
        res.render('search', { stations: results, username: req.session.username, no_trains_error: false });
    });
    // res.render('search', { username: req.session.username, no_trains_error: false });
});
app.post('/search', (req, res) => {
    console.log(req.body, req.body.source, req.body.destination);
    let source = req.body.source;
    let destination = req.body.destination;
    let no_trains_error = false;
    let sql = `SELECT * FROM TRAIN_INFO WHERE source = '${source}' AND destination = '${destination}'`;
    db.query(sql, (err, results) => {
        if (err) throw err;
        console.log(results);
        if (results.length == 0) {
            no_trains_error = true;
            let sql = 'SELECT * FROM stations';
            db.query(sql, (err, results) => {
                if (err) throw err;
                res.render('search', { stations: results, username: req.session.username, no_trains_error: no_trains_error });
            });
        }
        else {
            res.render('searchresult', { data: results, username: req.session.username, no_trains_error: no_trains_error });
        }
    });
});


//----------Booking------------
app.get('/book/:train_no', isLoggedIn.isLoggedIn, (req, res) => {
    let train_no = req.params.train_no;
    let sql1 = `SELECT * FROM   TRAIN_INFO  WHERE train_no = '${train_no}'`;
    db.query(sql1, (err, results) => {
        if (err) throw err;
        console.log(results, results[0].train_no);
        res.render('book_ticket', { data: results, book_data: null, username: req.session.username, error: req.session.error_noseat });
    });
});
app.post('/book/:train_no', async (req, res) => {
    req.session.error_noseat = 0;
    let train_no = req.params.train_no;
    let date = req.body.date;
    req.session.date = req.body.date;
    req.session.seat_class = req.body.class;
    console.log(req.session.date);
    let seat_class = req.body.class;
    let data = [];
    let sql = `SELECT * FROM   TRAIN_INFO  WHERE train_no = '${train_no}'`;
    let sql1 = `SELECT * FROM SEAT_AVAILABILITY WHERE train_no = '${train_no}' AND DATE = '${date}' AND SEAT_CLASS ='${req.session.seat_class}'; `;

    db.query(sql, (err, results) => {
        if (err) throw err;
        //console.log(results);
        data = results;
    });
    db.query(sql1, (err, results) => {
        if (err) throw err;
        console.log(results[0], data);
        if (results[0] == null) {
            let price = 1000;
            if (req.session.seat_class == 'SL') {
                price = 700;
            }
            sql = `INSERT INTO SEAT_AVAILABILITY(train_no, DATE, SEAT_CLASS, SEATS_AVAILABLE , PRICE) VALUES('${train_no}', '${date}', '${req.session.seat_class}', 100 , ${price})`;
            db.query(sql, (err, results) => {
                if (err) throw err;
                console.log("DATA INSERTED suuccesfully");
            })
            db.query(sql1, (err, results) => {
                if (err) throw err;
                console.log(results);
                res.render('book_ticket', { data: data, book_data: results[0], username: req.session.username, error: req.session.error_noseat });
            });
        }
        else {
            res.render('book_ticket', { data: data, book_data: results[0], username: req.session.username, error: req.session.error_noseat });
        }

    });
});

//---------------BOOK TICKET-----------------
app.post('/book_ticket/:train_no', (req, res) => {
    let train_no = req.params.train_no;
    let date = req.session.date;
    console.log(train_no, req.body);
    let sql = `SELECT seats_available FROM SEAT_AVAILABILITY WHERE train_no = '${train_no}' AND DATE = '${date}' AND SEAT_CLASS = '${req.session.seat_class}'`;
    db.query(sql, (err, results) => {
        if (err) throw err;
        console.log(results);
        if (results[0].seats_available > 0 && req.body.no_of_seats > 0 && req.body.no_of_seats <= results[0].seats_available) {
            sql = `UPDATE SEAT_AVAILABILITY SET SEATS_AVAILABLE = SEATS_AVAILABLE - ${req.body.no_of_seats} WHERE train_no = '${train_no}' AND DATE = '${date}' AND SEAT_CLASS = '${req.session.seat_class}'`;
            db.query(sql, (err, results) => {
                if (err) throw err;
                console.log(results);
            });
            sql = `SELECT * FROM TRAIN_INFO  WHERE train_no = '${train_no}'`;
            db.query(sql, (err, results) => {
                let price = 1000;
                if (req.session.seat_class == 'SL') {
                    price = 700;
                }
                if (err) throw err;
                console.log(results);
                sql = `INSERT INTO BOOKINGS(username, train_no, source, destination, date, price ,seat_class ,no_of_seats) VALUES('${req.session.username}', '${train_no}', '${results[0].source}', '${results[0].destination}', '${date}', '${price * req.body.no_of_seats}' , '${req.session.seat_class}', '${req.body.no_of_seats}')`;
                db.query(sql, (err, results) => {
                    if (err) throw err;
                    console.log(results);
                });
                res.render('ticket_booked', { username: req.session.username });
            });
        }
        else {
            req.session.error_noseat = 1;
            res.redirect('/book/' + train_no);
        };

    })
})

//---------BOOKING HISTORY------------
app.get('/booking_history', isLoggedIn.isLoggedIn, (req, res) => {
    let sql = `SELECT * FROM BOOKINGS WHERE username = '${req.session.username}'`;
    db.query(sql, (err, results) => {
        if (err) throw err;
        console.log(results);
        for (let i = 0; i < results.length; i++) {
            results[i].date = moment(results[i].date).format('DD-MM-YYYY');
        }
        res.render('booking_history', { data: results, username: req.session.username });
    });
});

//---------CANCEL TICKET------------
app.get('/cancel_ticket/:book_id', isLoggedIn.isLoggedIn, (req, res) => {
    let sql = `SELECT * FROM BOOKINGS WHERE book_id = '${req.params.book_id}'`;
    db.query(sql, (err, results) => {
        if (err) throw err;
        sql = `DELETE FROM BOOKINGS WHERE book_id = '${req.params.book_id}'`;
        db.query(sql, (err, results) => {
            if (err) throw err;
            res.redirect('/booking_history');
        });

    });
});
//------------FINAL TICKET-----------
app.get('/final_ticket/:book_id' ,  isLoggedIn.isLoggedIn, (req,res) => {
    let sql = `SELECT * FROM BOOKINGS WHERE book_id = '${req.params.book_id}'`;
    db.query(sql, (err,results) => {
        if(err) throw err;
       // console.log(results[0].book_id );
        results[0].date = moment(results[0].date).format('DD-MM-YYYY');
        res.render('final_ticket' , {username : req.session.username , data: results});
    })
});
const port = 5000;
app.listen(port, () => {
    console.log(`Serving on port ${port}`)
})