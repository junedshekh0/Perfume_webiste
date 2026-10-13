// Local Face backend: serves the site from /public and the JSON API under /api.
//
//   npm install
//   npm start            -> http://localhost:3000
//
// Settings (environment variables, all optional):
//   PORT            port to listen on (default 3000)
//   ADMIN_EMAIL     email for the first admin account (default admin@localface.local)
//   ADMIN_PASSWORD  password for the first admin account (default: generated and printed once)
//   NODE_ENV        set to "production" when running behind HTTPS (marks cookies Secure)

const express = require('express');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { promisify } = require('node:util');
const { db, transaction } = require('./db');

const scrypt = promisify(crypto.scrypt);

const PORT = Number(process.env.PORT) || 3000;
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'admin@localface.local').toLowerCase();
const PRODUCTION = process.env.NODE_ENV === 'production';
const PUBLIC_DIR = path.join(__dirname, 'public');
const UPLOAD_DIR = path.join(PUBLIC_DIR, 'images', 'uploads');

const SESSION_DAYS = 7;
const SIZES = [100, 150];
const LARGE_SIZE_FACTOR = 1.4;
const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];

/* ---------- Helpers ---------- */

class HttpError extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Lets async route handlers throw; errors go to the error handler at the bottom.
const wrap = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function text(value, label, { min = 1, max = 200 } = {}) {
    const clean = typeof value === 'string' ? value.trim() : '';
    if (clean.length < min) throw new HttpError(400, `${label} is required.`);
    if (clean.length > max) throw new HttpError(400, `${label} is too long.`);
    return clean;
}

function email(value) {
    const clean = text(value, 'Email', { max: 254 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new HttpError(400, 'Please enter a valid email address.');
    return clean;
}

// Used for values that are shown as HTML in the store (product names, filter labels).
function plainLabel(value, label, options) {
    const clean = text(value, label, options);
    if (/[<>"]/.test(clean)) throw new HttpError(400, `${label} contains characters that are not allowed.`);
    return clean;
}

function priceFor(product, size) {
    return size === 150 ? Math.round(product.price * LARGE_SIZE_FACTOR) : product.price;
}

function toProduct(row) {
    return {
        id: row.id,
        name: row.name,
        price: row.price,
        rating: Math.round(row.rating * 2) / 2,
        reviews: row.reviews_count,
        image: row.image,
        collection: row.collection,
        family: row.family,
        gender: row.gender,
        occasion: row.occasion,
        bestseller: Boolean(row.bestseller)
    };
}

function rateLimit(max, windowMs) {
    const hits = new Map();
    return (req, res, next) => {
        const now = Date.now();
        if (hits.size > 5000) {
            for (const [key, entry] of hits) if (now > entry.reset) hits.delete(key);
        }
        const entry = hits.get(req.ip);
        if (!entry || now > entry.reset) {
            hits.set(req.ip, { count: 1, reset: now + windowMs });
            return next();
        }
        if (++entry.count > max) {
            return res.status(429).json({ error: 'Too many attempts. Please try again in a few minutes.' });
        }
        next();
    };
}

/* ---------- Passwords and sessions ---------- */

async function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = await scrypt(password, salt, 64);
    return `${salt.toString('hex')}:${hash.toString('hex')}`;
}

async function verifyPassword(password, stored) {
    const [salt, hash] = stored.split(':');
    const expected = Buffer.from(hash, 'hex');
    const actual = await scrypt(password, Buffer.from(salt, 'hex'), expected.length);
    return crypto.timingSafeEqual(actual, expected);
}

// Only a hash of the session token is stored, so a leaked database cannot be used to log in.
const hashToken = token => crypto.createHash('sha256').update(token).digest('hex');

function sessionCookie(token, maxAgeSeconds) {
    return `sid=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${PRODUCTION ? '; Secure' : ''}`;
}

function startSession(res, userId) {
    const token = crypto.randomBytes(32).toString('hex');
    const maxAge = SESSION_DAYS * 24 * 60 * 60;
    db.prepare('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
        .run(hashToken(token), userId, Date.now() + maxAge * 1000);
    res.setHeader('Set-Cookie', sessionCookie(token, maxAge));
}

function readSessionToken(req) {
    const match = /(?:^|;\s*)sid=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie || '');
    return match ? match[1] : null;
}

const publicUser = user => ({ id: user.id, name: user.name, email: user.email, role: user.role });

function loadUser(req, res, next) {
    const token = readSessionToken(req);
    if (token) {
        const row = db.prepare(`
            SELECT users.id, users.name, users.email, users.role, sessions.expires_at
            FROM sessions JOIN users ON users.id = sessions.user_id
            WHERE sessions.token_hash = ?`).get(hashToken(token));
        if (row && row.expires_at > Date.now()) req.user = publicUser(row);
    }
    next();
}

function requireUser(req, res, next) {
    if (!req.user) return next(new HttpError(401, 'Please sign in first.'));
    next();
}

function requireAdmin(req, res, next) {
    if (!req.user) return next(new HttpError(401, 'Please sign in first.'));
    if (req.user.role !== 'admin') return next(new HttpError(403, 'Admin access only.'));
    next();
}

async function ensureAdmin(reset) {
    const existing = db.prepare("SELECT id, email FROM users WHERE role = 'admin' ORDER BY id LIMIT 1").get();
    if (existing && !reset) return;

    const generated = !process.env.ADMIN_PASSWORD || reset;
    const password = generated ? crypto.randomBytes(9).toString('base64url') : process.env.ADMIN_PASSWORD;
    const hash = await hashPassword(password);

    if (existing) {
        db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hash, existing.id);
        db.prepare('DELETE FROM sessions WHERE user_id = ?').run(existing.id);
    } else {
        db.prepare("INSERT INTO users (name, email, password_hash, role) VALUES ('Admin', ?, ?, 'admin')").run(ADMIN_EMAIL, hash);
    }

    console.log('\n  Admin account ' + (existing ? 'password reset' : 'created'));
    console.log('    Email:    ' + (existing ? existing.email : ADMIN_EMAIL));
    if (generated) console.log('    Password: ' + password + '   (shown only once - save it now)');
    console.log('    Sign in at /account.html, then open /admin.html\n');
}

/* ---------- App ---------- */

const app = express();
app.disable('x-powered-by');

app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

// CSRF protection for the API: changes must come from this site and use a content type
// that plain HTML forms on other sites cannot send.
app.use('/api', (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store');
    if (req.method === 'GET' || req.method === 'HEAD') return next();

    const origin = req.headers.origin;
    if (origin) {
        let host = '';
        try { host = new URL(origin).host; } catch (err) { /* malformed origin is rejected below */ }
        if (host !== req.headers.host) return next(new HttpError(403, 'Cross-site requests are not allowed.'));
    }
    const type = req.headers['content-type'] || '';
    if (!type.startsWith('application/json') && !type.startsWith('image/')) {
        return next(new HttpError(415, 'Requests must be sent as JSON.'));
    }
    next();
});

app.use('/api', express.json({ limit: '50kb' }));
app.use('/api', loadUser);

/* ---------- Products and reviews ---------- */

app.get('/api/products', (req, res) => {
    const rows = db.prepare('SELECT * FROM products WHERE active = 1 ORDER BY position, name').all();
    res.json(rows.map(toProduct));
});

function findActiveProduct(id) {
    const row = db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(String(id));
    if (!row) throw new HttpError(404, 'Product not found.');
    return row;
}

app.get('/api/products/:id/reviews', (req, res) => {
    const product = findActiveProduct(req.params.id);
    const reviews = db.prepare(
        'SELECT id, name, rating, text, created_at AS date FROM reviews WHERE product_id = ? ORDER BY created_at DESC, id DESC')
        .all(product.id);

    const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    for (const r of reviews) breakdown[r.rating]++;

    res.json({ reviews, breakdown, total: product.reviews_count, rating: Math.round(product.rating * 10) / 10 });
});

app.post('/api/products/:id/reviews', requireUser, rateLimit(10, 60 * 60 * 1000), (req, res) => {
    const product = findActiveProduct(req.params.id);
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new HttpError(400, 'Please choose a rating from 1 to 5.');
    const body = text(req.body.text, 'Review', { min: 10, max: 1500 });

    const already = db.prepare('SELECT 1 FROM reviews WHERE product_id = ? AND user_id = ?').get(product.id, req.user.id);
    if (already) throw new HttpError(409, 'You have already reviewed this perfume.');

    transaction(() => {
        db.prepare('INSERT INTO reviews (product_id, user_id, name, rating, text) VALUES (?, ?, ?, ?, ?)')
            .run(product.id, req.user.id, req.user.name, rating, body);
        // Fold the new rating into the product's running average.
        db.prepare(`
            UPDATE products
            SET rating = (rating * reviews_count + ?) / (reviews_count + 1), reviews_count = reviews_count + 1
            WHERE id = ?`).run(rating, product.id);
    });
    res.status(201).json({ ok: true });
});

/* ---------- Accounts ---------- */

const authLimit = rateLimit(20, 15 * 60 * 1000);

app.post('/api/auth/register', authLimit, wrap(async (req, res) => {
    const name = text(req.body.name, 'Name', { min: 2, max: 80 });
    const address = email(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (password.length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
    if (password.length > 200) throw new HttpError(400, 'Password is too long.');

    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(address)) {
        throw new HttpError(409, 'An account with this email already exists.');
    }
    const result = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)')
        .run(name, address, await hashPassword(password));

    const id = Number(result.lastInsertRowid);
    startSession(res, id);
    res.status(201).json({ user: { id, name, email: address, role: 'customer' } });
}));

app.post('/api/auth/login', authLimit, wrap(async (req, res) => {
    const address = email(req.body.email);
    const password = typeof req.body.password === 'string' ? req.body.password.slice(0, 200) : '';

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(address);
    // Hash even when the email is unknown so response time does not reveal which emails exist.
    const valid = user ? await verifyPassword(password, user.password_hash) : !(await hashPassword(password));
    if (!valid) throw new HttpError(401, 'Incorrect email or password.');

    startSession(res, user.id);
    res.json({ user: publicUser(user) });
}));

app.post('/api/auth/logout', (req, res) => {
    const token = readSessionToken(req);
    if (token) db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
    res.setHeader('Set-Cookie', sessionCookie('', 0));
    res.json({ ok: true });
});

app.get('/api/auth/me', (req, res) => {
    res.json({ user: req.user || null });
});

/* ---------- Orders ---------- */

function orderItems(orderId) {
    return db.prepare('SELECT product_id AS id, name, size, qty, unit_price AS price FROM order_items WHERE order_id = ?').all(orderId);
}

app.post('/api/orders', rateLimit(20, 60 * 60 * 1000), (req, res) => {
    const c = req.body.customer || {};
    const customer = {
        name: text(c.name, 'Name', { min: 2, max: 80 }),
        email: email(c.email),
        phone: text(c.phone, 'Phone', { min: 6, max: 30 }),
        address: text(c.address, 'Address', { min: 5, max: 300 }),
        city: text(c.city, 'City', { max: 80 }),
        postalCode: text(c.postalCode, 'Postal code', { max: 20 })
    };
    if (!/^[+\d][\d\s()-]+$/.test(customer.phone)) throw new HttpError(400, 'Please enter a valid phone number.');

    const requested = req.body.items;
    if (!Array.isArray(requested) || requested.length === 0) throw new HttpError(400, 'Your bag is empty.');
    if (requested.length > 50) throw new HttpError(400, 'Too many items in one order.');

    // Prices always come from the database, never from the browser.
    const items = requested.map(item => {
        const product = findActiveProduct(item && item.id);
        const size = Number(item.size);
        const qty = Number(item.qty);
        if (!SIZES.includes(size)) throw new HttpError(400, `Size is not available for ${product.name}.`);
        if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new HttpError(400, `Quantity for ${product.name} must be between 1 and 10.`);
        return { id: product.id, name: product.name, size, qty, price: priceFor(product, size) };
    });
    const total = items.reduce((sum, i) => sum + i.price * i.qty, 0);

    const orderId = transaction(() => {
        const result = db.prepare(`
            INSERT INTO orders (user_id, name, email, phone, address, city, postal_code, total)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(req.user ? req.user.id : null, customer.name, customer.email, customer.phone, customer.address, customer.city, customer.postalCode, total);
        const id = Number(result.lastInsertRowid);
        const addItem = db.prepare('INSERT INTO order_items (order_id, product_id, name, size, qty, unit_price) VALUES (?, ?, ?, ?, ?, ?)');
        for (const i of items) addItem.run(id, i.id, i.name, i.size, i.qty, i.price);
        return id;
    });

    res.status(201).json({ order: { id: orderId, total, status: 'pending', items } });
});

app.get('/api/orders/mine', requireUser, (req, res) => {
    const orders = db.prepare('SELECT id, total, status, created_at AS date FROM orders WHERE user_id = ? ORDER BY id DESC').all(req.user.id);
    res.json(orders.map(o => ({ ...o, items: orderItems(o.id) })));
});

/* ---------- Newsletter and contact ---------- */

const formLimit = rateLimit(10, 60 * 60 * 1000);

app.post('/api/newsletter', formLimit, (req, res) => {
    db.prepare('INSERT OR IGNORE INTO subscribers (email) VALUES (?)').run(email(req.body.email));
    res.status(201).json({ ok: true });
});

app.post('/api/contact', formLimit, (req, res) => {
    db.prepare('INSERT INTO messages (name, email, message) VALUES (?, ?, ?)').run(
        text(req.body.name, 'Name', { min: 2, max: 80 }),
        email(req.body.email),
        text(req.body.message, 'Message', { min: 5, max: 3000 }));
    res.status(201).json({ ok: true });
});

/* ---------- Admin ---------- */

app.use('/api/admin', requireAdmin);

app.get('/api/admin/summary', (req, res) => {
    const count = sql => db.prepare(sql).get().n;
    res.json({
        orders: count('SELECT COUNT(*) AS n FROM orders'),
        pending: count("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'"),
        revenue: count("SELECT COALESCE(SUM(total), 0) AS n FROM orders WHERE status != 'cancelled'"),
        products: count('SELECT COUNT(*) AS n FROM products WHERE active = 1'),
        customers: count("SELECT COUNT(*) AS n FROM users WHERE role = 'customer'"),
        subscribers: count('SELECT COUNT(*) AS n FROM subscribers'),
        messages: count('SELECT COUNT(*) AS n FROM messages')
    });
});

app.get('/api/admin/orders', (req, res) => {
    const orders = db.prepare('SELECT *, created_at AS date FROM orders ORDER BY id DESC LIMIT 500').all();
    res.json(orders.map(o => ({ ...o, items: orderItems(o.id) })));
});

app.patch('/api/admin/orders/:id', (req, res) => {
    if (!ORDER_STATUSES.includes(req.body.status)) throw new HttpError(400, 'Unknown order status.');
    const result = db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(req.body.status, Number(req.params.id));
    if (!result.changes) throw new HttpError(404, 'Order not found.');
    res.json({ ok: true });
});

app.get('/api/admin/messages', (req, res) => {
    res.json(db.prepare('SELECT id, name, email, message, created_at AS date FROM messages ORDER BY id DESC LIMIT 500').all());
});

app.get('/api/admin/subscribers', (req, res) => {
    res.json(db.prepare('SELECT email, created_at AS date FROM subscribers ORDER BY created_at DESC LIMIT 2000').all());
});

function productInput(body) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000) throw new HttpError(400, 'Please enter a valid price.');

    const image = text(body.image, 'Image', { max: 120 });
    if (!/^[\w-]+(\/[\w-]+)*\.(jpe?g|png|webp)$/i.test(image)) throw new HttpError(400, 'Image must be a file name inside public/images.');

    const optional = (value, label) => (value ? plainLabel(value, label, { max: 60 }) : '');
    return {
        name: plainLabel(body.name, 'Name', { min: 2, max: 80 }),
        price: Math.round(price * 100) / 100,
        image,
        collection: optional(body.collection, 'Collection'),
        family: optional(body.family, 'Fragrance family'),
        gender: optional(body.gender, 'Gender'),
        occasion: optional(body.occasion, 'Occasion'),
        bestseller: body.bestseller ? 1 : 0
    };
}

app.post('/api/admin/products', (req, res) => {
    const p = productInput(req.body);

    const base = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'perfume';
    let id = base;
    for (let n = 2; db.prepare('SELECT 1 FROM products WHERE id = ?').get(id); n++) id = `${base}-${n}`;

    const position = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS n FROM products').get().n;
    db.prepare(`
        INSERT INTO products (id, name, price, image, collection, family, gender, occasion, bestseller, position)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .run(id, p.name, p.price, p.image, p.collection, p.family, p.gender, p.occasion, p.bestseller, position);
    res.status(201).json({ id });
});

app.put('/api/admin/products/:id', (req, res) => {
    const p = productInput(req.body);
    const result = db.prepare(`
        UPDATE products SET name = ?, price = ?, image = ?, collection = ?, family = ?, gender = ?, occasion = ?, bestseller = ?
        WHERE id = ? AND active = 1`)
        .run(p.name, p.price, p.image, p.collection, p.family, p.gender, p.occasion, p.bestseller, req.params.id);
    if (!result.changes) throw new HttpError(404, 'Product not found.');
    res.json({ ok: true });
});

// Products are hidden rather than deleted so past orders and reviews keep working.
app.delete('/api/admin/products/:id', (req, res) => {
    const result = db.prepare('UPDATE products SET active = 0 WHERE id = ? AND active = 1').run(req.params.id);
    if (!result.changes) throw new HttpError(404, 'Product not found.');
    res.json({ ok: true });
});

const IMAGE_TYPES = {
    'image/jpeg': { ext: 'jpg', matches: b => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff },
    'image/png': { ext: 'png', matches: b => b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) },
    'image/webp': { ext: 'webp', matches: b => b.toString('latin1', 0, 4) === 'RIFF' && b.toString('latin1', 8, 12) === 'WEBP' }
};

app.post('/api/admin/upload', express.raw({ type: Object.keys(IMAGE_TYPES), limit: '5mb' }), (req, res) => {
    const kind = IMAGE_TYPES[(req.headers['content-type'] || '').split(';')[0]];
    if (!kind || !Buffer.isBuffer(req.body) || req.body.length < 12) throw new HttpError(400, 'Please upload a JPG, PNG or WebP image.');
    // The file's own signature must match, whatever the browser claims it is.
    if (!kind.matches(req.body)) throw new HttpError(400, 'That file is not a valid image.');

    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const name = `${crypto.randomBytes(8).toString('hex')}.${kind.ext}`;
    fs.writeFileSync(path.join(UPLOAD_DIR, name), req.body);
    res.status(201).json({ image: `uploads/${name}` });
});

/* ---------- Static site and errors ---------- */

app.use('/api', (req, res, next) => next(new HttpError(404, 'Not found.')));

// The site has no favicon file; answer quietly instead of logging a 404 on every page.
app.get('/favicon.ico', (req, res) => res.status(204).end());

app.use(express.static(PUBLIC_DIR, { extensions: ['html'] }));

app.use((req, res) => {
    res.status(404).sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

app.use((err, req, res, next) => {
    let status = err.status || err.statusCode || 500;
    let message = err.message;
    if (err.type === 'entity.too.large') message = 'That is too large to upload.';
    else if (err.type === 'entity.parse.failed') message = 'Invalid request.';
    else if (status >= 500) {
        console.error(err);
        status = 500;
        message = 'Something went wrong on the server.';
    }
    res.status(status).json({ error: message });
});

/* ---------- Start ---------- */

async function main() {
    const reset = process.argv.includes('--reset-admin');
    await ensureAdmin(reset);
    if (reset) return;

    db.prepare('DELETE FROM sessions WHERE expires_at < ?').run(Date.now());
    app.listen(PORT, () => console.log(`Local Face is running at http://localhost:${PORT}`));
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
