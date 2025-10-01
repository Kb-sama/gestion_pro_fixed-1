require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const path = require('path');
const db = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'change_this_secret';
const JWT_EXP = process.env.JWT_EXP || '12h';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS) || 12;

app.use(helmet());
app.use(express.json({ limit: '8mb' })); // allow base64 images if needed
app.use(express.urlencoded({ extended: true }));
app.use(cors({ origin: process.env.ALLOW_ORIGIN || '*' }));

// rate limiter (basic)
app.use(rateLimit({ windowMs: 15*60*1000, max: 300 }));

// Serve frontend static
app.use('/', express.static(path.join(__dirname, '..', 'public')));

// Initialize DB tables (simple)
db.serialize(() => {
  db.run(`PRAGMA foreign_keys = ON;`);
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE,
    password_hash TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT,
    category TEXT,
    color TEXT,
    price REAL DEFAULT 0,
    qty INTEGER DEFAULT 0,
    img TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS sales (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    product_id INTEGER,
    qty INTEGER,
    total REAL,
    date TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY(product_id) REFERENCES products(id) ON DELETE SET NULL
  );`);
  db.run(`CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    motif TEXT,
    amount REAL,
    due_date TEXT,
    is_paid INTEGER DEFAULT 0,
    img TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
  );`);
});

// ---------- helper ----------
function generateToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXP });
}
function authMiddleware(req, res, next) {
  const header = req.headers.authorization;
  if (!header) return res.status(401).json({ error: 'Token manquant' });
  const token = header.split(' ')[1];
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email }
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide' });
  }
}

// ---------- AUTH ----------
// register
app.post('/api/signup', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password || password.length < 6) return res.status(400).json({ error: 'Email + mot de passe (>=6)' });
  const hash = await bcrypt.hash(password, BCRYPT_ROUNDS);
  db.run('INSERT INTO users (email, password_hash) VALUES (?, ?)', [email, hash], function (err) {
    if (err) return res.status(400).json({ error: 'Email déjà utilisé' });
    const userId = this.lastID;
    const token = generateToken({ id: userId, email });
    return res.json({ message: 'Compte créé', token });
  });
});

// login
app.post('/api/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email + mot de passe requis' });
  db.get('SELECT id, email, password_hash FROM users WHERE email = ?', [email], async (err, row) => {
    if (err) return res.status(500).json({ error: 'Erreur serveur' });
    if (!row) return res.status(400).json({ error: 'Utilisateur non trouvé' });
    const ok = await bcrypt.compare(password, row.password_hash);
    if (!ok) return res.status(401).json({ error: 'Mot de passe incorrect' });
    const token = generateToken({ id: row.id, email: row.email });
    return res.json({ message: 'Connecté', token });
  });
});

// ---------- API endpoints (protected) ----------

// Products: list
app.get('/api/products', authMiddleware, (req, res) => {
  db.all('SELECT * FROM products WHERE user_id = ?', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur DB' });
    res.json(rows);
  });
});

// Products: create
// If you send image: send base64 string in 'img' field
app.post('/api/products', authMiddleware, (req, res) => {
  const { name, category, color, price, qty, img } = req.body;
  if (!name) return res.status(400).json({ error: 'Nom requis' });
  db.run(
    'INSERT INTO products (user_id,name,category,color,price,qty,img) VALUES (?,?,?,?,?,?,?)',
    [req.user.id, name, category || '', color || '', price || 0, qty || 0, img || ''],
    function (err) {
      if (err) return res.status(500).json({ error: 'Erreur DB' });
      db.get('SELECT * FROM products WHERE id = ?', [this.lastID], (e, row) => res.json(row));
    }
  );
});

// Products: sell (decrement qty + record sale)
app.post('/api/products/:id/sell', authMiddleware, (req, res) => {
  const pid = req.params.id;
  const qtySell = Number(req.body.qty) || 1;
  db.get('SELECT * FROM products WHERE id = ? AND user_id = ?', [pid, req.user.id], (err, prod) => {
    if (err || !prod) return res.status(404).json({ error: 'Produit introuvable' });
    if (prod.qty < qtySell) return res.status(400).json({ error: 'Stock insuffisant' });
    const newQty = prod.qty - qtySell;
    const total = (prod.price || 0) * qtySell;
    db.run('UPDATE products SET qty = ? WHERE id = ?', [newQty, pid], function (e) {
      if (e) return res.status(500).json({ error: 'Erreur DB' });
      db.run('INSERT INTO sales (user_id,product_id,qty,total,date) VALUES (?,?,?,?,datetime("now"))', [req.user.id, pid, qtySell, total], function (e2) {
        if (e2) return res.status(500).json({ error: 'Erreur DB' });
        return res.json({ ok: true, newQty, total });
      });
    });
  });
});

// Sales list
app.get('/api/sales', authMiddleware, (req, res) => {
  db.all('SELECT * FROM sales WHERE user_id = ?', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur DB' });
    res.json(rows);
  });
});

// Expenses: create
app.post('/api/expenses', authMiddleware, (req, res) => {
  const { motif, amount, due_date, is_paid, img } = req.body;
  db.run('INSERT INTO expenses (user_id,motif,amount,due_date,is_paid,img) VALUES (?,?,?,?,?,?)', [req.user.id, motif || '', amount || 0, due_date || '', is_paid ? 1 : 0, img || ''], function (err) {
    if (err) return res.status(500).json({ error: 'Erreur DB' });
    db.get('SELECT * FROM expenses WHERE id = ?', [this.lastID], (e, row) => res.json(row));
  });
});

// Expenses list
app.get('/api/expenses', authMiddleware, (req, res) => {
  db.all('SELECT * FROM expenses WHERE user_id = ?', [req.user.id], (err, rows) => {
    if (err) return res.status(500).json({ error: 'Erreur DB' });
    res.json(rows);
  });
});

// Mark expense paid
app.post('/api/expenses/:id/pay', authMiddleware, (req, res) => {
  const id = req.params.id;
  db.run('UPDATE expenses SET is_paid = 1 WHERE id = ? AND user_id = ?', [id, req.user.id], function (err) {
    if (err) return res.status(500).json({ error: 'Erreur DB' });
    res.json({ ok: true });
  });
});

// health
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// fallback to index (SPA)
app.get('*', (req, res) => res.sendFile(path.join(__dirname, '..', 'public', 'index.html')));

// start
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));