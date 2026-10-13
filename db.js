// Database setup: opens the SQLite file, creates the tables and seeds the products
// from public/data.js the first time the server runs.

const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DATA_DIR = path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'localface.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
    CREATE TABLE IF NOT EXISTS users (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        name          TEXT NOT NULL,
        email         TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        role          TEXT NOT NULL DEFAULT 'customer',
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS sessions (
        token_hash TEXT PRIMARY KEY,
        user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
        id            TEXT PRIMARY KEY,
        name          TEXT NOT NULL,
        price         REAL NOT NULL,
        rating        REAL NOT NULL DEFAULT 0,
        reviews_count INTEGER NOT NULL DEFAULT 0,
        image         TEXT NOT NULL,
        collection    TEXT NOT NULL DEFAULT '',
        family        TEXT NOT NULL DEFAULT '',
        gender        TEXT NOT NULL DEFAULT '',
        occasion      TEXT NOT NULL DEFAULT '',
        bestseller    INTEGER NOT NULL DEFAULT 0,
        position      INTEGER NOT NULL DEFAULT 0,
        active        INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS reviews (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id TEXT NOT NULL REFERENCES products(id) ON DELETE CASCADE,
        user_id    INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name       TEXT NOT NULL,
        rating     INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
        text       TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS reviews_product ON reviews(product_id);

    CREATE TABLE IF NOT EXISTS orders (
        id          INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id     INTEGER REFERENCES users(id) ON DELETE SET NULL,
        name        TEXT NOT NULL,
        email       TEXT NOT NULL,
        phone       TEXT NOT NULL,
        address     TEXT NOT NULL,
        city        TEXT NOT NULL,
        postal_code TEXT NOT NULL,
        total       REAL NOT NULL,
        status      TEXT NOT NULL DEFAULT 'pending',
        created_at  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_items (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        order_id   INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
        product_id TEXT NOT NULL,
        name       TEXT NOT NULL,
        size       INTEGER NOT NULL,
        qty        INTEGER NOT NULL,
        unit_price REAL NOT NULL
    );
    CREATE INDEX IF NOT EXISTS order_items_order ON order_items(order_id);

    CREATE TABLE IF NOT EXISTS subscribers (
        email      TEXT PRIMARY KEY,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        name       TEXT NOT NULL,
        email      TEXT NOT NULL,
        message    TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
`);

// public/data.js is a browser script, so it is evaluated in a sandbox to read its lists.
function loadSeed() {
    const code = fs.readFileSync(path.join(__dirname, 'public', 'data.js'), 'utf8');
    return vm.runInNewContext(code + '\n;({ PRODUCTS, REVIEWS })');
}

function seed() {
    if (db.prepare('SELECT COUNT(*) AS n FROM products').get().n > 0) return;

    const { PRODUCTS, REVIEWS } = loadSeed();
    const addProduct = db.prepare(`
        INSERT INTO products (id, name, price, rating, reviews_count, image, collection, family, gender, occasion, bestseller, position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
    const addReview = db.prepare(
        'INSERT INTO reviews (product_id, name, rating, text, created_at) VALUES (?, ?, 5, ?, ?)');

    db.exec('BEGIN');
    try {
        PRODUCTS.forEach((p, i) => {
            addProduct.run(p.id, p.name, p.price, p.rating, p.reviews, p.image, p.collection, p.family, p.gender, p.occasion, p.bestseller ? 1 : 0, i);
            for (const r of REVIEWS) {
                addReview.run(p.id, r.name, r.text, new Date(r.date + ' UTC').toISOString());
            }
        });
        db.exec('COMMIT');
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
    console.log(`Seeded ${PRODUCTS.length} products from public/data.js`);
}

seed();

// Runs fn inside a transaction and rolls back if it throws.
function transaction(fn) {
    db.exec('BEGIN');
    try {
        const result = fn();
        db.exec('COMMIT');
        return result;
    } catch (err) {
        db.exec('ROLLBACK');
        throw err;
    }
}

module.exports = { db, transaction };
