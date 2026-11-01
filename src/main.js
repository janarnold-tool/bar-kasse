import { createLocalStore } from './store-local.js';
import { ICON_CHOICES, COLOR_CHOICES } from './defaults.js';

// ---------- Hilfsfunktionen ----------
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function chf(rappen) {
  const [int, dec] = (Math.abs(rappen) / 100).toFixed(2).split('.');
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, "'");
  return `CHF ${rappen < 0 ? '-' : ''}${grouped}.${dec}`;
}
const priceInput = (rappen) => (rappen / 100).toFixed(2);
function parsePrice(text) {
  const t = String(text).trim().replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(t)) return null;
  return Math.round(parseFloat(t) * 100);
}
// Ein Symbol ist entweder ein Emoji oder ein Hersteller-Logo als «logo:<datei>» (liegt in public/logos/).
// LOGOS wird beim Bauen aus dem Ordner public/logos/ eingesetzt.
const LOGO_RE = /^logo:([a-z0-9][a-z0-9._-]*\.(png|svg|webp|jpg))$/;
function iconHtml(icon, fallback = '') {
  const m = LOGO_RE.exec(icon || '');
  if (m) return `<img class="logo" src="logos/${m[1]}" alt="" draggable="false" />`;
  return esc(icon || fallback);
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0) || String(a.name).localeCompare(b.name, 'de-CH');
const toDate = (v) => (v?.toDate ? v.toDate() : typeof v === 'number' ? new Date(v) : null);

// localStorage kann (z.B. im privaten Modus) fehlen; die Kasse soll trotzdem laufen.
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* egal */ } },
};

function deviceName() {
  let name = ls.get('bar-kasse-device');
  if (!name) {
    name = 'Kasse-' + Math.random().toString(36).slice(2, 6).toUpperCase();
    ls.set('bar-kasse-device', name);
  }
  return name;
}

// ---------- Zustand ----------
const S = {
  categories: [],
  products: [],
  epoch: null,
  resetAt: null,
  orders: [],
  fromCache: true,
  online: navigator.onLine,
  cart: loadCart(), // [{id, qty}] in Reihenfolge des ersten Antippens
  view: 'kasse',
  checkout: null, // {orderId, total, items}
};

function loadCart() {
  try { return JSON.parse(ls.get('bar-kasse-cart')) || []; } catch { return []; }
}
function saveCart() {
  ls.set('bar-kasse-cart', JSON.stringify(S.cart));
}

const sortedCategories = () => [...S.categories].sort(byOrder);
const productsIn = (catId) => S.products.filter((p) => p.category === catId).sort(byOrder);
const productById = (id) => S.products.find((p) => p.id === id);
const categoryById = (id) => S.categories.find((c) => c.id === id);
// Getränke ohne (gültige) Kategorie trotzdem anzeigen
function orphanProducts() {
  const ids = new Set(S.categories.map((c) => c.id));
  return S.products.filter((p) => !ids.has(p.category)).sort(byOrder);
}
function groups() {
  const g = sortedCategories().map((c) => ({ cat: c, items: productsIn(c.id) }));
  const orphans = orphanProducts();
  if (orphans.length) g.push({ cat: { id: '', name: 'Ohne Kategorie', color: '#5b6474' }, items: orphans });
  return g;
}

function cartLines() {
  return S.cart
    .map(({ id, qty }) => ({ product: productById(id), qty }))
    .filter((l) => l.product && l.qty > 0);
}
const cartTotal = () => cartLines().reduce((sum, l) => sum + l.product.price * l.qty, 0);

// ---------- Store ----------
let store;
async function createStore() {
  const params = new URLSearchParams(location.search);
  const cfg = window.BAR_KASSE_FIREBASE;
  if (cfg && cfg.projectId && !params.has('lokal')) {
    const { createFirebaseStore } = await import('./store-firebase.js');
    return createFirebaseStore(cfg);
  }
  return createLocalStore();
}

let unsubOrders = null;
function subscribeOrders(epoch) {
  unsubOrders?.();
  unsubOrders = store.onOrders(epoch, (orders, meta) => {
    S.orders = orders;
    S.fromCache = meta.fromCache;
    renderStatus();
    if (S.view === 'auswertung') renderReport();
  });
}

// ---------- Rendering: Rahmen ----------
function renderTabs() {
  document.querySelectorAll('[data-view]').forEach((b) => b.classList.toggle('active', b.dataset.view === S.view));
  document.querySelectorAll('.view').forEach((v) => (v.hidden = v.id !== `view-${S.view}`));
}

function renderStatus() {
  const el = $('#status');
  const pending = S.orders.filter((o) => o.pending).length;
  let cls, text;
  if (store.mode === 'local') {
    cls = 'local'; text = 'Testmodus · nur dieses Gerät';
  } else if (S.online && !S.fromCache) {
    cls = 'online'; text = 'Online';
  } else if (S.online && S.fromCache && !S.everConnected) {
    cls = 'connecting'; text = 'Verbinde …';
  } else {
    cls = 'offline'; text = 'Offline';
  }
  if (pending) text += ` · ${pending} ausstehend`;
  el.className = `status ${cls}${pending ? ' pending' : ''}`;
  el.innerHTML = `<span class="dot"></span>${esc(text)}`;
  el.title = pending
    ? `${pending} Bestellung(en) sind erst auf diesem Gerät gespeichert und werden automatisch nachgesendet.`
    : 'Alle Bestellungen sind übermittelt.';
}

// ---------- Kassieren ----------
function renderMenu() {
  const el = $('#menu');
  el.innerHTML = groups()
    .filter((g) => g.items.length)
    .map(
      (g) => `
      <section class="cat" style="--cat:${esc(g.cat.color)}">
        <h2>${esc(g.cat.name)}</h2>
        <div class="grid">
          ${g.items
            .map(
              (p) => `
            <button class="drink" data-add="${esc(p.id)}">
              <span class="icon">${iconHtml(p.icon, '🥤')}</span>
              <span class="name">${esc(p.name)}</span>
              <span class="price">${chf(p.price)}</span>
              <span class="badge" data-badge="${esc(p.id)}"></span>
            </button>`
            )
            .join('')}
        </div>
      </section>`
    )
    .join('') || '<p class="empty">Noch keine Getränke erfasst. Unter «Einstellungen» hinzufügen.</p>';
  renderBadges();
}

function renderBadges() {
  document.querySelectorAll('[data-badge]').forEach((b) => {
    const qty = S.cart.find((l) => l.id === b.dataset.badge)?.qty || 0;
    b.textContent = qty ? `${qty}×` : '';
    b.parentElement.classList.toggle('in-cart', qty > 0);
  });
}

function renderCart() {
  const lines = cartLines();
  $('#cart-lines').innerHTML = lines.length
    ? lines
        .map(
          (l) => `
      <li style="--cat:${esc(categoryById(l.product.category)?.color || '#5b6474')}">
        <span class="qty">${l.qty}×</span>
        <span class="icon">${iconHtml(l.product.icon)}</span>
        <span class="name">${esc(l.product.name)}</span>
        <span class="sum">${chf(l.product.price * l.qty)}</span>
        <button class="minus" data-minus="${esc(l.product.id)}" aria-label="Eins weniger">−</button>
      </li>`
        )
        .join('')
    : '<li class="empty">Getränke antippen, um sie zur Bestellung hinzuzufügen.</li>';
  const count = lines.reduce((n, l) => n + l.qty, 0);
  $('#cart-count').textContent = count ? `${count} ${count === 1 ? 'Getränk' : 'Getränke'}` : '';
  $('#cart-total').textContent = chf(cartTotal());
  $('#btn-checkout').disabled = !lines.length;
  $('#btn-clear').hidden = !lines.length;
  renderBadges();
}

function addToCart(id) {
  const line = S.cart.find((l) => l.id === id);
  if (line) line.qty++;
  else S.cart.push({ id, qty: 1 });
  saveCart();
  renderCart();
}
function removeFromCart(id) {
  const line = S.cart.find((l) => l.id === id);
  if (!line) return;
  line.qty--;
  if (line.qty <= 0) S.cart = S.cart.filter((l) => l !== line);
  saveCart();
  renderCart();
}

function checkout() {
  const lines = cartLines();
  if (!lines.length || S.epoch == null) return;
  const items = lines.map((l) => ({ id: l.product.id, name: l.product.name, icon: l.product.icon || '', price: l.product.price, qty: l.qty }));
  const total = items.reduce((s, i) => s + i.price * i.qty, 0);
  const orderId = store.addOrder({ epoch: S.epoch, items, total, device: deviceName() });
  S.checkout = { orderId, total, items };
  renderCheckout();
}

function renderCheckout() {
  const el = $('#checkout');
  if (!S.checkout) { el.hidden = true; return; }
  const { total, items } = S.checkout;
  $('#checkout-total').textContent = chf(total);
  $('#checkout-items').innerHTML = items
    .map((i) => `<li><span>${i.qty}× <span class="icon">${iconHtml(i.icon)}</span> ${esc(i.name)}</span><span>${chf(i.price * i.qty)}</span></li>`)
    .join('');
  el.hidden = false;
  $('#btn-new-order').focus();
}

function newOrder() {
  S.cart = [];
  saveCart();
  S.checkout = null;
  renderCheckout();
  renderCart();
}

function undoCheckout() {
  // Bestellung zurücknehmen und zum Bearbeiten zurück (zählt dann nicht mehr)
  store.deleteOrder(S.checkout.orderId);
  S.checkout = null;
  renderCheckout();
}

// ---------- Auswertung ----------
function renderReport() {
  const counts = new Map(); // id -> {qty, revenue, name, icon}
  let revenue = 0, drinks = 0;
  for (const o of S.orders) {
    for (const i of o.items || []) {
      const c = counts.get(i.id) || { qty: 0, revenue: 0, name: i.name, icon: i.icon };
      c.qty += i.qty;
      c.revenue += i.price * i.qty;
      counts.set(i.id, c);
      drinks += i.qty;
      revenue += i.price * i.qty;
    }
  }

  const rows = [];
  const seen = new Set();
  for (const g of groups()) {
    const items = g.items.map((p) => {
      seen.add(p.id);
      const c = counts.get(p.id) || { qty: 0, revenue: 0 };
      return { name: p.name, icon: p.icon, qty: c.qty, revenue: c.revenue };
    });
    if (items.length) rows.push({ cat: g.cat, items });
  }
  // Verkaufte Getränke, die inzwischen aus dem Sortiment entfernt wurden
  const removed = [...counts].filter(([id]) => !seen.has(id)).map(([, c]) => c);
  if (removed.length) rows.push({ cat: { name: 'Nicht mehr im Sortiment', color: '#5b6474' }, items: removed });

  const since = toDate(S.resetAt);
  $('#report-summary').innerHTML = `
    <div class="kpi"><span class="label">Bestellungen</span><span class="value">${S.orders.length}</span></div>
    <div class="kpi"><span class="label">Getränke</span><span class="value">${drinks}</span></div>
    <div class="kpi"><span class="label">Umsatz</span><span class="value">${chf(revenue)}</span></div>`;
  $('#report-since').textContent = since
    ? `Gezählt seit ${since.toLocaleDateString('de-CH')} ${since.toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })} · alle Kassen zusammen`
    : 'Alle Kassen zusammen';

  $('#report-table').innerHTML = rows
    .map(
      (r) => `
    <tbody style="--cat:${esc(r.cat.color)}">
      <tr class="cat-row"><th colspan="3">${esc(r.cat.name)}</th></tr>
      ${r.items
        .map(
          (i) => `
        <tr class="${i.qty ? '' : 'zero'}">
          <td class="name"><span class="icon">${iconHtml(i.icon)}</span> ${esc(i.name)}</td>
          <td class="qty">${i.qty}</td>
          <td class="rev">${chf(i.revenue)}</td>
        </tr>`
        )
        .join('')}
    </tbody>`
    )
    .join('');
}

async function resetCount() {
  const pending = S.orders.filter((o) => o.pending).length;
  const ok = await confirmDialog({
    title: 'Zählung zurücksetzen?',
    text:
      'Alle Zahlen der Auswertung werden auf allen Kassen auf 0 gesetzt. Das ist für den nächsten Anlass gedacht und kann nicht rückgängig gemacht werden.' +
      (pending ? `<br><br><strong>Achtung:</strong> Auf diesem Gerät sind noch ${pending} Bestellung(en) nicht übermittelt.` : ''),
    ok: 'Ja, auf 0 zurücksetzen',
    danger: true,
  });
  if (ok) store.resetCount();
}

// ---------- Einstellungen ----------
function renderSettings() {
  const cats = sortedCategories();
  const catOptions = (sel) =>
    cats.map((c) => `<option value="${esc(c.id)}" ${c.id === sel ? 'selected' : ''}>${esc(c.name)}</option>`).join('') +
    (cats.some((c) => c.id === sel) ? '' : '<option value="" selected>– wählen –</option>');

  $('#settings-products').innerHTML = groups()
    .map(
      (g) => `
    <div class="set-group" style="--cat:${esc(g.cat.color)}">
      <h3>${esc(g.cat.name)}</h3>
      ${g.items
        .map(
          (p, idx) => `
        <div class="set-row" data-product="${esc(p.id)}">
          <button class="icon-pick" data-icon-for="${esc(p.id)}" title="Logo oder Symbol wählen">${iconHtml(p.icon, '🥤')}</button>
          <input class="f-name" value="${esc(p.name)}" aria-label="Name" />
          <label class="f-price-wrap">CHF <input class="f-price" value="${priceInput(p.price)}" inputmode="decimal" aria-label="Preis" /></label>
          <select class="f-cat" aria-label="Kategorie">${catOptions(p.category)}</select>
          <button class="small" data-move-product="${esc(p.id)}" data-dir="-1" ${idx === 0 ? 'disabled' : ''} title="Nach vorne">▲</button>
          <button class="small" data-move-product="${esc(p.id)}" data-dir="1" ${idx === g.items.length - 1 ? 'disabled' : ''} title="Nach hinten">▼</button>
          <button class="small danger" data-delete-product="${esc(p.id)}" title="Entfernen">✕</button>
        </div>`
        )
        .join('')}
      ${g.cat.id ? `<button class="add" data-add-product="${esc(g.cat.id)}">+ Getränk in «${esc(g.cat.name)}»</button>` : ''}
    </div>`
    )
    .join('');

  $('#settings-categories').innerHTML = cats
    .map((c, idx) => {
      const used = S.products.some((p) => p.category === c.id);
      return `
      <div class="set-row" data-category="${esc(c.id)}" style="--cat:${esc(c.color)}">
        <button class="color-pick" data-color-for="${esc(c.id)}" title="Farbe wählen"></button>
        <input class="f-cname" value="${esc(c.name)}" aria-label="Kategoriename" />
        <button class="small" data-move-category="${esc(c.id)}" data-dir="-1" ${idx === 0 ? 'disabled' : ''} title="Nach vorne">▲</button>
        <button class="small" data-move-category="${esc(c.id)}" data-dir="1" ${idx === cats.length - 1 ? 'disabled' : ''} title="Nach hinten">▼</button>
        <button class="small danger" data-delete-category="${esc(c.id)}" ${used ? 'disabled title="Zuerst alle Getränke dieser Kategorie entfernen oder verschieben"' : 'title="Entfernen"'}>✕</button>
      </div>`;
    })
    .join('');
}

// Neu zeichnen, ohne dem Benutzer das gerade bearbeitete Feld wegzunehmen
let settingsDirty = false;
function maybeRenderSettings() {
  if (S.view !== 'einstellungen') { settingsDirty = true; return; }
  const active = document.activeElement;
  if (active && active.closest('#view-einstellungen') && active.matches('input, select')) {
    settingsDirty = true;
    return;
  }
  settingsDirty = false;
  renderSettings();
}

function updateProduct(id, patch) {
  const p = productById(id);
  if (p) store.saveProduct({ ...p, ...patch });
}
function updateCategory(id, patch) {
  const c = categoryById(id);
  if (c) store.saveCategory({ ...c, ...patch });
}

function move(list, id, dir, save) {
  // Reihenfolge neu durchnummerieren und nur Geändertes speichern
  const i = list.findIndex((x) => x.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  list.forEach((x, k) => { if (x.order !== k + 1) save({ ...x, order: k + 1 }); });
}

function addProduct(catId) {
  const order = Math.max(0, ...productsIn(catId).map((p) => p.order || 0)) + 1;
  const id = store.saveProduct({ name: 'Neues Getränk', price: 500, category: catId, icon: '🥤', order });
  focusAfterRender(`[data-product="${id}"] .f-name`);
}
function addCategory() {
  const order = Math.max(0, ...S.categories.map((c) => c.order || 0)) + 1;
  const color = COLOR_CHOICES[S.categories.length % COLOR_CHOICES.length];
  const id = store.saveCategory({ name: 'Neue Kategorie', color, order });
  focusAfterRender(`[data-category="${id}"] .f-cname`);
}
function focusAfterRender(sel) {
  setTimeout(() => {
    const el = $(sel);
    if (el) { el.scrollIntoView({ block: 'center' }); el.focus(); el.select(); }
  }, 150);
}

// ---------- Dialoge ----------
function confirmDialog({ title, text, ok = 'OK', danger = false }) {
  return new Promise((resolve) => {
    const dlg = $('#dialog');
    $('#dialog-title').textContent = title;
    $('#dialog-text').innerHTML = text;
    const okBtn = $('#dialog-ok');
    okBtn.textContent = ok;
    okBtn.classList.toggle('danger', danger);
    $('#dialog-cancel').hidden = false;
    $('#dialog-body').innerHTML = '';
    const close = (val) => { dlg.hidden = true; okBtn.onclick = null; $('#dialog-cancel').onclick = null; resolve(val); };
    okBtn.onclick = () => close(true);
    $('#dialog-cancel').onclick = () => close(false);
    dlg.hidden = false;
    $('#dialog-cancel').focus();
  });
}

function pickerDialog(title, choices, render, onPick) {
  const dlg = $('#dialog');
  $('#dialog-title').textContent = title;
  $('#dialog-text').textContent = '';
  $('#dialog-body').innerHTML = `<div class="picker">${choices.map((c, i) => `<button data-pick="${i}">${render(c)}</button>`).join('')}</div>`;
  $('#dialog-ok').onclick = null;
  $('#dialog-ok').hidden = true;
  $('#dialog-cancel').hidden = false;
  const close = () => { dlg.hidden = true; $('#dialog-ok').hidden = false; $('#dialog-body').innerHTML = ''; };
  $('#dialog-cancel').onclick = close;
  $('#dialog-body').onclick = (e) => {
    const b = e.target.closest('[data-pick]');
    if (!b) return;
    onPick(choices[Number(b.dataset.pick)]);
    close();
  };
  dlg.hidden = false;
}

// ---------- Ereignisse ----------
function bindEvents() {
  document.addEventListener('click', async (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    const d = t.dataset;

    if (d.view) {
      S.view = d.view;
      renderTabs();
      if (S.view === 'auswertung') renderReport();
      if (S.view === 'einstellungen') renderSettings();
      return;
    }
    if (d.add) {
      addToCart(d.add);
      t.classList.remove('pulse');
      void t.offsetWidth;
      t.classList.add('pulse');
      return;
    }
    if (d.minus) return removeFromCart(d.minus);
    if (t.id === 'btn-clear') {
      if (await confirmDialog({ title: 'Bestellung leeren?', text: 'Alle Getränke dieser Bestellung werden entfernt.', ok: 'Leeren' })) newOrder();
      return;
    }
    if (t.id === 'btn-checkout') return checkout();
    if (t.id === 'btn-new-order') return newOrder();
    if (t.id === 'btn-undo-checkout') return undoCheckout();
    if (t.id === 'btn-reset') return resetCount();
    if (t.id === 'btn-fullscreen') {
      if (document.fullscreenElement) document.exitFullscreen();
      else document.documentElement.requestFullscreen?.().catch(() => {});
      return;
    }

    // Einstellungen
    if (d.addProduct) return addProduct(d.addProduct);
    if (t.id === 'btn-add-category') return addCategory();
    if (d.moveProduct) {
      const p = productById(d.moveProduct);
      return move(productsIn(p.category), p.id, Number(d.dir), store.saveProduct);
    }
    if (d.moveCategory) return move(sortedCategories(), d.moveCategory, Number(d.dir), store.saveCategory);
    if (d.deleteProduct) {
      const p = productById(d.deleteProduct);
      if (p && (await confirmDialog({ title: 'Getränk entfernen?', text: `«${esc(p.name)}» wird auf allen Kassen entfernt. Bereits verkaufte bleiben in der Auswertung.`, ok: 'Entfernen', danger: true })))
        store.deleteProduct(p.id);
      return;
    }
    if (d.deleteCategory) {
      const c = categoryById(d.deleteCategory);
      if (c && (await confirmDialog({ title: 'Kategorie entfernen?', text: `Die leere Kategorie «${esc(c.name)}» wird entfernt.`, ok: 'Entfernen', danger: true })))
        store.deleteCategory(c.id);
      return;
    }
    if (d.iconFor) {
      const id = d.iconFor;
      const choices = [...LOGOS.map((f) => `logo:${f}`), ...ICON_CHOICES];
      return pickerDialog('Logo oder Symbol wählen', choices, (c) => iconHtml(c), (icon) => updateProduct(id, { icon }));
    }
    if (d.colorFor) {
      const id = d.colorFor;
      return pickerDialog('Farbe wählen', COLOR_CHOICES, (c) => `<span class="swatch" style="background:${c}"></span>`, (color) => updateCategory(id, { color }));
    }
  });

  // Felder speichern beim Verlassen bzw. Auswählen
  document.addEventListener('change', (e) => {
    const t = e.target;
    const row = t.closest('[data-product], [data-category]');
    if (!row) return;
    if (row.dataset.product) {
      const id = row.dataset.product;
      if (t.classList.contains('f-name')) {
        const name = t.value.trim();
        if (name) updateProduct(id, { name });
        else t.value = productById(id)?.name || '';
      } else if (t.classList.contains('f-price')) {
        const price = parsePrice(t.value);
        if (price != null) {
          updateProduct(id, { price });
          t.value = priceInput(price);
        } else {
          t.value = priceInput(productById(id)?.price || 0);
          t.classList.add('invalid');
          setTimeout(() => t.classList.remove('invalid'), 1200);
        }
      } else if (t.classList.contains('f-cat') && t.value) {
        const order = Math.max(0, ...productsIn(t.value).map((p) => p.order || 0)) + 1;
        updateProduct(id, { category: t.value, order });
      }
    } else if (t.classList.contains('f-cname')) {
      const id = row.dataset.category;
      const name = t.value.trim();
      if (name) updateCategory(id, { name });
      else t.value = categoryById(id)?.name || '';
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('#view-einstellungen input')) e.target.blur();
    if (e.key === 'Escape' && !$('#dialog').hidden) $('#dialog-cancel').click();
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (settingsDirty) maybeRenderSettings(); }, 0);
  });

  const setOnline = () => { S.online = navigator.onLine; renderStatus(); };
  window.addEventListener('online', setOnline);
  window.addEventListener('offline', setOnline);
}

// Bildschirm während des Kassierens nicht abdunkeln
async function keepAwake() {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') await navigator.wakeLock.request('screen');
  } catch { /* nicht unterstützt */ }
}

// ---------- Start ----------
async function main() {
  bindEvents();
  renderTabs();
  store = await createStore();
  document.body.dataset.mode = store.mode;
  renderStatus();
  // Nicht warten: offline kann die Erstprüfung lange dauern, die Kasse soll sofort bereit sein.
  store.init();

  const refreshCatalog = () => {
    renderMenu();
    renderCart();
    if (S.view === 'auswertung') renderReport();
    maybeRenderSettings();
  };
  store.onCategories((c) => { S.categories = c; refreshCatalog(); });
  store.onProducts((p) => { S.products = p; refreshCatalog(); });
  store.onState((st) => {
    S.resetAt = st.resetAt ?? null;
    if (st.epoch !== S.epoch) {
      S.epoch = st.epoch;
      subscribeOrders(S.epoch);
    }
    if (S.view === 'auswertung') renderReport();
  });

  // "Verbinde …" nur bis zur ersten Serververbindung anzeigen
  const timer = setInterval(() => {
    if (!S.fromCache) S.everConnected = true;
    if (S.everConnected || performance.now() > 15000) { S.everConnected = true; clearInterval(timer); renderStatus(); }
  }, 500);

  keepAwake();
  document.addEventListener('visibilitychange', keepAwake);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('Service Worker', e));
  }
}

main();
