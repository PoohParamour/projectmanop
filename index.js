const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
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


// Middleware setup
app.use(cookieParser());
app.use(session({
  secret: 'your-secret-key-for-your-store', 
  resave: false,
  saveUninitialized: true,
  cookie: { maxAge: 10 * 60000 } 
}));

app.set('view engine', 'ejs');
app.use(express.static(path.join(__dirname, 'public')));


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


//  เพิ่มสินค้าเข้าสู่ตะกร้า

app.post('/add-to-cart', (req, res) => {
    // ดึงค่าที่ส่งมาจากฟอร์มใน more.ejs
    const { menu_item_id, quantity, ...rest } = req.body;

    // ถ้ายังไม่มี session cart → สร้าง array ว่างขึ้นมา
    if (!req.session.cart) {
        req.session.cart = [];
    }

    const qty = parseInt(quantity) || 1; // จำนวนสินค้า (ถ้าไม่มีให้ default = 1)

    // เก็บ options ที่ลูกค้าเลือก
    let options = [];
    for (let key in rest) {
        if (key.startsWith("options_")) { // input ที่ชื่อขึ้นต้น options_ คือค่าจากฟอร์ม option
            const values = Array.isArray(rest[key]) ? rest[key] : [rest[key]]; // รองรับทั้ง radio และ checkbox
            values.forEach(v => {
                const [id, price] = v.split("|"); // ข้อมูลที่ส่งมาคือ "option_value_id|extra_price"
                options.push({
                    option_value_id: parseInt(id),
                    extra_price: parseFloat(price) || 0
                });
            });
        }
    }

    // push ลงตะกร้าใน session
    req.session.cart.push({
        menu_item_id,
        quantity: qty,
        options
    });

    console.log("Cart after add:", req.session.cart);
    res.redirect('/main'); // เสร็จแล้วไปหน้า menu
});


// -------------------------------
//  path ของตะกร้าสินค้า
// -------------------------------
app.get('/cart', (req, res) => {
    const cart = req.session.cart || [];

    // ถ้าตะกร้าว่าง render หน้า cart แต่ไม่มีข้อมูล
    if (cart.length === 0) {
        return res.render('cart', { data: [] });
    }

    // ดึงข้อมูลเมนูที่อยู่ใน cart
    const ids = cart.map(i => i.menu_item_id).join(',');
    const query = `SELECT menu_item_id, category_id, name_thai, name_eng, detail, base_price 
                   FROM MenuItem 
                   WHERE menu_item_id IN (${ids})`;

    db.all(query, (err, rows) => {
        if (err) {
            console.error(err.message);
            return res.render('cart', { data: [] });
        }

        // รวมข้อมูลจาก cart (session) กับข้อมูลเมนู (DB)
        const merged = rows.map(r => {
            const found = cart.find(c => c.menu_item_id == r.menu_item_id);

            let optionIds = found.options.map(o => o.option_value_id);
            return {
                ...r,
                quantity: found.quantity,
                optionIds,
                rawOptions: found.options
            };
        });

        // ถ้าไม่มี option เลย → ใช้ base_price
        const allOptionIds = merged.flatMap(m => m.optionIds || []);
        if (allOptionIds.length === 0) {
            merged.forEach(m => {
                m.options = [];
                m.final_price = m.base_price;
            });
            return res.render('cart', { data: merged });
        }

        // ดึงข้อมูล option จาก DB ตาม option_value_id ที่เลือกไว้
        const optionQuery = `SELECT option_value_id, name, extra_price 
                             FROM Option_Value 
                             WHERE option_value_id IN (${allOptionIds.join(',')})`;

        db.all(optionQuery, (err2, optionRows) => {
            if (err2) {
                console.error(err2.message);
                return res.render('cart', { data: merged });
            }

            // ใส่ option ที่เลือกกลับไปใน item แต่ละตัว
            merged.forEach(m => {
                m.options = m.rawOptions.map(o => {
                    const match = optionRows.find(opt => opt.option_value_id == o.option_value_id);
                    return {
                        name: match ? match.name : '',     // ชื่อ option (เช่น Rare, BBQ Sauce)
                        extra_price: o.extra_price        // ราคาที่เพิ่ม
                    };
                });

                // final_price = base_price + option_extra_price รวมทั้งหมด
                const option_total = m.options.reduce((sum, o) => sum + o.extra_price, 0);
                m.final_price = m.base_price + option_total;
            });

            // ส่งข้อมูลไป render cart.ejs
            res.render('cart', { data: merged });
        });
    });
});


// -------------------------------
//  path more (หน้าเลือก option ของเมนู)
// -------------------------------
app.get('/more/:id', (req, res) => {
    const id = req.params.id;

    // ดึงข้อมูลเมนู
    const queryMenu = "SELECT * FROM MenuItem WHERE menu_item_id = ?";
    db.get(queryMenu, [id], (err, menu) => {
        if (err) {
            console.error(err.message);
            return res.status(500).send("Database error");
        }

        if (!menu) {
            return res.status(404).send("ไม่พบเมนูนี้");
        }

        // ดึง option groups ของเมนูนี้ (เช่น "ระดับความสุก", "เลือกซอส")
        const queryGroup = "SELECT * FROM Option_Group WHERE menu_item_id = ?";
        db.all(queryGroup, [id], (err, groups) => {
            if (err) {
                console.error(err.message);
                return res.render('more', { item: menu, options: [] });
            }

            // ถ้าเมนูนี้ไม่มี option group เลย → ส่ง options ว่าง
            if (groups.length === 0) {
                return res.render('more', { item: menu, options: [] });
            }

            // ดึง option values ตาม group id ที่เจอ
            const groupIds = groups.map(g => g.option_group_id).join(',');
            const queryValue = `SELECT * FROM Option_Value WHERE option_group_id IN (${groupIds})`;

            db.all(queryValue, (err, values) => {
                if (err) {
                    console.error(err.message);
                    return res.render('more', { item: menu, options: [] });
                }

                // รวม Group + Option ของมัน
                const optionData = groups.map(g => ({
                    ...g, // copy field group
                    values: values.filter(v => v.option_group_id === g.option_group_id) // option ที่อยู่ใน group นี้
                }));

                // ส่งไป render more.ejs (หน้าเลือก option ก่อนเพิ่มตะกร้า)
                res.render('more', { item: menu, options: optionData });
            });
        });
    });
});

app.get('/main', function (req, res) {
    const query = 'SELECT * FROM MenuItem;';
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        console.log(rows);
        res.render('main_menu', { data: rows });
    });
});

// Payment จิ๋มกระป๋อง

