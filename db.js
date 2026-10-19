const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('store.db');

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    price INTEGER NOT NULL,
    category TEXT,
    image TEXT,
    stock INTEGER NOT NULL DEFAULT 50
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    total INTEGER NOT NULL,
    address TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Placed',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS order_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    price INTEGER NOT NULL
  )`);

  // Sample products (sirf pehli baar)
  db.get('SELECT COUNT(*) AS c FROM products', (err, row) => {
    if (err || row.c > 0) return;
    const items = [
      ['Wireless Earbuds', 'Bluetooth 5.3 earbuds with 24-hour battery life.', 1499, 'Electronics', '🎧', 40],
      ['Mechanical Keyboard', 'Compact 75% layout with hot-swappable switches.', 3299, 'Electronics', '⌨️', 25],
      ['Smart Watch', 'Heart-rate, sleep tracking and 7-day battery.', 2799, 'Electronics', '⌚', 30],
      ['Power Bank 20000mAh', 'Fast-charging power bank with USB-C port.', 1799, 'Electronics', '🔋', 60],
      ['Cotton Hoodie', 'Heavyweight brushed-cotton hoodie, relaxed fit.', 1299, 'Clothing', '🧥', 35],
      ['Running Shoes', 'Lightweight mesh upper with cushioned sole.', 2499, 'Clothing', '👟', 20],
      ['Canvas Backpack', '25L backpack with laptop sleeve.', 999, 'Clothing', '🎒', 45],
      ['Steel Water Bottle', 'Insulated bottle, keeps drinks cold 24h.', 599, 'Home', '🍶', 80],
      ['Desk Lamp', 'Dimmable LED lamp with USB port.', 849, 'Home', '💡', 50],
      ['Ceramic Mug Set', 'Set of four 300ml stoneware mugs.', 699, 'Home', '☕', 55],
      ['Notebook Bundle', 'Three dotted-grid notebooks, 120 pages each.', 349, 'Stationery', '📓', 100],
      ['Gel Pen Pack', 'Pack of 10 smooth gel pens.', 199, 'Stationery', '🖊️', 120],
    ];
    const stmt = db.prepare(
      'INSERT INTO products (name, description, price, category, image, stock) VALUES (?, ?, ?, ?, ?, ?)'
    );
    items.forEach(i => stmt.run(i));
    stmt.finalize();
  });
});

/* Promise helpers taaki server.js mein async/await use kar sakein */
const run = (sql, params = []) =>
  new Promise((resolve, reject) =>
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve({ lastID: this.lastID, changes: this.changes });
    })
  );
const get = (sql, params = []) =>
  new Promise((resolve, reject) => db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row))));
const all = (sql, params = []) =>
  new Promise((resolve, reject) => db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows))));

module.exports = { db, run, get, all };