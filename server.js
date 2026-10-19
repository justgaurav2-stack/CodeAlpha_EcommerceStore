const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const path = require('path');
const { run, get, all } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'change-this-secret',
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 24 * 7 },
  })
);
app.use(express.static(path.join(__dirname, 'public')));

const requireLogin = (req, res, next) =>
  req.session.userId ? next() : res.status(401).json({ error: 'Please log in first.' });

const wrap = fn => (req, res) =>
  fn(req, res).catch(err => {
    console.error(err);
    res.status(500).json({ error: 'Server error.' });
  });

/* ---------- Products ---------- */
app.get('/api/products', wrap(async (req, res) => {
  const { q = '', category = '' } = req.query;
  const rows = await all(
    `SELECT * FROM products
     WHERE (name LIKE ? OR description LIKE ?)
     AND (? = '' OR category = ?)
     ORDER BY id`,
    [`%${q}%`, `%${q}%`, category, category]
  );
  res.json(rows);
}));

app.get('/api/categories', wrap(async (req, res) => {
  const rows = await all('SELECT DISTINCT category FROM products ORDER BY category');
  res.json(rows.map(r => r.category));
}));

app.get('/api/products/:id', wrap(async (req, res) => {
  const product = await get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  product ? res.json(product) : res.status(404).json({ error: 'Product not found.' });
}));

/* ---------- Auth ---------- */
app.post('/api/register', wrap(async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'Name, email and password are required.' });
  if (password.length < 6)
    return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const mail = email.toLowerCase();
  if (await get('SELECT id FROM users WHERE email = ?', [mail]))
    return res.status(409).json({ error: 'An account with this email already exists.' });

  const hash = bcrypt.hashSync(password, 10);
  const info = await run('INSERT INTO users (name, email, password) VALUES (?, ?, ?)', [name, mail, hash]);
  req.session.userId = info.lastID;
  res.json({ id: info.lastID, name, email: mail });
}));

app.post('/api/login', wrap(async (req, res) => {
  const { email = '', password = '' } = req.body;
  const user = await get('SELECT * FROM users WHERE email = ?', [email.toLowerCase()]);
  if (!user || !bcrypt.compareSync(password, user.password))
    return res.status(401).json({ error: 'Email or password is incorrect.' });
  req.session.userId = user.id;
  res.json({ id: user.id, name: user.name, email: user.email });
}));

app.post('/api/logout', (req, res) => req.session.destroy(() => res.json({ ok: true })));

app.get('/api/me', wrap(async (req, res) => {
  if (!req.session.userId) return res.json(null);
  res.json(await get('SELECT id, name, email FROM users WHERE id = ?', [req.session.userId]));
}));

/* ---------- Orders ---------- */
app.post('/api/orders', requireLogin, wrap(async (req, res) => {
  const { items, address } = req.body;
  if (!Array.isArray(items) || items.length === 0)
    return res.status(400).json({ error: 'Your cart is empty.' });
  if (!address || address.trim().length < 8)
    return res.status(400).json({ error: 'Please enter a full delivery address.' });

  // Price hamesha database se lo, browser par bharosa nahi
  let total = 0;
  const lines = [];
  for (const { id, quantity } of items) {
    const qty = parseInt(quantity, 10);
    const product = await get('SELECT * FROM products WHERE id = ?', [id]);
    if (!product || !(qty > 0)) return res.status(400).json({ error: 'Invalid item in cart.' });
    if (product.stock < qty)
      return res.status(400).json({ error: `Only ${product.stock} left of ${product.name}.` });
    total += product.price * qty;
    lines.push({ product, qty });
  }

  try {
    await run('BEGIN');
    const order = await run('INSERT INTO orders (user_id, total, address) VALUES (?, ?, ?)', [
      req.session.userId, total, address.trim(),
    ]);
    for (const { product, qty } of lines) {
      await run('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)', [
        order.lastID, product.id, qty, product.price,
      ]);
      await run('UPDATE products SET stock = stock - ? WHERE id = ?', [qty, product.id]);
    }
    await run('COMMIT');
    res.status(201).json({ id: order.lastID, total });
  } catch (err) {
    await run('ROLLBACK').catch(() => {});
    throw err;
  }
}));

app.get('/api/orders', requireLogin, wrap(async (req, res) => {
  const orders = await all('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC', [req.session.userId]);
  for (const o of orders) {
    o.items = await all(
      `SELECT oi.quantity, oi.price, p.name, p.image
       FROM order_items oi JOIN products p ON p.id = oi.product_id
       WHERE oi.order_id = ?`,
      [o.id]
    );
  }
  res.json(orders);
}));

app.listen(PORT, () => console.log(`Store running at http://localhost:${PORT}`));