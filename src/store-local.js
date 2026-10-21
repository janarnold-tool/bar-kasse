import { DEFAULT_CATEGORIES, DEFAULT_PRODUCTS } from './defaults.js';

// Testmodus ohne Server: alles im Browser dieses Geräts (localStorage).
// Mehrere Tabs im selben Browser bleiben über BroadcastChannel synchron.
const KEY = 'bar-kasse-local-v1';

export function createLocalStore() {
  const channel = 'BroadcastChannel' in window ? new BroadcastChannel(KEY) : null;
  const listeners = new Set();
  let data;

  const load = () => {
    try { data = JSON.parse(localStorage.getItem(KEY)); } catch { data = null; }
    if (!data) {
      data = { categories: DEFAULT_CATEGORIES, products: DEFAULT_PRODUCTS, orders: [], state: { epoch: 1 } };
      persist();
    }
  };
  const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* nur im Speicher */ } };
  const emit = () => listeners.forEach((fn) => fn());
  const commit = () => { persist(); emit(); channel?.postMessage('changed'); };
  const watch = (fn) => { listeners.add(fn); fn(); return () => listeners.delete(fn); };
  const newId = () => Math.random().toString(36).slice(2, 12);
  const upsert = (key, item) => {
    const id = item.id || newId();
    data[key] = data[key].filter((x) => x.id !== id).concat({ ...item, id });
    commit();
    return id;
  };
  const remove = (key, id) => { data[key] = data[key].filter((x) => x.id !== id); commit(); };

  if (channel) channel.onmessage = () => { load(); emit(); };
  window.addEventListener('storage', (e) => { if (e.key === KEY) { load(); emit(); } });

  return {
    mode: 'local',
    async init() { load(); },
    onCategories: (cb) => watch(() => cb(structuredClone(data.categories))),
    onProducts: (cb) => watch(() => cb(structuredClone(data.products))),
    onState: (cb) => watch(() => cb({ ...data.state })),
    onOrders: (epoch, cb) => watch(() => cb(data.orders.filter((o) => o.epoch === epoch), { fromCache: false })),
    addOrder: (order) => upsert('orders', { ...order, createdAt: Date.now() }),
    deleteOrder: (id) => remove('orders', id),
    saveProduct: (p) => upsert('products', p),
    deleteProduct: (id) => remove('products', id),
    saveCategory: (c) => upsert('categories', c),
    deleteCategory: (id) => remove('categories', id),
    resetCount() { data.state = { epoch: data.state.epoch + 1, resetAt: Date.now() }; commit(); },
  };
}
