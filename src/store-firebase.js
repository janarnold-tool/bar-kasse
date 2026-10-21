import { initializeApp } from 'firebase/app';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager, connectFirestoreEmulator,
  collection, doc, onSnapshot, query, where, setDoc, deleteDoc, writeBatch, getDocFromServer,
  serverTimestamp, increment,
} from 'firebase/firestore';
import { DEFAULT_CATEGORIES, DEFAULT_PRODUCTS } from './defaults.js';

// Gemeinsame Daten via Cloud Firestore. Der lokale Cache (IndexedDB) sorgt dafür,
// dass offline weiterkassiert werden kann; ausstehende Schreibvorgänge werden
// automatisch nachgesendet, auch nach einem Neuladen der Seite.
export function createFirebaseStore(config) {
  const app = initializeApp(config);
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  if (config.emulatorHost) {
    const [host, port] = config.emulatorHost.split(':');
    connectFirestoreEmulator(db, host, Number(port));
  }
  const stateRef = doc(db, 'state', 'current');

  const strip = ({ id, ...rest }) => rest;
  const list = (snap) => snap.docs.map((d) => ({ id: d.id, ...d.data() }));

  return {
    mode: 'firebase',

    async init() {
      // Beim allerersten Start (leere Datenbank) das Standardsortiment anlegen.
      try {
        const state = await getDocFromServer(stateRef);
        if (!state.exists()) {
          const batch = writeBatch(db);
          DEFAULT_CATEGORIES.forEach((c) => batch.set(doc(db, 'categories', c.id), strip(c)));
          DEFAULT_PRODUCTS.forEach((p) => batch.set(doc(db, 'products', p.id), strip(p)));
          batch.set(stateRef, { epoch: 1, resetAt: serverTimestamp() });
          await batch.commit();
        }
      } catch (e) {
        // Offline beim Start: mit dem lokalen Cache weiterarbeiten.
        console.warn('Erstprüfung übersprungen', e);
      }
    },

    onCategories(cb) {
      return onSnapshot(collection(db, 'categories'), (s) => cb(list(s)));
    },
    onProducts(cb) {
      return onSnapshot(collection(db, 'products'), (s) => cb(list(s)));
    },
    onState(cb) {
      return onSnapshot(stateRef, (s) => cb(s.exists() ? s.data() : { epoch: 1 }));
    },
    onOrders(epoch, cb) {
      const q = query(collection(db, 'orders'), where('epoch', '==', epoch));
      return onSnapshot(q, { includeMetadataChanges: true }, (s) => {
        const orders = s.docs.map((d) => ({ id: d.id, pending: d.metadata.hasPendingWrites, ...d.data() }));
        cb(orders, { fromCache: s.metadata.fromCache });
      });
    },

    // Nicht auf den Server warten: offline bleibt der Schreibvorgang in der Warteschlange.
    addOrder(order) {
      const ref = doc(collection(db, 'orders'));
      setDoc(ref, { ...order, createdAt: serverTimestamp() }).catch(console.error);
      return ref.id;
    },
    deleteOrder(id) {
      deleteDoc(doc(db, 'orders', id)).catch(console.error);
    },
    saveProduct(p) {
      const ref = p.id ? doc(db, 'products', p.id) : doc(collection(db, 'products'));
      setDoc(ref, strip(p)).catch(console.error);
      return ref.id;
    },
    deleteProduct(id) {
      deleteDoc(doc(db, 'products', id)).catch(console.error);
    },
    saveCategory(c) {
      const ref = c.id ? doc(db, 'categories', c.id) : doc(collection(db, 'categories'));
      setDoc(ref, strip(c)).catch(console.error);
      return ref.id;
    },
    deleteCategory(id) {
      deleteDoc(doc(db, 'categories', id)).catch(console.error);
    },
    resetCount() {
      setDoc(stateRef, { epoch: increment(1), resetAt: serverTimestamp() }, { merge: true }).catch(console.error);
    },
  };
}
