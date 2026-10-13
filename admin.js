// Admin panel. Runs after script.js has loaded the signed-in user (the "site:ready" event).
// Everything typed by customers is passed through escapeHTML before it is shown.

let editingId = null;
let adminProducts = [];

document.addEventListener('site:ready', () => {
    const gate = $('#adminGate');

    if (!currentUser) {
        gate.hidden = false;
        gate.innerHTML = '<h2>Please sign in</h2><p>The admin panel needs an admin account.</p><a href="account.html?next=admin.html" class="btn">Sign In</a>';
        return;
    }
    if (currentUser.role !== 'admin') {
        gate.hidden = false;
        gate.innerHTML = '<h2>Admin access only</h2><p>This account cannot open the admin panel.</p><a href="index.html" class="btn">Back to Home</a>';
        return;
    }

    $('#adminPanel').hidden = false;
    initTabs();
    initProductForm();
    loadStats();
    loadOrders();
    loadProducts();
    loadMessages();
    loadSubscribers();
});

function initTabs() {
    $('#adminTabs').addEventListener('click', e => {
        const tab = e.target.closest('[data-tab]');
        if (!tab) return;
        $$('#adminTabs button').forEach(b => b.classList.toggle('active', b === tab));
        $$('#adminPanel > section').forEach(s => { s.hidden = s.id !== 'tab-' + tab.dataset.tab; });
    });
}

function table(headers, rows, emptyText) {
    if (!rows.length) return `<p class="lead">${emptyText}</p>`;
    return `
        <div class="table-wrap">
            <table>
                <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
                <tbody>${rows.join('')}</tbody>
            </table>
        </div>`;
}

/* ---------- Dashboard numbers ---------- */

async function loadStats() {
    try {
        const s = await api('/api/admin/summary');
        const stat = (label, value) => `<div class="stat"><strong>${value}</strong><span>${label}</span></div>`;
        $('#adminStats').innerHTML =
            stat('Orders', s.orders) + stat('Pending', s.pending) + stat('Revenue', formatPrice(s.revenue)) +
            stat('Products', s.products) + stat('Customers', s.customers) + stat('Subscribers', s.subscribers);
    } catch (err) {
        showToast(err.message);
    }
}

/* ---------- Orders ---------- */

async function loadOrders() {
    const wrap = $('#tab-orders');
    try {
        const orders = await api('/api/admin/orders');
        wrap.innerHTML = table(['Order', 'Customer', 'Items', 'Total', 'Status'], orders.map(o => `
            <tr>
                <td><strong>#${o.id}</strong><br><small>${formatDate(o.date)}</small></td>
                <td>
                    ${escapeHTML(o.name)}<br>
                    <small>${escapeHTML(o.email)}<br>${escapeHTML(o.phone)}<br>${escapeHTML(o.address)}, ${escapeHTML(o.city)} ${escapeHTML(o.postal_code)}</small>
                </td>
                <td>${o.items.map(i => `${escapeHTML(i.name)} &middot; ${i.size} ml &times; ${i.qty}`).join('<br>')}</td>
                <td>${formatPrice(o.total)}</td>
                <td>
                    <select class="boxed" data-order="${o.id}" aria-label="Status of order ${o.id}">
                        ${ORDER_STATUSES.map(s => `<option${s === o.status ? ' selected' : ''}>${s}</option>`).join('')}
                    </select>
                </td>
            </tr>`), 'No orders yet.');
    } catch (err) {
        wrap.innerHTML = `<p class="lead">${escapeHTML(err.message)}</p>`;
    }
}

document.addEventListener('change', async e => {
    const select = e.target.closest('[data-order]');
    if (!select) return;
    try {
        await api(`/api/admin/orders/${select.dataset.order}`, { method: 'PATCH', body: { status: select.value } });
        showToast(`Order #${select.dataset.order} marked ${select.value}.`);
        loadStats();
    } catch (err) {
        showToast(err.message);
        loadOrders();
    }
});

/* ---------- Products ---------- */

function initProductForm() {
    const options = (id, list) => {
        $(id).innerHTML = '<option value="">None</option>' + list.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
    };
    const same = list => list.map(v => ({ value: v, label: v }));
    options('#pCollection', COLLECTIONS.map(c => ({ value: c.id, label: c.name })));
    options('#pFamily', same(FAMILIES));
    options('#pGender', same(GENDERS));
    options('#pOccasion', same(OCCASIONS));

    $('#productForm').addEventListener('submit', async e => {
        e.preventDefault();
        const body = {
            name: $('#pName').value,
            price: Number($('#pPrice').value),
            image: $('#pImage').value,
            collection: $('#pCollection').value,
            family: $('#pFamily').value,
            gender: $('#pGender').value,
            occasion: $('#pOccasion').value,
            bestseller: $('#pBestseller').checked
        };
        try {
            if (editingId) await api(`/api/admin/products/${editingId}`, { method: 'PUT', body });
            else await api('/api/admin/products', { method: 'POST', body });
            showToast(editingId ? 'Product updated.' : 'Product added.');
            resetProductForm();
            loadProducts();
            loadStats();
        } catch (err) {
            showToast(err.message);
        }
    });

    $('#productCancel').addEventListener('click', resetProductForm);

    $('#productTable').addEventListener('click', async e => {
        const edit = e.target.closest('[data-edit]');
        const remove = e.target.closest('[data-remove]');

        if (edit) {
            const p = adminProducts.find(x => x.id === edit.dataset.edit);
            editingId = p.id;
            $('#pName').value = p.name;
            $('#pPrice').value = p.price;
            $('#pImage').value = p.image;
            $('#pCollection').value = p.collection;
            $('#pFamily').value = p.family;
            $('#pGender').value = p.gender;
            $('#pOccasion').value = p.occasion;
            $('#pBestseller').checked = p.bestseller;
            $('#productFormTitle').textContent = 'Edit Product';
            $('#productSubmit').textContent = 'Save Changes';
            $('#productCancel').hidden = false;
            $('#productForm').scrollIntoView({ behavior: 'smooth' });
        }

        if (remove) {
            const p = adminProducts.find(x => x.id === remove.dataset.remove);
            if (!confirm(`Remove "${p.name}" from the shop?`)) return;
            try {
                await api(`/api/admin/products/${p.id}`, { method: 'DELETE', body: {} });
                showToast('Product removed from the shop.');
                if (editingId === p.id) resetProductForm();
                loadProducts();
                loadStats();
            } catch (err) {
                showToast(err.message);
            }
        }
    });
}

function resetProductForm() {
    editingId = null;
    $('#productForm').reset();
    $('#productFormTitle').textContent = 'Add Product';
    $('#productSubmit').textContent = 'Add Product';
    $('#productCancel').hidden = true;
}

async function loadProducts() {
    try {
        adminProducts = await api('/api/products');
        $('#productTable').innerHTML = table(['', 'Name', 'Price', 'Rating', 'Details', ''], adminProducts.map(p => `
            <tr>
                <td><img class="thumb" src="images/${escapeHTML(p.image)}" alt=""></td>
                <td>${escapeHTML(p.name)}${p.bestseller ? '<br><small>Best seller</small>' : ''}</td>
                <td>${formatPrice(p.price)}</td>
                <td>${p.rating} (${p.reviews})</td>
                <td><small>${[p.collection, p.family, p.gender, p.occasion].filter(Boolean).map(escapeHTML).join(' &middot; ')}</small></td>
                <td class="row-actions">
                    <button class="btn btn-outline btn-tiny" data-edit="${escapeHTML(p.id)}">Edit</button>
                    <button class="btn btn-outline btn-tiny" data-remove="${escapeHTML(p.id)}">Remove</button>
                </td>
            </tr>`), 'No products yet.');
    } catch (err) {
        $('#productTable').innerHTML = `<p class="lead">${escapeHTML(err.message)}</p>`;
    }
}

/* ---------- Messages and subscribers ---------- */

async function loadMessages() {
    const wrap = $('#tab-messages');
    try {
        const messages = await api('/api/admin/messages');
        wrap.innerHTML = table(['Date', 'From', 'Message'], messages.map(m => `
            <tr>
                <td><small>${formatDate(m.date)}</small></td>
                <td>${escapeHTML(m.name)}<br><small>${escapeHTML(m.email)}</small></td>
                <td class="wrap-text">${escapeHTML(m.message)}</td>
            </tr>`), 'No messages yet.');
    } catch (err) {
        wrap.innerHTML = `<p class="lead">${escapeHTML(err.message)}</p>`;
    }
}

async function loadSubscribers() {
    const wrap = $('#tab-subscribers');
    try {
        const subscribers = await api('/api/admin/subscribers');
        wrap.innerHTML = table(['Email', 'Subscribed on'], subscribers.map(s => `
            <tr><td>${escapeHTML(s.email)}</td><td><small>${formatDate(s.date)}</small></td></tr>`), 'No subscribers yet.');
    } catch (err) {
        wrap.innerHTML = `<p class="lead">${escapeHTML(err.message)}</p>`;
    }
}
