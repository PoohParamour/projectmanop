const express = require("express");
const path = require("path");
const session = require("express-session");
const cookieParser = require("cookie-parser");
const port = 3000;
const sqlite3 = require('sqlite3').verbose();

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


function getLang(req) {
  return req.cookies.lang || "th"; // default = ไทย
}


// เปลี่ยนภาษา
app.get("/lang/:lng", (req, res) => {
    res.cookie("lang", req.params.lng, { maxAge: 1000 * 60 * 60 * 24 }); // เก็บ 1 วัน
    res.redirect("/");; // กลับไปหน้าเดิม
});



app.get("/", (req, res) => {
    const lang = getLang(req);
  res.render('home', { lang, order_type: req.session.order_type });
});

app.get('/order-type', (req, res) => {
  const t = req.query.order_type === 'TAKEAWAY' ? 'TAKEAWAY' : 'DINE_IN';
  req.session.order_type = t;
  res.redirect('/main');
});

// path ของเมนูทุกอย่าง
app.get('/main', function (req, res) {

    const lang = getLang(req);
    const nameCol = lang === "th" ? "name_thai" : "name_eng";
    const detailCol = lang === "th" ? "detail" : "detail_eng";

    const query = `SELECT menu_item_id,base_price,category_id,name_eng, category_id, ${nameCol} AS name, ${detailCol} AS detail, base_price 
                 FROM MenuItem`;
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        res.render('main_menu', { data: rows, lang });
    });
});


// path ของเมนูทุกอย่าง
app.get('/menu', function (req, res) {
    const lang = getLang(req);
    const nameCol = lang === "th" ? "name_thai" : "name_eng";
    const detailCol = lang === "th" ? "detail" : "detail_eng";

    const query = `SELECT menu_item_id,base_price,category_id,name_eng ,category_id, ${nameCol} AS name, ${detailCol} AS detail, base_price 
                 FROM MenuItem`;
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        console.log(rows);
        res.render('menu', { data: rows, lang });
    });
});

// path ของเมนูหมวดหมู่ PASTA & RICE
app.get('/pasta', function (req, res) {
    const lang = getLang(req);
    const nameCol = lang === "th" ? "name_thai" : "name_eng";
    const detailCol = lang === "th" ? "detail" : "detail_eng";

    const query = `SELECT menu_item_id, category_id, ${nameCol} AS name, ${detailCol} AS detail, base_price 
                 FROM MenuItem WHERE category_id = 2`;
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        console.log(rows);
        res.render('menu_pasta', { data: rows, lang });
    });
});

// path ของเมนูหมวดหมู่ Steak
app.get('/steak', function (req, res) {
    const lang = getLang(req);
    const nameCol = lang === "th" ? "name_thai" : "name_eng";
    const detailCol = lang === "th" ? "detail" : "detail_eng";

    const query = `SELECT menu_item_id, category_id, ${nameCol} AS name, ${detailCol} AS detail, base_price 
                 FROM MenuItem WHERE category_id = 3`;
    db.all(query, (err, rows) => {
        if (err) {
            console.log(err.message);
        }
        console.log(rows);
        res.render('menu_steak', { data: rows, lang });
    });
});

app.listen(port, () => {
    console.log(`Starting server at port ${port}`);
});


//  เพิ่มสินค้าเข้าสู่ตะกร้า

app.post("/add-to-cart", (req, res) => {
  // 📦 ดึงค่าที่ส่งมาจากฟอร์มในหน้า more.ejs
  // เช่น menu_item_id = 27, quantity = 2, และ options ต่าง ๆ
  const { menu_item_id, quantity, note, ...rest } = req.body;

  // ถ้ายังไม่มี session.cart → ให้สร้าง array ว่างไว้ก่อน
  if (!req.session.cart) req.session.cart = [];

  // แปลงจำนวนสินค้า (quantity) เป็นตัวเลข ถ้าไม่มีให้ค่าเริ่มต้น = 1
  const qty = parseInt(quantity) || 1;

  // 1: รวบรวมข้อมูล options ที่ลูกค้าเลือก (ถ้ามี)
  let options = [];
  for (let key in rest) {
    // เฉพาะ input name ที่ขึ้นต้นด้วย "options_"
    // (ตัวนี้มาจาก input radio/checkbox ของแต่ละ Option_Group)
    if (key.startsWith("options_")) {

      // เพราะบางกลุ่มเลือกได้หลายค่า (checkbox) บางกลุ่มเลือกได้ค่าเดียว (radio)
      // เราจึงต้องตรวจว่าเป็น array หรือไม่
      const values = Array.isArray(rest[key]) ? rest[key] : [rest[key]];

      // ตัวอย่างค่าที่ได้จาก form คือ "102|10" → (option_value_id|extra_price)
      values.forEach((v) => {
        const [id, price] = v.split("|"); // แยกค่า ID กับราคาพิเศษ (+)
        options.push({
          option_value_id: parseInt(id),      // เก็บไอดีของ option
          extra_price: parseFloat(price) || 0 // ราคาที่เพิ่ม (ถ้าไม่มี = 0)
        });
      });
    }
  }
  // 2: ตรวจว่ามีสินค้า "แบบเดียวกัน" อยู่แล้วหรือไม่
  const existingItem = req.session.cart.find((item) => {
    // ต้องตรงทั้ง menu_item_id และตัวเลือก (options)
    const sameMenu = item.menu_item_id == menu_item_id;

    // ตรวจว่า options เดิมและ options ใหม่เหมือนกันหรือไม่
    // ใช้ JSON.stringify หลัง sort เพื่อป้องกันปัญหาลำดับไม่ตรง
    const sameOptions =
      JSON.stringify(item.options.sort((a, b) => a.option_value_id - b.option_value_id)) ===
      JSON.stringify(options.sort((a, b) => a.option_value_id - b.option_value_id));

    // ถ้าตรงทั้งเมนูและตัวเลือก → ถือว่าเป็นเมนูเดียวกัน
    return sameMenu && sameOptions;
  });

  // 3: ถ้ามีสินค้าชนิดเดียวกันอยู่แล้ว → แค่เพิ่มจำนวน
  if (existingItem) {
    // เพิ่มจำนวนสินค้าในรายการนั้น
    existingItem.quantity += qty;
  } 
  // 4: ถ้ายังไม่มี → เพิ่มรายการใหม่เข้า session.cart
  else {
    req.session.cart.push({
      menu_item_id,   // รหัสเมนู
      quantity: qty,  // จำนวนที่เลือก
      options,         // ตัวเลือก (option group)
      note: note ? String(note).trim() : null // ← เก็บ note กับรายการ
    });
  }
  // 🧾 แสดงข้อมูลตะกร้าใน console เพื่อ debug
  console.log("🛒 Updated Cart:", req.session.cart);
  // ✅ เสร็จแล้วกลับไปหน้าเมนูหลัก
  res.redirect("/main");
});


// -------------------------------
//  path ของตะกร้าสินค้า
// -------------------------------
app.get("/cart", (req, res) => {
  // 🔹 ตรวจภาษาที่ผู้ใช้เลือก (ไทย/อังกฤษ)
  const lang = getLang(req);

  // 🔹 เลือกคอลัมน์ชื่อ/รายละเอียดตามภาษา
  const nameCol = lang === "th" ? "name_thai" : "name_eng";
  const detailCol = lang === "th" ? "detail" : "detail_eng";

  // 🔹 อ่านข้อมูลตะกร้าจาก session
  const cart = req.session.cart || [];

  // ถ้าไม่มีสินค้าเลย → แสดงหน้าตะกร้าว่าง
  if (cart.length === 0) {
    return res.render("cart", { data: [], lang });
  }

  // 🔹 รวบรวม menu_item_id ทั้งหมดที่อยู่ใน cart
  const ids = cart.map((i) => i.menu_item_id).join(",");

  // 🔹 ดึงข้อมูลสินค้า (ชื่อ, รายละเอียด, ราคา) จาก DB
  const query = `SELECT menu_item_id, ${nameCol} AS name, ${detailCol} AS detail, base_price, category_id, name_eng 
                 FROM MenuItem WHERE menu_item_id IN (${ids})`;

  db.all(query, (err, menuRows) => {
    if (err) {
      console.error(err.message);
      return res.render("cart", { data: [], lang });
    }

    // 🔹 สร้างรายการสินค้าแบบ 1:1 กับใน session
    //    เพื่อไม่ให้สินค้าที่ menu_id ซ้ำกัน merge รวมกัน
    const merged = cart.map((c) => {
      // หาเมนูหลักจาก DB ที่ตรงกับใน cart
      const menu = menuRows.find((m) => m.menu_item_id == c.menu_item_id);

      // รวมข้อมูลจากทั้ง DB (ชื่อ/ราคา) และ session (จำนวน/option)
      return menu
        ? {
            ...menu,
            quantity: c.quantity,
            rawOptions: c.options, // option ที่เลือกจากหน้า more.ejs
            note: c.note ? String(c.note).trim() : null,  
          }
        : null;
    }).filter(Boolean); // กรอง null ถ้ามีเมนูที่หาไม่เจอใน DB

    // 🔹 รวม option_value_id ทั้งหมด (สำหรับ query ข้อมูลชื่อ/ราคา)
    const allOptionIds = merged.flatMap((m) =>
      m.rawOptions.map((o) => o.option_value_id)
    );

    // ✅ กรณีไม่มี option (เช่น Coke, Fries)
    if (allOptionIds.length === 0) {
      merged.forEach((m) => {
        m.options = [];
        m.final_price = m.base_price;
      });
      return res.render("cart", { data: merged, lang });
    }

    // 🔹 Query option_value ทั้งหมด (เพื่อเอาชื่อไทย/อังกฤษมาแสดง)
    const optionQuery = `
      SELECT option_value_id, name, name_eng, extra_price
      FROM Option_Value 
      WHERE option_value_id IN (${allOptionIds.join(",")})
    `;

    db.all(optionQuery, (err2, optionRows) => {
      if (err2) {
        console.error(err2.message);
        return res.render("cart", { data: merged, lang });
      }

      // 🔹 เติมข้อมูล option (ชื่อ + ราคาเพิ่ม) กลับเข้าไปในแต่ละเมนู
      merged.forEach((m) => {
        m.options = m.rawOptions.map((o) => {
          const match = optionRows.find(
            (opt) => opt.option_value_id == o.option_value_id
          );
          return {
            name: match ? (lang === "th" ? match.name : match.name_eng) : "",
            extra_price: o.extra_price,
          };
        });

        // 🔹 คำนวณราคาสุดท้ายของแต่ละเมนู (base_price + options)
        const option_total = m.options.reduce(
          (sum, o) => sum + o.extra_price,
          0
        );
        m.final_price = m.base_price + option_total;
      });

      // ✅ ส่งข้อมูลทั้งหมดไปหน้า cart.ejs
      res.render("cart", { data: merged, lang });
    });
  });
});


// -------------------------------
//  path more (หน้าเลือก option ของเมนู)
// -------------------------------
app.get("/more/:id", (req, res) => {
  // 🔹 ตรวจภาษาที่เลือก (ไทย/อังกฤษ)
  const lang = getLang(req);

  // 🔹 กำหนดว่าจะใช้คอลัมน์ไหนใน DB ตามภาษา
  const nameCol = lang === "th" ? "name_thai" : "name_eng";
  const detailCol = lang === "th" ? "detail" : "detail_eng";

  // 🔹 query ข้อมูลเมนูตาม id ที่กดเข้ามา (แสดงชื่อ, รายละเอียด, ราคา base)
  const queryMenu = `SELECT menu_item_id, category_id, ${nameCol} AS name, ${detailCol} AS detail, base_price, name_eng 
                     FROM MenuItem WHERE menu_item_id = ?`;

  // 🔹 ดึงข้อมูลเมนูจาก DB
  db.get(queryMenu, [req.params.id], (err, menu) => {
    if (err || !menu) 
      return res.status(404).send("❌ ไม่พบเมนู"); // ถ้า error หรือหาไม่เจอ

    // 🔹 หา option group ของเมนูนี้ (เช่น ระดับความสุก, เลือกซอส, เลือกเครื่องเคียง)
    db.all(
      "SELECT * FROM Option_Group WHERE menu_item_id = ?",
      [menu.menu_item_id],
      (err, groups) => {
        // ถ้าไม่มี option group → ส่ง options ว่างไป render
        if (!groups || groups.length === 0)
          return res.render("more", { item: menu, options: [], lang });

        // 🔹 รวบรวม option_group_id ของเมนูนี้ เช่น "1,2,3"
        const groupIds = groups.map((g) => g.option_group_id).join(",");

        // 🔹 ดึง option values ที่อยู่ใน group เหล่านี้ เช่น Rare, Medium, BBQ Sauce ฯลฯ
        db.all(
          `SELECT * FROM Option_Value WHERE option_group_id IN (${groupIds})`,
          (err, values) => {
            if (err) 
              return res.render("more", { item: menu, options: [], lang });

            // 🔹 สร้างโครง optionData = group + values ของมัน
            const optionData = groups.map((g) => ({
              ...g, // copy field ของ group เช่น id, min_select, max_select
              // 🔹 แปลชื่อ group ตามภาษาที่เลือก
              translated_name: lang === "th" ? g.name : g.name_eng,
              // 🔹 ใส่ option values (แปลชื่อ option ตามภาษาด้วย)
              values: values
                .filter((v) => v.option_group_id === g.option_group_id)
                .map((v) => ({
                  ...v,
                  translated_name: lang === "th" ? v.name : v.name_eng,
                })),
            }));

            // 🔹 ส่งไป render หน้า more.ejs
            res.render("more", { item: menu, options: optionData, lang });
          }
        );
      }
    );
  });
});

// อัปเดตจำนวนสินค้า
app.post("/cart/update", (req, res) => {
  const { index, action } = req.body;
  if (!req.session.cart) req.session.cart = [];

  const i = parseInt(index);
  if (!isNaN(i) && req.session.cart[i]) {
    if (action === "increase") {
      req.session.cart[i].quantity += 1;
    } else if (action === "decrease") {
      req.session.cart[i].quantity -= 1;
      if (req.session.cart[i].quantity <= 0) {
        req.session.cart.splice(i, 1); // ถ้าติดลบ → ลบออก
      }
    }
  }
  res.redirect("/cart");
});

app.post("/cart/remove", (req, res) => {
  const { index } = req.body;
  if (!req.session.cart) req.session.cart = [];
  const i = parseInt(index);
  if (!isNaN(i)) {
    req.session.cart.splice(i, 1);
  }
  res.redirect("/cart");
});

// PUSH session -> DB (callback ล้วน, ใส่ราคาเป็น 0 ไว้ก่อนให้เรียบง่าย)
app.post('/checkout', (req, res) => {
  const cart = req.session.cart || [];
  if (!cart.length) return res.redirect('/cart');

  const orderType = req.session.order_type || null; // ← ค่าที่เลือกจากหน้าแรก

  db.serialize(() => {
    let rolled = false;
    const rb = (e) => { if (rolled) return; rolled = true; db.run('ROLLBACK', () => res.status(500).send('fail')); };

    db.run('BEGIN', (err) => {
      if (err) return rb(err);

      db.run(
        `INSERT INTO "Order"(order_type, queue_no, status) VALUES (?, NULL, 'PENDING')`,
        [orderType],                                     // << ใช้ค่าที่เลือก
        function (err) {
          if (err) return rb(err);
          const orderId = this.lastID;

          let pending = 0;
          cart.forEach(it => pending += 1 + (Array.isArray(it.options) ? it.options.length : 0));
          if (!pending) return db.run('COMMIT', () => { req.session.cart = []; res.redirect('/kitchen'); });

          const done = () => {
            if (--pending === 0) db.run('COMMIT', () => {
              req.session.cart = [];
              // ถ้าต้องการเริ่มรอบใหม่ให้ผู้ใช้เลือกใหม่ด้วย:
              // req.session.order_type = null;
              const redirectTo = req.body.redirect || '/kitchen';
              res.redirect(redirectTo);
            });
          };

          cart.forEach(it => {
            const qty = parseInt(it.quantity, 10) || 1;
            db.run(
              `INSERT INTO OrderItem(menu_item_id, order_id, quantity, unit_price, note)
               VALUES (?,?,?,?,?)`,
              [it.menu_item_id, orderId, qty, 0, it.note],        // ราคา 0 ไว้ก่อน
              function (err) {
                if (err) return rb(err);
                const oiId = this.lastID; done();

                (Array.isArray(it.options) ? it.options : []).forEach(op => {
                  db.run(
                    `INSERT INTO OrderItemOption(order_item_id, option_value_id, extra_price)
                     VALUES (?,?,?)`,
                    [oiId, op.option_value_id, 0],       // ราคาเพิ่ม 0 ไว้ก่อน
                    (err) => { if (err) return rb(err); done(); }
                  );
                });
              }
            );
          });
        }
      );
    });
  });
});

// หน้า list
app.get('/kitchen', (req, res) => {
  res.render('kitchen_list', { lang: getLang(req) });
});

// หน้า detail
app.get('/kitchen/:orderId', (req, res) => {
  res.render('kitchen_detail', { orderId: req.params.orderId, lang: getLang(req) });
});

// app.get('/api/kitchen', (req, res) => {
//   const status = (req.query.status || 'PENDING').toUpperCase(); // PENDING | DONE | ALL
//   const where = (status === 'ALL') ? '' : 'WHERE o.status = ?';
//   const params = (status === 'ALL') ? [] : [status];

//   const sql = `
//     SELECT 
//       o.order_id, o.order_type, o.status,
//       oi.order_item_id, oi.quantity,
//       m.name_thai AS item_name_th, m.name_eng AS item_name_en
//     FROM "Order" o
//     JOIN OrderItem oi ON oi.order_id = o.order_id
//     JOIN MenuItem  m  ON m.menu_item_id = oi.menu_item_id
//     ${where}
//     ORDER BY o.order_id ASC, oi.order_item_id ASC
//   `;
//   db.all(sql, params, (err, rows) => {
//     if (err) return res.status(500).json({ error: err.message });
//     res.json(rows);
//   });
// });

app.get('/api/kitchen', (req, res) => {
  const status = (req.query.status || 'PENDING').toUpperCase();
  const where = (status === 'ALL') ? '' : 'WHERE o.status = ?';
  const params = (status === 'ALL') ? [] : [status];

  const sql = `
    SELECT 
      o.order_id, o.order_type, o.status,
      oi.order_item_id, oi.quantity,
      m.category_id AS category_id,              -- ✅ เพิ่มบรรทัดนี้
      m.name_thai AS item_name_th, m.name_eng AS item_name_en
    FROM "Order" o
    JOIN OrderItem oi ON oi.order_id = o.order_id
    JOIN MenuItem  m  ON m.menu_item_id = oi.menu_item_id
    ${where}
    ORDER BY o.order_id ASC, oi.order_item_id ASC
  `;
  db.all(sql, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(rows);
  });
});


// app.get('/api/kitchen/order/:orderId', (req, res) => {
//   const sql = `
//     SELECT 
//       o.order_id, o.order_type, o.status,
//       oi.order_item_id, oi.quantity, oi.note AS item_note
//       m.category_id AS category_id,              -- ✅ เพิ่มบรรทัดนี้
//       m.name_thai AS item_name_th, m.name_eng AS item_name_en,
      
//     (
//         SELECT GROUP_CONCAT(ov.name, ', ')
//         FROM OrderItemOption oio
//         JOIN Option_Value ov ON ov.option_value_id = oio.option_value_id
//         JOIN Option_Group og ON og.option_group_id = ov.option_group_id
//         WHERE oio.order_item_id = oi.order_item_id
//         ORDER BY og.option_group_id, ov.option_value_id 
//       ) AS options_text


//     FROM "Order" o
//     JOIN OrderItem oi ON oi.order_id = o.order_id
//     JOIN MenuItem  m  ON m.menu_item_id = oi.menu_item_id
//     WHERE o.order_id = ?
//     ORDER BY oi.order_item_id ASC
//   `;
//   db.all(sql, [req.params.orderId], (err, rows) =>
//     err ? res.status(500).json({ error: err.message }) : res.json(rows)
//   );
// });

// app.all('/api/kitchen/orders/:orderId/done', (req, res) => {
//   if (!['PATCH', 'POST'].includes(req.method)) return res.status(405).json({ error: 'Method not allowed' });
//   const id = parseInt(req.params.orderId, 10);
//   if (Number.isNaN(id)) return res.status(400).json({ error: 'bad orderId' });

//   db.run(`UPDATE "Order" SET status='DONE' WHERE order_id=?`, [id], function (err) {
//     if (err) return res.status(500).json({ error: err.message });
//     // this.changes = 0 ถ้าอัปเดตก่อนหน้าเป็น DONE อยู่แล้ว
//     res.json({ ok: true, order_id: id, changes: this.changes });
//   });
// });

// GET one order (with item_note, category_id, options_text)
app.get('/api/kitchen/order/:orderId', (req, res) => {
  const id = parseInt(req.params.orderId, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'bad orderId' });

  const sql = `
    SELECT 
      o.order_id, o.order_type, o.status,
      oi.order_item_id, oi.quantity, 
      oi.note AS item_note,
      m.category_id AS category_id,
      m.name_thai AS item_name_th, 
      m.name_eng  AS item_name_en,
      (
        SELECT GROUP_CONCAT(og.name || ': ' || ov.name, ', ')
        FROM OrderItemOption oio
        JOIN Option_Value ov ON ov.option_value_id = oio.option_value_id
        JOIN Option_Group og ON og.option_group_id = ov.option_group_id
        WHERE oio.order_item_id = oi.order_item_id
        ORDER BY og.option_group_id, ov.option_value_id
      ) AS options_text
    FROM "Order" o
    JOIN OrderItem oi ON oi.order_id = o.order_id
    JOIN MenuItem  m  ON m.menu_item_id = oi.menu_item_id
    WHERE o.order_id = ?
    ORDER BY oi.order_item_id ASC
  `;

  db.all(sql, [id], (err, rows) => {
    if (err) {
      console.error('API /api/kitchen/order error:', {
        message: err.message, code: err.code, params: [id], sql
      });
      return res.status(500).json({ error: err.message, code: err.code });
    }
    res.json(rows);
  });
});

// PATCH/POST mark order DONE
app.all('/api/kitchen/orders/:orderId/done', (req, res) => {
  if (!['PATCH', 'POST'].includes(req.method)) {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const id = parseInt(req.params.orderId, 10);
  if (Number.isNaN(id)) return res.status(400).json({ error: 'bad orderId' });

  const sql = `UPDATE "Order" SET status='DONE' WHERE order_id=?`;
  db.run(sql, [id], function (err) {
    if (err) {
      console.error('API /done error:', { message: err.message, code: err.code, params: [id], sql });
      return res.status(500).json({ error: err.message, code: err.code });
    }
    res.json({ ok: true, order_id: id, changes: this.changes });
  });
});


// Payment 
app.get('/payment', (req, res) => {
  // 🔹 ตรวจภาษาที่ผู้ใช้เลือก (ไทย/อังกฤษ)
  const lang = getLang(req);
  
  res.render('payment', {
    paid: false,
    amount: 199.00,
    qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=PAYMENT-DEMO",
    lang
  });
});

// หน้าแสดงผลชำระเงินเสร็จ
app.get('/payment/success', (req, res) => {
  const lang = getLang(req);

  res.render('payment', {
    paid: true,
    orderId: "123456",
    lang
  });
});


// ชั่วคราว: ดูสถานะและจำนวนนับ
app.get('/debug/kitchen', (req, res) => {
  db.serialize(() => {
    db.all(`SELECT order_id, status FROM "Order" ORDER BY order_id DESC LIMIT 5`, (e1, r1) => {
      db.all(`SELECT order_id, COUNT(*) as items FROM OrderItem GROUP BY order_id ORDER BY order_id DESC LIMIT 5`, (e2, r2) => {
        res.json({ orders: r1 || [], items: r2 || [], err1: e1 && e1.message, err2: e2 && e2.message });
      });
    });
  });
});