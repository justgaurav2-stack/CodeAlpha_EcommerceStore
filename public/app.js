const app = document.getElementById('app');
const nav = document.getElementById('nav');
const toastEl = document.getElementById('toast');

let user = null;
let cart = JSON.parse(localStorage.getItem('cart') || '[]');
let nextRoute = null; // login ke baad kahan jaana hai

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => '₹' + Number(n).toLocaleString('en-IN');
const cartCount = () => cart.reduce((a, c) => a + c.qty, 0);
const cartTotal = () => cart.reduce((a, c) => a + c.qty * c.price, 0);

function saveCart() {
  localStorage.setItem('cart', JSON.stringify(cart));
  renderNav();
}

function toast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => toastEl.classList.remove('show'), 2200);
}

async function api(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Something went wrong.');
  return data;
}

function addToCart(p, qty = 1) {
  const existing = cart.find(i => i.id === p.id);
  const have = existing ? existing.qty : 0;
  if (have + qty > p.stock) return toast(`Only ${p.stock} in stock.`);
  if (existing) existing.qty += qty;
  else cart.push({ id: p.id, name: p.name, price: p.price, image: p.image, qty });
  saveCart();
  toast(`${p.name} added to cart`);
}

/* ---------- nav ---------- */
function renderNav() {
  nav.innerHTML = `
    <a href="#/">Shop</a>
    <a href="#/cart">Cart<span class="badge">${cartCount()}</span></a>
    ${user
      ? `<a href="#/orders">My orders</a><button id="logout">Log out (${esc(user.name.split(' ')[0])})</button>`
      : `<a href="#/login">Log in</a><a href="#/register">Sign up</a>`}`;
  const lo = document.getElementById('logout');
  if (lo) lo.onclick = async () => {
    await api('/api/logout', { method: 'POST' });
    user = null; renderNav(); location.hash = '#/'; toast('Logged out');
  };
}

/* ---------- pages ---------- */
async function shopPage() {
  const categories = await api('/api/categories');
  let category = '';
  let q = '';

  app.innerHTML = `
    <h1>Everyday things, delivered.</h1>
    <p class="sub">Pick what you need and check out in a minute.</p>
    <div class="filters">
      <input type="search" id="q" placeholder="Search products" aria-label="Search products" />
      <button class="chip active" data-cat="">All</button>
      ${categories.map(c => `<button class="chip" data-cat="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <div class="grid" id="grid"></div>`;

  const grid = document.getElementById('grid');

  async function load() {
    const products = await api(`/api/products?q=${encodeURIComponent(q)}&category=${encodeURIComponent(category)}`);
    if (!products.length) { grid.innerHTML = '<p class="empty">No products match. Try a different search.</p>'; return; }
    grid.innerHTML = products.map(p => `
      <article class="card">
        <a href="#/product/${p.id}" class="thumb" aria-label="${esc(p.name)}">${p.image}</a>
        <div class="card-body">
          <span class="cat">${esc(p.category)}</span>
          <h3><a href="#/product/${p.id}">${esc(p.name)}</a></h3>
          <div class="row">
            <span class="price">${money(p.price)}</span>
            <button class="btn" data-add="${p.id}" ${p.stock < 1 ? 'disabled' : ''}>${p.stock < 1 ? 'Sold out' : 'Add to cart'}</button>
          </div>
        </div>
      </article>`).join('');
    grid.querySelectorAll('[data-add]').forEach(b =>
      b.onclick = () => addToCart(products.find(p => p.id == b.dataset.add)));
  }

  document.getElementById('q').oninput = e => { q = e.target.value; load(); };
  document.querySelectorAll('.chip').forEach(chip => chip.onclick = () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    category = chip.dataset.cat;
    load();
  });
  load();
}

async function productPage(id) {
  let p;
  try { p = await api(`/api/products/${id}`); }
  catch { app.innerHTML = '<p class="empty">Product not found. <a href="#/">Back to shop</a></p>'; return; }

  let qty = 1;
  app.innerHTML = `
    <p><a href="#/">← All products</a></p>
    <div class="detail">
      <div class="thumb">${p.image}</div>
      <div class="info">
        <span class="cat">${esc(p.category)}</span>
        <h1>${esc(p.name)}</h1>
        <div class="price" style="font-size:1.6rem">${money(p.price)}</div>
        <p>${esc(p.description)}</p>
        <div class="stock ${p.stock < 10 ? 'low' : ''}">${p.stock < 1 ? 'Out of stock' : p.stock < 10 ? `Only ${p.stock} left` : 'In stock'}</div>
        <div class="row" style="justify-content:flex-start">
          <div class="qty">
            <button id="minus" aria-label="Decrease quantity">−</button>
            <span id="qty">1</span>
            <button id="plus" aria-label="Increase quantity">+</button>
          </div>
          <button class="btn" id="add" ${p.stock < 1 ? 'disabled' : ''}>Add to cart</button>
        </div>
      </div>
    </div>`;
  const show = () => document.getElementById('qty').textContent = qty;
  document.getElementById('minus').onclick = () => { qty = Math.max(1, qty - 1); show(); };
  document.getElementById('plus').onclick = () => { qty = Math.min(p.stock, qty + 1); show(); };
  document.getElementById('add').onclick = () => addToCart(p, qty);
}

function cartPage() {
  if (!cart.length) {
    app.innerHTML = '<div class="empty"><h2>Your cart is empty</h2><p>Add something you like.</p><a class="btn" href="#/">Browse products</a></div>';
    return;
  }
  app.innerHTML = `
    <h1>Your cart</h1>
    <div class="cart-layout">
      <div class="panel" id="items"></div>
      <div class="panel">
        <h2>Checkout</h2>
        <div class="total-row"><span>Total</span><span id="total"></span></div>
        <label for="address">Delivery address</label>
        <textarea id="address" rows="3" placeholder="House no, street, city, PIN code"></textarea>
        <p class="error" id="err"></p>
        <button class="btn dark full" id="order">${user ? 'Place order' : 'Log in to order'}</button>
      </div>
    </div>`;

  function drawItems() {
    if (!cart.length) return cartPage();
    document.getElementById('items').innerHTML = cart.map(i => `
      <div class="cart-item">
        <div class="mini">${i.image}</div>
        <div>
          <strong>${esc(i.name)}</strong><br />
          <span class="cat">${money(i.price)} each</span><br />
          <button class="link-btn" data-rm="${i.id}">Remove</button>
        </div>
        <div class="qty">
          <button data-dec="${i.id}" aria-label="Decrease">−</button>
          <span>${i.qty}</span>
          <button data-inc="${i.id}" aria-label="Increase">+</button>
        </div>
      </div>`).join('');
    document.getElementById('total').textContent = money(cartTotal());
    const find = id => cart.find(i => i.id == id);
    document.querySelectorAll('[data-inc]').forEach(b => b.onclick = () => { find(b.dataset.inc).qty++; saveCart(); drawItems(); });
    document.querySelectorAll('[data-dec]').forEach(b => b.onclick = () => {
      const it = find(b.dataset.dec);
      if (--it.qty < 1) cart = cart.filter(x => x !== it);
      saveCart(); drawItems();
    });
    document.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => {
      cart = cart.filter(x => x.id != b.dataset.rm); saveCart(); drawItems();
    });
  }
  drawItems();

  document.getElementById('order').onclick = async () => {
    const err = document.getElementById('err');
    err.textContent = '';
    if (!user) { nextRoute = '#/cart'; location.hash = '#/login'; return; }
    try {
      const order = await api('/api/orders', {
        method: 'POST',
        body: {
          items: cart.map(i => ({ id: i.id, quantity: i.qty })),
          address: document.getElementById('address').value,
        },
      });
      cart = []; saveCart();
      app.innerHTML = `<div class="empty"><h1>Order #${order.id} placed 🎉</h1>
        <p>Total paid on delivery: <strong>${money(order.total)}</strong></p>
        <a class="btn" href="#/orders">View my orders</a></div>`;
    } catch (e) { err.textContent = e.message; }
  };
}

function authPage(mode) {
  const isLogin = mode === 'login';
  app.innerHTML = `
    <div class="panel form">
      <h1>${isLogin ? 'Log in' : 'Create account'}</h1>
      ${isLogin ? '' : '<label for="name">Full name</label><input type="text" id="name" autocomplete="name" />'}
      <label for="email">Email</label><input type="email" id="email" autocomplete="email" />
      <label for="password">Password</label><input type="password" id="password" autocomplete="${isLogin ? 'current-password' : 'new-password'}" />
      <p class="error" id="err"></p>
      <button class="btn dark full" id="go">${isLogin ? 'Log in' : 'Sign up'}</button>
      <p class="sub" style="margin-top:14px">${isLogin
        ? 'New here? <a href="#/register"><u>Create an account</u></a>'
        : 'Already registered? <a href="#/login"><u>Log in</u></a>'}</p>
    </div>`;
  document.getElementById('go').onclick = async () => {
    try {
      const body = { email: document.getElementById('email').value, password: document.getElementById('password').value };
      if (!isLogin) body.name = document.getElementById('name').value;
      user = await api(isLogin ? '/api/login' : '/api/register', { method: 'POST', body });
      renderNav();
      toast(`Welcome, ${user.name.split(' ')[0]}!`);
      location.hash = nextRoute || '#/';
      nextRoute = null;
    } catch (e) { document.getElementById('err').textContent = e.message; }
  };
}

async function ordersPage() {
  if (!user) { nextRoute = '#/orders'; location.hash = '#/login'; return; }
  const orders = await api('/api/orders');
  app.innerHTML = `<h1>My orders</h1>` + (orders.length ? orders.map(o => `
    <div class="panel order">
      <div class="order-head">
        <strong>Order #${o.id}</strong>
        <span class="cat">${new Date(o.created_at + 'Z').toLocaleString()}</span>
        <span class="status">${esc(o.status)}</span>
      </div>
      ${o.items.map(i => `<div>${i.image} ${esc(i.name)} × ${i.quantity} — ${money(i.price * i.quantity)}</div>`).join('')}
      <div class="total-row"><span>Total</span><span>${money(o.total)}</span></div>
      <div class="cat">Deliver to: ${esc(o.address)}</div>
    </div>`).join('') : '<p class="empty">No orders yet. <a href="#/"><u>Start shopping</u></a></p>');
}

/* ---------- router ---------- */
function route() {
  const [, page, id] = location.hash.split('/');
  window.scrollTo(0, 0);
  if (!page) return shopPage();
  if (page === 'product') return productPage(id);
  if (page === 'cart') return cartPage();
  if (page === 'login') return authPage('login');
  if (page === 'register') return authPage('register');
  if (page === 'orders') return ordersPage();
  app.innerHTML = '<p class="empty">Page not found. <a href="#/">Go home</a></p>';
}

window.addEventListener('hashchange', route);
(async () => {
  try { user = await api('/api/me'); } catch { user = null; }
  renderNav();
  route();
})();