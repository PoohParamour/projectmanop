const express = require("express");
const path = require("path");
const port = 3000;
const sqlite3 = require('sqlite3').verbose();
const i18n = require("i18n");

// Creating the Express server
const app = express();

// Connect to SQLite database
let db = new sqlite3.Database('project.db', (err) => {
    if (err) {
        return console.error(err.message);
    }
    console.log('Connected to the SQlite database.');
});


// static resourse & templating engine
app.use(express.static(path.join(__dirname, 'public')));
// Set EJS as templating engine
app.set('view engine', 'ejs');

app.use(express.json())
app.use(express.urlencoded({ extended: true }))

app.get("/", (req, res) => {
    res.render('home');
});


// path ของเมนูทุกอย่าง
app.get('/menu', function (req, res) {
    const query = 'SELECT * FROM MenuItem;';
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        console.log(rows);
        res.render('menu', { data: rows });
    });
});

// path ของเมนูหมวดหมู่ PASTA & RICE
app.get('/pasta', function (req, res) {
    const query = `SELECT * FROM MenuItem
                   WHERE category_id = 2;`;
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        console.log(rows);
        res.render('menu_pasta', { data: rows });
    });
});

// path ของเมนูหมวดหมู่ Steak
app.get('/steak', function (req, res) {
    const query = `SELECT * FROM MenuItem
                   WHERE category_id = 3;`;
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        console.log(rows);
        res.render('menu_steak', { data: rows });
    });
});

app.listen(port, () => {
    console.log(`Starting server at port ${port}`);
});

