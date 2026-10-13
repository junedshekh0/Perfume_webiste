const CART_KEY = 'localface_cart';
const WISH_KEY = 'localface_wishlist';
const SIZES = [100, 150];
const PER_PAGE = 12;
const HOME_POSTS = ['lavender-perfumes', 'luxury-perfume-collection', 'rose-perfumes'];

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const params = new URLSearchParams(location.search);

/* ---------- Helpers ---------- */

function formatPrice(n) {
    return '$ ' + n.toFixed(2);
}

function priceFor(p, size) {
    return size === 150 ? Math.round(p.price * 1.4) : p.price;
}

function findProduct(id) {
    return PRODUCTS.find(p => p.id === id);
}

function escapeHTML(text) {
    return text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function stars(rating) {
    let html = '';
    for (let i = 1; i <= 5; i++) {
        html += `<i class="star ${rating >= i ? 'full' : rating >= i - 0.5 ? 'half' : 'empty'}"></i>`;
    }
    return `<span class="stars" role="img" aria-label="${rating} out of 5 stars">${html}</span>`;
}

function productCard(p, showRating) {
    return `
        <a class="product-card" href="product.html?id=${p.id}">
            <span class="product-img"><img src="images/${p.image}" alt="${p.name}" loading="lazy"></span>
            <span class="product-name">${p.name}</span>
            ${showRating ? `<span class="product-rating">${stars(p.rating)}<small>(${p.reviews})</small></span>` : ''}
            <span class="product-price"><b>${formatPrice(p.price)}</b> 100ml</span>
        </a>`;
}

function postCard(post) {
    return `
        <article class="post-card">
            <a href="article.html?id=${post.id}" class="post-img"><img src="images/${post.image}" alt="" loading="lazy"></a>
            <h3><a href="article.html?id=${post.id}">${post.title}</a></h3>
            <p>${post.excerpt}</p>
            <a href="article.html?id=${post.id}" class="btn btn-outline btn-small">Read More</a>
        </article>`;
}

function showToast(message) {
    let toast = $('#toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        toast.setAttribute('role', 'status');
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add('show');
    clearTimeout(showToast.timer);
    showToast.timer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function formatDate(value) {
    return new Date(value).toLocaleDateString('en-US', { month: 'long', day: '2-digit', year: 'numeric', timeZone: 'UTC' });
}

/* ---------- Local data store ---------- */

// The site has no server. Accounts, orders, reviews, messages and admin changes are kept in
// this browser's localStorage, so they are only visible in the browser they were made in.
// Anyone can read this file, so the admin sign-in below is a convenience, not real security.

const DB_KEY = 'localface_db';
const SESSION_KEY = 'localface_session';
const ORDER_STATUSES = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
const DEFAULT_ADMIN = { name: 'Admin', email: 'admin@localface.local', password: 'admin12345' };

const hex = bytes => Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');

async function hashPassword(password, salt) {
    return hex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(salt + password))));
}

async function newUser(db, name, email, password, role) {
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const user = { id: db.users.length + 1, name, email, salt, hash: await hashPassword(password, salt), role };
    db.users.push(user);
    return user;
}

function saveDb(db) {
    try {
        localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
        throw new Error('Could not save. Browser storage is full or blocked.');
    }
}

// Opens the store, creating it from the starter lists in data.js on the first visit.
async function loadDb() {
    try {
        const saved = JSON.parse(localStorage.getItem(DB_KEY));
        if (saved && Array.isArray(saved.products)) return saved;
    } catch (e) {
        // Unreadable storage is rebuilt below.
    }

    const db = {
        users: [],
        products: PRODUCTS.map(p => ({ ...p, bestseller: Boolean(p.bestseller), active: true })),
        reviews: [],
        orders: [],
        messages: [],
        subscribers: []
    };
    await newUser(db, DEFAULT_ADMIN.name, DEFAULT_ADMIN.email, DEFAULT_ADMIN.password, 'admin');
    for (const p of db.products) {
        for (const r of REVIEWS) {
            db.reviews.push({ productId: p.id, userId: null, name: r.name, rating: 5, text: r.text, date: new Date(r.date + ' UTC').toISOString() });
        }
    }
    try {
        saveDb(db);
    } catch (e) {
        // Storage can be blocked (private mode); the starter data still works for this visit.
    }
    return db;
}

function cleanText(value, label, { min = 1, max = 200 } = {}) {
    const clean = typeof value === 'string' ? value.trim() : '';
    if (clean.length < min) throw new Error(`${label} is required.`);
    if (clean.length > max) throw new Error(`${label} is too long.`);
    return clean;
}

function cleanEmail(value) {
    const clean = cleanText(value, 'Email', { max: 254 }).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) throw new Error('Please enter a valid email address.');
    return clean;
}

// Used for values that are shown as HTML in the store (product names, filter labels).
function cleanLabel(value, label, options) {
    const clean = cleanText(value, label, options);
    if (/[<>"]/.test(clean)) throw new Error(`${label} contains characters that are not allowed.`);
    return clean;
}

function productInput(body) {
    const price = Number(body.price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000) throw new Error('Please enter a valid price.');

    const image = cleanText(body.image, 'Image', { max: 120 });
    if (!/^[\w-]+(\/[\w-]+)*\.(jpe?g|png|webp)$/i.test(image)) throw new Error('Image must be a file name inside the images folder.');

    const optional = (value, label) => (value ? cleanLabel(value, label, { max: 60 }) : '');
    return {
        name: cleanLabel(body.name, 'Name', { min: 2, max: 80 }),
        price: Math.round(price * 100) / 100,
        image,
        collection: optional(body.collection, 'Collection'),
        family: optional(body.family, 'Fragrance family'),
        gender: optional(body.gender, 'Gender'),
        occasion: optional(body.occasion, 'Occasion'),
        bestseller: Boolean(body.bestseller)
    };
}

const publicUser = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
const publicProduct = ({ active, ...p }) => ({ ...p, rating: Math.round(p.rating * 2) / 2 });

function activeProduct(db, id) {
    const product = db.products.find(p => p.id === id && p.active);
    if (!product) throw new Error('Product not found.');
    return product;
}

function signedIn(user) {
    if (!user) throw new Error('Please sign in first.');
    return user;
}

// Each route is [method, path pattern, handler]. Handlers get { db, user, body } followed by
// the values captured from the path, and may throw an Error to show to the visitor.
const ROUTES = [
    ['GET', /^\/api\/products$/, ({ db }) => db.products.filter(p => p.active).map(publicProduct)],

    ['GET', /^\/api\/products\/([^/]+)\/reviews$/, ({ db }, id) => {
        const product = activeProduct(db, id);
        const reviews = db.reviews.filter(r => r.productId === id).sort((a, b) => b.date.localeCompare(a.date));
        const breakdown = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
        for (const r of reviews) breakdown[r.rating]++;
        return { reviews, breakdown, total: product.reviews, rating: Math.round(product.rating * 10) / 10 };
    }],

    ['POST', /^\/api\/products\/([^/]+)\/reviews$/, ({ db, user, body }, id) => {
        signedIn(user);
        const product = activeProduct(db, id);
        const rating = Number(body.rating);
        if (!Number.isInteger(rating) || rating < 1 || rating > 5) throw new Error('Please choose a rating from 1 to 5.');
        const text = cleanText(body.text, 'Review', { min: 10, max: 1500 });
        if (db.reviews.some(r => r.productId === id && r.userId === user.id)) throw new Error('You have already reviewed this perfume.');

        db.reviews.push({ productId: id, userId: user.id, name: user.name, rating, text, date: new Date().toISOString() });
        // Fold the new rating into the product's running average.
        product.rating = (product.rating * product.reviews + rating) / (product.reviews + 1);
        product.reviews++;
    }],

    ['POST', /^\/api\/auth\/register$/, async ({ db, body }) => {
        const name = cleanText(body.name, 'Name', { min: 2, max: 80 });
        const email = cleanEmail(body.email);
        const password = typeof body.password === 'string' ? body.password : '';
        if (password.length < 8) throw new Error('Password must be at least 8 characters.');
        if (password.length > 200) throw new Error('Password is too long.');
        if (db.users.some(u => u.email === email)) throw new Error('An account with this email already exists.');

        const user = await newUser(db, name, email, password, 'customer');
        localStorage.setItem(SESSION_KEY, user.id);
        return { user: publicUser(user) };
    }],

    ['POST', /^\/api\/auth\/login$/, async ({ db, body }) => {
        const email = cleanEmail(body.email);
        const user = db.users.find(u => u.email === email);
        if (!user || user.hash !== await hashPassword(String(body.password), user.salt)) throw new Error('Incorrect email or password.');
        localStorage.setItem(SESSION_KEY, user.id);
        return { user: publicUser(user) };
    }],

    ['POST', /^\/api\/auth\/logout$/, () => localStorage.removeItem(SESSION_KEY)],

    ['GET', /^\/api\/auth\/me$/, ({ user }) => ({ user: user ? publicUser(user) : null })],

    ['POST', /^\/api\/orders$/, ({ db, user, body }) => {
        const c = body.customer || {};
        const customer = {
            name: cleanText(c.name, 'Name', { min: 2, max: 80 }),
            email: cleanEmail(c.email),
            phone: cleanText(c.phone, 'Phone', { min: 6, max: 30 }),
            address: cleanText(c.address, 'Address', { min: 5, max: 300 }),
            city: cleanText(c.city, 'City', { max: 80 }),
            postal_code: cleanText(c.postalCode, 'Postal code', { max: 20 })
        };
        if (!/^[+\d][\d\s()-]+$/.test(customer.phone)) throw new Error('Please enter a valid phone number.');
        if (!Array.isArray(body.items) || body.items.length === 0) throw new Error('Your bag is empty.');

        // Prices always come from the product list, never from the saved bag.
        const items = body.items.map(item => {
            const product = activeProduct(db, item.id);
            const size = Number(item.size);
            const qty = Number(item.qty);
            if (!SIZES.includes(size)) throw new Error(`Size is not available for ${product.name}.`);
            if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new Error(`Quantity for ${product.name} must be between 1 and 10.`);
            return { id: product.id, name: product.name, size, qty, price: priceFor(product, size) };
        });
        const order = {
            id: db.orders.length + 1,
            userId: user ? user.id : null,
            ...customer,
            total: items.reduce((sum, i) => sum + i.price * i.qty, 0),
            status: 'pending',
            date: new Date().toISOString(),
            items
        };
        db.orders.push(order);
        return { order };
    }],

    ['GET', /^\/api\/orders\/mine$/, ({ db, user }) => {
        signedIn(user);
        return db.orders.filter(o => o.userId === user.id).reverse();
    }],

    ['POST', /^\/api\/newsletter$/, ({ db, body }) => {
        const email = cleanEmail(body.email);
        if (!db.subscribers.some(s => s.email === email)) db.subscribers.push({ email, date: new Date().toISOString() });
    }],

    ['POST', /^\/api\/contact$/, ({ db, body }) => {
        db.messages.push({
            name: cleanText(body.name, 'Name', { min: 2, max: 80 }),
            email: cleanEmail(body.email),
            message: cleanText(body.message, 'Message', { min: 5, max: 3000 }),
            date: new Date().toISOString()
        });
    }],

    ['GET', /^\/api\/admin\/summary$/, ({ db }) => ({
        orders: db.orders.length,
        pending: db.orders.filter(o => o.status === 'pending').length,
        revenue: db.orders.filter(o => o.status !== 'cancelled').reduce((sum, o) => sum + o.total, 0),
        products: db.products.filter(p => p.active).length,
        customers: db.users.filter(u => u.role === 'customer').length,
        subscribers: db.subscribers.length,
        messages: db.messages.length
    })],

    ['GET', /^\/api\/admin\/orders$/, ({ db }) => [...db.orders].reverse()],

    ['PATCH', /^\/api\/admin\/orders\/(\d+)$/, ({ db, body }, id) => {
        if (!ORDER_STATUSES.includes(body.status)) throw new Error('Unknown order status.');
        const order = db.orders.find(o => o.id === Number(id));
        if (!order) throw new Error('Order not found.');
        order.status = body.status;
    }],

    ['GET', /^\/api\/admin\/messages$/, ({ db }) => [...db.messages].reverse()],

    ['GET', /^\/api\/admin\/subscribers$/, ({ db }) => [...db.subscribers].reverse()],

    ['POST', /^\/api\/admin\/products$/, ({ db, body }) => {
        const p = productInput(body);
        const base = p.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'perfume';
        let id = base;
        for (let n = 2; db.products.some(x => x.id === id); n++) id = `${base}-${n}`;
        db.products.push({ id, ...p, rating: 0, reviews: 0, active: true });
        return { id };
    }],

    ['PUT', /^\/api\/admin\/products\/([^/]+)$/, ({ db, body }, id) => {
        Object.assign(activeProduct(db, id), productInput(body));
    }],

    // Products are hidden rather than deleted so past orders and reviews keep working.
    ['DELETE', /^\/api\/admin\/products\/([^/]+)$/, ({ db }, id) => {
        activeProduct(db, id).active = false;
    }]
];

// Runs a request against the local store. Throws an Error whose message is safe to show to the visitor.
async function api(path, { method = 'GET', body = {} } = {}) {
    const db = await loadDb();
    const user = db.users.find(u => String(u.id) === localStorage.getItem(SESSION_KEY)) || null;

    if (path.startsWith('/api/admin/')) {
        if (signedIn(user).role !== 'admin') throw new Error('Admin access only.');
    }
    for (const [routeMethod, pattern, handler] of ROUTES) {
        const match = method === routeMethod && pattern.exec(path);
        if (!match) continue;
        const result = await handler({ db, user, body }, ...match.slice(1).map(decodeURIComponent));
        if (method !== 'GET') saveDb(db);
        return result === undefined ? { ok: true } : result;
    }
    throw new Error('Not found.');
}

// The signed-in user (or null), loaded once when the page starts.
let currentUser = null;

// Only same-site page names are accepted, so ?next= can never send someone to another site.
function safeNext(value) {
    return /^[\w-]+\.html(\?[\w=&%.-]*)?$/.test(value || '') ? value : null;
}

function readStore(key) {
    try {
        const saved = JSON.parse(localStorage.getItem(key));
        return Array.isArray(saved) ? saved : [];
    } catch (e) {
        return [];
    }
}

function writeStore(key, value) {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // Storage can be blocked (private mode); the page still works for this visit.
    }
}

/* ---------- Header and footer (shared by every page) ---------- */

const ICONS = {
    search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4.5"/><path d="M4 21c1.2-4 4.3-6 8-6s6.800 2 8 6"/></svg>',
    heart: '<svg viewBox="0 0 24 24"><path d="M12 20.500S3.500 15.300 3.500 9.200A4.700 4.700 0 0 1 12 6.500a4.700 4.700 0 0 1 8.500 2.700c0 6.100-8.500 11.300-8.500 11.300z"/></svg>',
    bag: '<svg viewBox="0 0 24 24"><path d="M4 8h16l-1.200 12H5.200L4 8z"/><path d="M8.500 11V6.500a3.500 3.500 0 0 1 7 0V11"/></svg>',
    chevronLeft: '<svg viewBox="0 0 24 24"><path d="M15 5l-7 7 7 7"/></svg>',
    chevronRight: '<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>'
};

const SOCIAL = {
    twitter: { color: '#1da1f2', icon: '<path fill="#fff" d="M19.600 8.300v.5c0 5-3.800 10.700-10.700 10.700-2.100 0-4.100-.6-5.800-1.700.3 0 .6.100.9.100 1.800 0 3.400-.6 4.700-1.600-1.600 0-3-1.100-3.500-2.600.2 0 .5.100.7.100.3 0 .7 0 1-.1-1.700-.4-3-1.900-3-3.700.5.300 1.100.5 1.700.5-1-.7-1.700-1.800-1.700-3.100 0-.7.2-1.300.5-1.900 1.900 2.300 4.600 3.800 7.800 3.900-.1-.3-.1-.6-.1-.9 0-2.100 1.700-3.800 3.800-3.800 1.100 0 2.100.5 2.700 1.200.9-.2 1.700-.5 2.400-.9-.3.900-.9 1.600-1.700 2.100.8-.1 1.500-.3 2.200-.6-.5.800-1.200 1.400-1.900 1.900z"/>' },
    facebook: { color: '#3b5998', icon: '<path fill="#fff" d="M13.500 21v-7h2.300l.4-3h-2.700V9.200c0-.9.300-1.400 1.500-1.400h1.300V5.100c-.3 0-1.100-.1-2-.1-2.100 0-3.400 1.200-3.400 3.600V11H8.500v3h2.400v7h2.600z"/>' },
    linkedin: { color: '#0a78b5', icon: '<path fill="#fff" d="M6.500 9.500h2.600V18H6.500V9.500zm1.300-4.100a1.500 1.500 0 1 1 0 3 1.500 1.500 0 0 1 0-3zm3 4.100h2.500v1.200c.4-.7 1.300-1.400 2.600-1.400 2.700 0 3.200 1.700 3.200 4V18h-2.600v-4.100c0-1 0-2.200-1.400-2.200s-1.600 1-1.600 2.100V18h-2.700V9.500z"/>' },
    instagram: { color: '#d6249f', icon: '<rect x="5" y="5" width="14" height="14" rx="4" fill="none" stroke="#fff" stroke-width="1.800"/><circle cx="12" cy="12" r="3.200" fill="none" stroke="#fff" stroke-width="1.800"/><circle cx="16.200" cy="7.800" r="1" fill="#fff"/>' }
};

function socialIcon(name, href = '#') {
    const s = SOCIAL[name];
    return `<a href="${href}" class="social" style="background:${s.color}" aria-label="${name}"${href === '#' ? '' : ' target="_blank" rel="noopener"'}><svg viewBox="-4 -4 32 32">${s.icon}</svg></a>`;
}

function buildLayout() {
    const page = document.body.dataset.page;
    const link = (href, label, key) => `<a href="${href}"${page === key ? ' class="active"' : ''}>${label}</a>`;

    document.body.insertAdjacentHTML('afterbegin', `
        <header class="header" id="header">
            <div class="container nav">
                <a href="index.html" class="logo">Local Face</a>
                <nav class="nav-links" id="navLinks">
                    ${link('index.html', 'Home', 'home')}
                    ${link('shop.html', 'Shop', 'shop')}
                    ${link('about.html', 'About us', 'about')}
                    ${link('services.html', 'Services', 'services')}
                    ${link('blog.html', 'Blog', 'blog')}
                </nav>
                <div class="nav-icons">
                    <button id="searchToggle" aria-label="Search" aria-expanded="false">${ICONS.search}</button>
                    <a href="account.html" aria-label="Account">${ICONS.user}</a>
                    <a href="shop.html?wishlist=1" aria-label="Wish list">${ICONS.heart}</a>
                    <button id="cartBtn" class="cart-btn" aria-label="Open bag">${ICONS.bag}<span class="cart-count" hidden>0</span></button>
                    <button class="menu-toggle" id="menuToggle" aria-label="Toggle menu" aria-expanded="false"><span></span><span></span><span></span></button>
                </div>
            </div>
            <form class="search-bar" id="searchBar" action="shop.html" hidden>
                <div class="container">
                    <input type="search" name="q" placeholder="Search perfumes..." aria-label="Search perfumes" required>
                    <button type="submit" class="btn btn-small">Search</button>
                </div>
            </form>
        </header>`);

    document.body.insertAdjacentHTML('beforeend', `
        <footer class="footer">
            <div class="container">
                <a href="index.html" class="logo">Local Face</a>
                <div class="footer-grid">
                    <div class="footer-news">
                        <h3>Subscribe to Our Newsletter:</h3>
                        <p>Receive Updates on New Arrivals and Special Promotions!</p>
                        <form class="newsletter-form" id="newsletterForm">
                            <input type="email" placeholder="Your email here" aria-label="Email address" required>
                            <button type="submit">Submit</button>
                        </form>
                        <div class="socials">
                            ${socialIcon('twitter')}${socialIcon('facebook')}${socialIcon('linkedin')}${socialIcon('instagram')}
                        </div>
                    </div>
                    <div>
                        <h4>Categories</h4>
                        <ul><li><a href="#">Fashion</a></li><li><a href="#">Jewelry</a></li><li><a href="#">Sports</a></li><li><a href="#">Electronics</a></li><li><a href="#">Indoor</a></li></ul>
                    </div>
                    <div>
                        <h4>Shopping</h4>
                        <ul><li><a href="#">Payments</a></li><li><a href="#">Delivery options</a></li><li><a href="#">Buyer protection</a></li></ul>
                    </div>
                    <div>
                        <h4>Customer care</h4>
                        <ul><li><a href="#">Help center</a></li><li><a href="#">Terms &amp; Conditions</a></li><li><a href="#">Privacy policy</a></li><li><a href="#">Returns &amp; refund</a></li><li><a href="#">Survey &amp; feedback</a></li></ul>
                    </div>
                    <div>
                        <h4>Pages</h4>
                        <ul><li><a href="about.html">About Us</a></li><li><a href="shop.html">Shop</a></li><li><a href="contact.html">Contact Us</a></li><li><a href="services.html">Services</a></li><li><a href="blog.html">Blog</a></li></ul>
                    </div>
                </div>
                <p class="footer-bottom">&copy; 2023 Local Face Inc. All rights reserved</p>
            </div>
        </footer>

        <div class="cart-overlay" id="cartOverlay"></div>
        <aside class="cart-drawer" id="cartDrawer" aria-label="Shopping bag" aria-hidden="true">
            <div class="cart-head">
                <h3>Your Bag</h3>
                <button class="cart-close" id="cartClose" aria-label="Close bag">&times;</button>
            </div>
            <div class="cart-items" id="cartItems"></div>
            <div class="cart-foot">
                <div class="cart-total"><span>Subtotal</span><strong id="cartTotal"></strong></div>
                <button class="btn btn-block" id="checkoutBtn">Checkout</button>
            </div>
        </aside>`);

    const navLinks = $('#navLinks');
    const toggle = $('#menuToggle');
    toggle.addEventListener('click', () => {
        const open = navLinks.classList.toggle('open');
        toggle.classList.toggle('open', open);
        toggle.setAttribute('aria-expanded', open);
    });

    const searchBar = $('#searchBar');
    $('#searchToggle').addEventListener('click', e => {
        searchBar.hidden = !searchBar.hidden;
        e.currentTarget.setAttribute('aria-expanded', !searchBar.hidden);
        if (!searchBar.hidden) $('input', searchBar).focus();
    });

    $('#newsletterForm').addEventListener('submit', async e => {
        e.preventDefault();
        const form = e.target;
        try {
            await api('/api/newsletter', { method: 'POST', body: { email: $('input', form).value } });
            form.reset();
            showToast('Thank you for subscribing!');
        } catch (err) {
            showToast(err.message);
        }
    });

    $('#cartBtn').addEventListener('click', openCart);
    $('#cartOverlay').addEventListener('click', closeCart);
    $('#cartClose').addEventListener('click', closeCart);
    $('#checkoutBtn').addEventListener('click', () => {
        if (cart.length) location.href = 'checkout.html';
        else showToast('Your bag is empty.');
    });
    $('#cartItems').addEventListener('click', e => {
        const btn = e.target.closest('[data-qty]');
        if (btn) changeQty(btn.dataset.id, Number(btn.dataset.size), Number(btn.dataset.qty));
    });
    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeCart();
    });
}

/* ---------- Cart ---------- */

// Filled in loadCart() once the product list has arrived.
let cart = [];

function loadCart() {
    cart = readStore(CART_KEY).filter(i => findProduct(i.id) && SIZES.includes(i.size) && i.qty > 0);
}

function addToCart(id, size, qty) {
    const item = cart.find(i => i.id === id && i.size === size);
    if (item) item.qty += qty;
    else cart.push({ id, size, qty });
    writeStore(CART_KEY, cart);
    renderCart();
    openCart();
}

function changeQty(id, size, delta) {
    const item = cart.find(i => i.id === id && i.size === size);
    if (!item) return;
    item.qty += delta;
    if (item.qty <= 0) cart = cart.filter(i => i !== item);
    writeStore(CART_KEY, cart);
    renderCart();
}

function renderCart() {
    const count = cart.reduce((sum, i) => sum + i.qty, 0);
    const total = cart.reduce((sum, i) => sum + priceFor(findProduct(i.id), i.size) * i.qty, 0);

    const badge = $('.cart-count');
    badge.textContent = count;
    badge.hidden = count === 0;
    $('#cartTotal').textContent = formatPrice(total);

    $('#cartItems').innerHTML = cart.length ? cart.map(i => {
        const p = findProduct(i.id);
        return `
            <div class="cart-item">
                <img src="images/${p.image}" alt="">
                <div class="cart-item-info">
                    <h4>${p.name}</h4>
                    <p>${i.size} ml &middot; ${formatPrice(priceFor(p, i.size))}</p>
                    <div class="qty qty-small">
                        <button data-qty="-1" data-id="${i.id}" data-size="${i.size}" aria-label="Decrease quantity">&minus;</button>
                        <span>${i.qty}</span>
                        <button data-qty="1" data-id="${i.id}" data-size="${i.size}" aria-label="Increase quantity">+</button>
                    </div>
                </div>
                <strong>${formatPrice(priceFor(p, i.size) * i.qty)}</strong>
            </div>`;
    }).join('') : '<p class="cart-empty">Your bag is empty.<br><a href="shop.html">Browse the collection</a></p>';
}

function openCart() {
    $('#cartDrawer').classList.add('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'false');
    $('#cartOverlay').classList.add('open');
}

function closeCart() {
    $('#cartDrawer').classList.remove('open');
    $('#cartDrawer').setAttribute('aria-hidden', 'true');
    $('#cartOverlay').classList.remove('open');
}

/* ---------- Carousels ---------- */

function carousel(id, cardsHTML) {
    const wrap = $(id);
    if (!wrap) return;
    wrap.innerHTML = `
        <button class="carousel-arrow" data-dir="-1" aria-label="Previous">${ICONS.chevronLeft}</button>
        <div class="carousel-track">${cardsHTML}</div>
        <button class="carousel-arrow" data-dir="1" aria-label="Next">${ICONS.chevronRight}</button>`;

    const track = $('.carousel-track', wrap);
    wrap.addEventListener('click', e => {
        const arrow = e.target.closest('.carousel-arrow');
        if (!arrow) return;
        const card = track.firstElementChild;
        const step = card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || 0);
        track.scrollBy({ left: step * Number(arrow.dataset.dir), behavior: 'smooth' });
    });
}

/* ---------- Home ---------- */

function initHome() {
    carousel('#bestsellers', PRODUCTS.slice(0, 8).map(p => productCard(p)).join(''));

    const collections = $('#collections');
    if (collections) {
        const tile = c => `
            <a href="shop.html?collection=${c.id}" class="collection-tile">
                <img src="images/${c.image}" alt="" loading="lazy">
                <span>${c.name}</span>
            </a>`;
        // Rows follow the design: two tiles, two tiles, then three.
        const rows = [COLLECTIONS.slice(0, 2), COLLECTIONS.slice(2, 4), COLLECTIONS.slice(4, 7)];
        collections.innerHTML = rows.map((row, i) =>
            `<div class="collection-row row-${i + 1}">${row.map(tile).join('')}</div>`).join('');
    }

    if ($('#latestArticles')) {
        const first = HOME_POSTS.map(id => POSTS.find(p => p.id === id));
        const rest = POSTS.filter(p => !HOME_POSTS.includes(p.id));
        carousel('#latestArticles', [...first, ...rest].map(postCard).join(''));
    }
}

/* ---------- Shop ---------- */

function initShop() {
    const grid = $('#shopGrid');
    if (!grid) return;

    const selects = {
        collection: $('#filterCollection'),
        family: $('#filterFamily'),
        gender: $('#filterGender'),
        occasion: $('#filterOccasion')
    };
    const sort = $('#sortBy');
    const query = (params.get('q') || '').trim().toLowerCase();
    const wishOnly = params.get('wishlist') === '1';
    let page = 1;

    const fill = (select, options) => {
        select.insertAdjacentHTML('beforeend', options.map(o => `<option value="${o.value}">${o.label}</option>`).join(''));
    };
    fill(selects.collection, COLLECTIONS.map(c => ({ value: c.id, label: c.name })));
    fill(selects.family, FAMILIES.map(v => ({ value: v, label: v })));
    fill(selects.gender, GENDERS.map(v => ({ value: v, label: v })));
    fill(selects.occasion, OCCASIONS.map(v => ({ value: v, label: v })));

    const requested = params.get('collection');
    if (COLLECTIONS.some(c => c.id === requested)) selects.collection.value = requested;

    if (wishOnly) $('#shopTitle').textContent = 'Your Wish List';
    else if (query) $('#shopTitle').textContent = `Results for "${params.get('q').trim()}"`;

    function render() {
        const wishlist = readStore(WISH_KEY);
        let list = PRODUCTS.filter(p =>
            Object.keys(selects).every(key => !selects[key].value || p[key] === selects[key].value) &&
            (!query || p.name.toLowerCase().includes(query)) &&
            (!wishOnly || wishlist.includes(p.id)));

        if (sort.value === 'low') list.sort((a, b) => a.price - b.price);
        if (sort.value === 'high') list.sort((a, b) => b.price - a.price);
        if (sort.value === 'rating') list.sort((a, b) => b.rating - a.rating || b.reviews - a.reviews);
        if (sort.value === 'name') list.sort((a, b) => a.name.localeCompare(b.name));

        const pages = Math.max(1, Math.ceil(list.length / PER_PAGE));
        page = Math.min(page, pages);
        const visible = list.slice((page - 1) * PER_PAGE, page * PER_PAGE);

        grid.innerHTML = visible.length
            ? visible.map(p => productCard(p, true)).join('')
            : `<p class="empty-state">${wishOnly ? 'Your wish list is empty.' : 'No perfumes match these filters.'} <a href="shop.html">View all products</a></p>`;

        $('#pageInfo').textContent = `Page ${page} of ${pages}`;
        $('#pagePrev').disabled = page === 1;
        $('#pageNext').disabled = page === pages;
    }

    [...Object.values(selects), sort].forEach(select => select.addEventListener('change', () => {
        page = 1;
        render();
    }));
    const turn = delta => {
        page += delta;
        render();
        $('#shopTitle').scrollIntoView({ behavior: 'smooth' });
    };
    $('#pagePrev').addEventListener('click', () => turn(-1));
    $('#pageNext').addEventListener('click', () => turn(1));

    $('#offers').innerHTML = OFFERS.map(o => `
        <div class="offer offer-${o.theme}">
            <img src="images/${o.image}" alt="${o.name} perfume" loading="lazy">
            <div class="offer-text">
                <h3>${o.headline}</h3>
                <p class="offer-name">${o.name}</p>
                <p class="offer-tagline">${o.tagline}</p>
                <p>${o.text}</p>
                <a href="contact.html" class="btn btn-outline btn-small">Know More</a>
            </div>
        </div>`).join('');

    render();
}

/* ---------- Product page ---------- */

function productSections(p) {
    return [
        { title: 'Product Details', text: `Step into a world of unparalleled opulence with ${p.name}, an exquisite fragrance that weaves an enchanting symphony of gold and luxury. This gilded elixir is a celebration of sophistication, crafted with the finest essences and imbued with the allure of precious golden hues. From the first spritz to the lingering dry-down, ${p.name} promises an intoxicating experience that embodies the essence of lavish indulgence.` },
        { title: 'The Golden Overture', text: `${p.name} opens with a grand flourish of radiant citrus and sun-kissed fruits, reminiscent of golden rays caressing your senses. The opulent heart unfolds with a bouquet of velvety roses and rare blooms, their essence radiating with the allure of gilded petals. As the fragrance settles, a sumptuous blend of warm amber, creamy vanilla, and smooth sandalwood evokes a sense of ultimate luxury and refinement.` },
        { notes: true },
        { title: 'The Heart of Elegance', text: `${p.name} is the embodiment of elegance, drawing you into a world where glamour and prestige unite. With every spritz, the fragrance weaves a tapestry of glistening gold around you, enhancing your allure and capturing the admiration of those around.` },
        { title: 'The Ultimate Expression of Luxury', text: `${p.name} makes an extraordinary gift, an expression of your discerning taste and admiration for the extraordinary. Delight your loved ones with this lavish elixir, a symbol of admiration and adoration.` }
    ];
}

function initProduct() {
    const wrap = $('#productDetail');
    if (!wrap) return;

    const p = findProduct(params.get('id'));
    if (!p) {
        $('#productMore').hidden = true;
        wrap.innerHTML = `
            <div class="empty-state">
                <h2>We couldn't find that perfume</h2>
                <p>It may have been moved or sold out.</p>
                <a href="shop.html" class="btn">Back to shop</a>
            </div>`;
        return;
    }

    document.title = `${p.name} | Local Face`;
    $('#crumbName').textContent = p.name;
    const notes = p.notes || DEFAULT_NOTES;
    let size = 100;
    let qty = 1;

    wrap.innerHTML = `
        <div class="product-stage">
            <img src="images/${p.image}" alt="${p.name} perfume bottle">
        </div>
        <div class="product-info">
            <h1>${p.name}</h1>
            <p class="product-intro">Step into a world of unparalleled opulence with ${p.name}, an exquisite fragrance that weaves an enchanting symphony of gold and luxury. This gilded elixir is a celebration of sophistication, crafted with the finest essences and imbued with the allure of precious golden hues.</p>
            <p class="product-rating">${stars(p.rating)}<small>(${p.reviews})</small><a href="#reviews">Reviews and Ratings</a></p>

            <div class="size-options" id="sizeOptions">
                ${SIZES.map(s => `
                    <button class="size-btn" data-size="${s}">
                        <img src="images/${p.image}" alt="">
                        <span>${s} ml</span>
                    </button>`).join('')}
            </div>

            <p class="detail-price" id="detailPrice"></p>

            <div class="buy-row">
                <span>Qty</span>
                <div class="qty">
                    <button id="qtyMinus" aria-label="Decrease quantity">&minus;</button>
                    <span id="qtyValue">1</span>
                    <button id="qtyPlus" aria-label="Increase quantity">+</button>
                </div>
                <button class="wish-btn" id="wishBtn" aria-pressed="false">Wish list ${ICONS.heart}</button>
            </div>

            <button class="btn btn-bag" id="addToBag">Add to Bag</button>
            <p class="pay-later">Shop now and pay later with 4 payments</p>
        </div>`;

    function update() {
        $('#detailPrice').textContent = formatPrice(priceFor(p, size));
        $('#qtyValue').textContent = qty;
        $$('.size-btn', wrap).forEach(b => b.classList.toggle('active', Number(b.dataset.size) === size));
        const wished = readStore(WISH_KEY).includes(p.id);
        $('#wishBtn').classList.toggle('active', wished);
        $('#wishBtn').setAttribute('aria-pressed', wished);
    }

    $('#sizeOptions').addEventListener('click', e => {
        const btn = e.target.closest('.size-btn');
        if (!btn) return;
        size = Number(btn.dataset.size);
        update();
    });
    $('#qtyMinus').addEventListener('click', () => { qty = Math.max(1, qty - 1); update(); });
    $('#qtyPlus').addEventListener('click', () => { qty = Math.min(10, qty + 1); update(); });
    $('#addToBag').addEventListener('click', () => addToCart(p.id, size, qty));
    $('#wishBtn').addEventListener('click', () => {
        const list = readStore(WISH_KEY);
        const wished = list.includes(p.id);
        writeStore(WISH_KEY, wished ? list.filter(id => id !== p.id) : [...list, p.id]);
        update();
        showToast(wished ? 'Removed from your wish list.' : 'Added to your wish list.');
    });
    update();

    $('#productSections').innerHTML = productSections(p).map(s => s.notes ? `
        <section class="detail-section">
            <h2>Key Notes</h2>
            <div class="notes">
                <div><h3>Top Note</h3><p>${notes.top}</p><img src="images/note-top.jpg" alt="" loading="lazy"></div>
                <div><h3>Heart Note</h3><p>${notes.heart}</p><img src="images/note-heart.jpg" alt="" loading="lazy"></div>
                <div><h3>Base Note</h3><p>${notes.base}</p><img src="images/note-base.jpg" alt="" loading="lazy"></div>
            </div>
        </section>` : `
        <section class="detail-section">
            <h2>${s.title}</h2>
            <p>${s.text}</p>
        </section>`).join('');

    initReviews(p);

    const featured = ['luxurious-elixir-rough', 'golden-legacy', 'luxurious-elixir', 'luxurious-golden-legacy'];
    const more = [...featured.map(findProduct), ...PRODUCTS.filter(o => !featured.includes(o.id))].filter(o => o.id !== p.id);
    carousel('#discoverMore', more.slice(0, 8).map(o => productCard(o)).join(''));
}

async function initReviews(p) {
    const REVIEWS_PER_PAGE = 3;
    const avatarColors = ['#e2574c', '#3aa6a0', '#8a5fb5'];
    const form = $('#reviewForm');
    let shown = REVIEWS_PER_PAGE;
    let data;

    async function load() {
        try {
            data = await api(`/api/products/${p.id}/reviews`);
        } catch (err) {
            // The store could not be opened: show the starter reviews from data.js.
            const reviews = REVIEWS.map(r => ({ ...r, rating: 5, date: new Date(r.date + ' UTC').toISOString() }));
            data = { reviews, breakdown: { 5: reviews.length, 4: 0, 3: 0, 2: 0, 1: 0 }, total: p.reviews, rating: p.rating };
        }
        render();
    }

    function render() {
        const written = data.reviews.length;
        const percent = n => (written ? Math.round(data.breakdown[n] / written * 100) : 0);
        const recommend = written ? Math.round((data.breakdown[5] + data.breakdown[4]) / written * 100) : 0;
        const bar = n => `
            <div class="bar-row"><span>${n} star${n === 1 ? '' : 's'}</span><div class="bar"><i style="width:${percent(n)}%"></i></div><span>${percent(n)}%</span></div>`;

        $('#reviewSummary').innerHTML = `
            <div class="bars">${[5, 4, 3, 2, 1].map(bar).join('')}</div>
            <div class="review-score">
                ${stars(Math.round(data.rating * 2) / 2)}
                <p class="score">${data.rating} out of 5</p>
                <p>${recommend}% of reviewers recommend this product</p>
                <p>${data.total} reviews <button id="addReview">+ &nbsp;Add a Review</button></p>
            </div>`;

        $('#reviewList').innerHTML = data.reviews.slice(0, shown).map((r, i) => `
            <div class="review">
                <span class="avatar" style="background:${avatarColors[i % avatarColors.length]}">${escapeHTML(r.name[0].toUpperCase())}</span>
                <div>
                    ${stars(r.rating)}
                    <p>${escapeHTML(r.text)}</p>
                    <p class="review-meta"><span>${escapeHTML(r.name)}</span><span>${formatDate(r.date)}</span></p>
                </div>
            </div>`).join('');

        $('#loadReviews').hidden = shown >= written;

        $('#addReview').addEventListener('click', () => {
            if (!currentUser) {
                location.href = 'account.html?next=' + encodeURIComponent(`product.html?id=${p.id}`);
                return;
            }
            form.hidden = false;
            form.scrollIntoView({ behavior: 'smooth', block: 'center' });
        });
    }

    $('#loadReviews').addEventListener('click', () => {
        shown += REVIEWS_PER_PAGE;
        render();
    });

    form.addEventListener('submit', async e => {
        e.preventDefault();
        try {
            await api(`/api/products/${p.id}/reviews`, {
                method: 'POST',
                body: { rating: Number($('#reviewRating').value), text: $('#reviewText').value }
            });
            form.reset();
            form.hidden = true;
            showToast('Thank you for your review!');
            await load();
        } catch (err) {
            showToast(err.message);
        }
    });

    await load();
}

/* ---------- Services ---------- */

function initServices() {
    const list = $('#serviceList');
    if (!list) return;
    list.innerHTML = SERVICES.map((s, i) => `
        <div class="service">
            <div class="service-text">
                <span class="service-num">0${i + 1}.</span>
                <h2>${s.title}</h2>
                <p>${s.text}</p>
            </div>
            <img src="images/${s.image}" alt="" loading="lazy">
        </div>`).join('');
}

/* ---------- Blog ---------- */

function initBlog() {
    const grid = $('#blogGrid');
    if (!grid) return;

    const search = $('#blogSearch');
    const category = $('#blogCategory');
    const sort = $('#blogSort');

    const categories = [...new Set(POSTS.map(p => p.category))];
    category.insertAdjacentHTML('beforeend', categories.map(c => `<option>${c}</option>`).join(''));

    function render() {
        const q = search.value.trim().toLowerCase();
        const list = POSTS.filter(p =>
            (!category.value || p.category === category.value) &&
            (!q || (p.title + ' ' + p.excerpt).toLowerCase().includes(q)));

        if (sort.value === 'new') list.sort((a, b) => new Date(b.date) - new Date(a.date));
        if (sort.value === 'old') list.sort((a, b) => new Date(a.date) - new Date(b.date));
        if (sort.value === 'title') list.sort((a, b) => a.title.localeCompare(b.title));

        grid.innerHTML = list.length
            ? list.map(postCard).join('')
            : '<p class="empty-state">No articles match your search.</p>';
    }

    search.addEventListener('input', render);
    $('#blogSearchForm').addEventListener('submit', e => e.preventDefault());
    category.addEventListener('change', render);
    sort.addEventListener('change', render);
    $('#loadPosts').addEventListener('click', () => showToast('You are all caught up — no more articles yet.'));
    render();
}

function initArticle() {
    const wrap = $('#article');
    if (!wrap) return;

    const index = POSTS.findIndex(p => p.id === params.get('id'));
    const post = POSTS[index];
    if (!post) {
        wrap.innerHTML = `
            <div class="empty-state">
                <h2>We couldn't find that article</h2>
                <a href="blog.html" class="btn">Back to blog</a>
            </div>`;
        return;
    }

    document.title = `${post.title} | Local Face`;
    $('#crumbName').textContent = post.title;

    const part = b => `${b.heading ? `<h2>${b.heading}</h2>` : ''}<p>${b.text}</p>`;
    const body = post.body.map(b => b.image ? `
        <div class="article-split ${b.side}">
            <img src="images/${b.image}" alt="" loading="lazy">
            <div>${b.parts.map(part).join('')}</div>
        </div>` : part(b)).join('');

    // Posts are listed newest first, so the previous (older) post is the next entry.
    const prev = POSTS[index + 1];
    const next = POSTS[index - 1];
    const url = encodeURIComponent(location.href);
    const title = encodeURIComponent(post.title);

    wrap.innerHTML = `
        <header class="article-head">
            <p>${post.date}</p>
            <p>${post.category}</p>
            <h1>${post.title.replace(': ', ':<br>')}</h1>
        </header>
        <img class="article-hero" src="images/${post.image}" alt="">
        <div class="article-body">
            ${body}
            ${post.author ? `<p class="article-sign">${post.signoff ? escapeHTML(post.signoff) + '<br>' : ''}${escapeHTML(post.author)}</p>` : ''}
        </div>
        <div class="article-foot">
            ${prev ? `<a href="article.html?id=${prev.id}" class="post-nav">${ICONS.chevronLeft} Previous Post</a>` : '<span></span>'}
            <div class="share">
                <p>Share On</p>
                <div class="socials">
                    ${socialIcon('twitter', `https://twitter.com/intent/tweet?url=${url}&text=${title}`)}
                    ${socialIcon('facebook', `https://www.facebook.com/sharer/sharer.php?u=${url}`)}
                    ${socialIcon('linkedin', `https://www.linkedin.com/sharing/share-offsite/?url=${url}`)}
                </div>
            </div>
            ${next ? `<a href="article.html?id=${next.id}" class="post-nav">Next Post ${ICONS.chevronRight}</a>` : '<span></span>'}
        </div>`;
}

/* ---------- Contact ---------- */

function initContact() {
    const form = $('#contactForm');
    if (!form) return;
    form.addEventListener('submit', async e => {
        e.preventDefault();
        try {
            await api('/api/contact', {
                method: 'POST',
                body: { name: $('#name').value, email: $('#email').value, message: $('#message').value }
            });
            form.reset();
            $('#formSuccess').hidden = false;
        } catch (err) {
            $('#formSuccess').hidden = true;
            showToast(err.message);
        }
    });
}

/* ---------- Account ---------- */

function orderCard(o) {
    return `
        <div class="order-card">
            <div class="order-head">
                <strong>Order #${o.id}</strong>
                <span>${formatDate(o.date)}</span>
                <span class="status status-${o.status}">${o.status}</span>
            </div>
            <ul>
                ${o.items.map(i => `<li><span>${escapeHTML(i.name)} &middot; ${i.size} ml &times; ${i.qty}</span><span>${formatPrice(i.price * i.qty)}</span></li>`).join('')}
            </ul>
            <p class="order-total"><span>Total</span><strong>${formatPrice(o.total)}</strong></p>
        </div>`;
}

async function initAccount() {
    const wrap = $('#account');
    if (!wrap) return;
    const next = safeNext(params.get('next'));

    if (!currentUser) {
        wrap.innerHTML = `
            <div class="auth-grid">
                <form class="form" id="loginForm">
                    <h2>Sign In</h2>
                    <div class="field"><label for="loginEmail">Email</label><input type="email" id="loginEmail" autocomplete="email" required></div>
                    <div class="field"><label for="loginPassword">Password</label><input type="password" id="loginPassword" autocomplete="current-password" required></div>
                    <button type="submit" class="btn btn-block">Sign In</button>
                </form>
                <form class="form" id="registerForm">
                    <h2>Create Account</h2>
                    <div class="field"><label for="regName">Name</label><input type="text" id="regName" autocomplete="name" minlength="2" required></div>
                    <div class="field"><label for="regEmail">Email</label><input type="email" id="regEmail" autocomplete="email" required></div>
                    <div class="field"><label for="regPassword">Password</label><input type="password" id="regPassword" autocomplete="new-password" minlength="8" required><small>At least 8 characters</small></div>
                    <button type="submit" class="btn btn-block">Create Account</button>
                </form>
            </div>`;

        const submit = (formId, path, body) => $(formId).addEventListener('submit', async e => {
            e.preventDefault();
            try {
                await api(path, { method: 'POST', body: body() });
                location.href = next || 'account.html';
            } catch (err) {
                showToast(err.message);
            }
        });
        submit('#loginForm', '/api/auth/login', () => ({ email: $('#loginEmail').value, password: $('#loginPassword').value }));
        submit('#registerForm', '/api/auth/register', () => ({ name: $('#regName').value, email: $('#regEmail').value, password: $('#regPassword').value }));
        return;
    }

    wrap.innerHTML = `
        <div class="account-head">
            <div>
                <h2>Hello, ${escapeHTML(currentUser.name)}</h2>
                <p class="lead">${escapeHTML(currentUser.email)}</p>
            </div>
            <div class="account-actions">
                ${currentUser.role === 'admin' ? '<a href="admin.html" class="btn btn-small">Admin Panel</a>' : ''}
                <button class="btn btn-outline btn-small" id="logoutBtn">Sign Out</button>
            </div>
        </div>
        <h3 class="sub-title">My Orders</h3>
        <div id="myOrders"><p class="lead">Loading...</p></div>`;

    $('#logoutBtn').addEventListener('click', async () => {
        try {
            await api('/api/auth/logout', { method: 'POST', body: {} });
            location.href = 'account.html';
        } catch (err) {
            showToast(err.message);
        }
    });

    try {
        const orders = await api('/api/orders/mine');
        $('#myOrders').innerHTML = orders.length
            ? orders.map(orderCard).join('')
            : '<p class="lead">You have not placed any orders yet. <a href="shop.html" class="link">Browse the shop</a></p>';
    } catch (err) {
        $('#myOrders').innerHTML = `<p class="lead">${escapeHTML(err.message)}</p>`;
    }
}

/* ---------- Checkout ---------- */

function initCheckout() {
    const wrap = $('#checkout');
    if (!wrap) return;

    if (!cart.length) {
        wrap.innerHTML = '<p class="empty-state">Your bag is empty. <a href="shop.html">Browse the shop</a></p>';
        return;
    }

    const total = cart.reduce((sum, i) => sum + priceFor(findProduct(i.id), i.size) * i.qty, 0);
    const field = (id, label, type = 'text', extra = '') => `
        <div class="field"><label for="${id}">${label}</label><input type="${type}" id="${id}" ${extra} required></div>`;

    wrap.innerHTML = `
        <form class="form" id="checkoutForm">
            <h2>Delivery Details</h2>
            <div class="form-row">
                ${field('coName', 'Full name', 'text', 'autocomplete="name" minlength="2"')}
                ${field('coEmail', 'Email', 'email', 'autocomplete="email"')}
            </div>
            ${field('coPhone', 'Phone', 'tel', 'autocomplete="tel" minlength="6"')}
            ${field('coAddress', 'Address', 'text', 'autocomplete="street-address" minlength="5"')}
            <div class="form-row">
                ${field('coCity', 'City', 'text', 'autocomplete="address-level2"')}
                ${field('coPostal', 'Postal code', 'text', 'autocomplete="postal-code"')}
            </div>
            <p class="pay-note">Payment: pay on delivery. Online payment is not connected yet.</p>
            <button type="submit" class="btn btn-block">Place Order</button>
        </form>
        <aside class="order-card">
            <div class="order-head"><strong>Order Summary</strong></div>
            <ul>
                ${cart.map(i => {
                    const p = findProduct(i.id);
                    return `<li><span>${p.name} &middot; ${i.size} ml &times; ${i.qty}</span><span>${formatPrice(priceFor(p, i.size) * i.qty)}</span></li>`;
                }).join('')}
            </ul>
            <p class="order-total"><span>Total</span><strong>${formatPrice(total)}</strong></p>
        </aside>`;

    if (currentUser) {
        $('#coName').value = currentUser.name;
        $('#coEmail').value = currentUser.email;
    }

    $('#checkoutForm').addEventListener('submit', async e => {
        e.preventDefault();
        const button = $('button[type="submit"]', e.target);
        button.disabled = true;
        try {
            const { order } = await api('/api/orders', {
                method: 'POST',
                body: {
                    customer: {
                        name: $('#coName').value,
                        email: $('#coEmail').value,
                        phone: $('#coPhone').value,
                        address: $('#coAddress').value,
                        city: $('#coCity').value,
                        postalCode: $('#coPostal').value
                    },
                    items: cart
                }
            });
            cart = [];
            writeStore(CART_KEY, cart);
            renderCart();
            wrap.innerHTML = `
                <div class="empty-state">
                    <h2>Thank you! Your order is placed.</h2>
                    <p>Order number <strong>#${order.id}</strong> &middot; Total ${formatPrice(order.total)}</p>
                    <a href="${currentUser ? 'account.html' : 'shop.html'}" class="btn">${currentUser ? 'View My Orders' : 'Continue Shopping'}</a>
                </div>`;
            window.scrollTo({ top: 0 });
        } catch (err) {
            button.disabled = false;
            showToast(err.message);
        }
    });
}

/* ---------- Start ---------- */

document.addEventListener('DOMContentLoaded', async () => {
    buildLayout();

    // Products and the signed-in user come from the local store; if it cannot be
    // opened the page still works from the starter list in data.js.
    const [products, me] = await Promise.all([
        api('/api/products').catch(() => null),
        api('/api/auth/me').catch(() => null)
    ]);
    if (products) PRODUCTS = products;
    currentUser = me ? me.user : null;

    loadCart();
    renderCart();
    initHome();
    initShop();
    initProduct();
    initServices();
    initBlog();
    initArticle();
    initContact();
    initAccount();
    initCheckout();
    document.dispatchEvent(new Event('site:ready'));
});
