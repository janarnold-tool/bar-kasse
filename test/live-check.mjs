// Prüft die Verbindung zur echten Datenbank: legt beim ersten Mal das Startsortiment an,
// schreibt eine Testbestellung, liest sie zurück und löscht sie wieder.
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, collection, getDoc, getDocs, setDoc, deleteDoc, writeBatch, serverTimestamp, terminate } from 'firebase/firestore';
import { DEFAULT_CATEGORIES, DEFAULT_PRODUCTS } from '../src/defaults.js';
import fs from 'node:fs';
import vm from 'node:vm';

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync('public/config.js', 'utf8'), ctx);
const db = getFirestore(initializeApp(ctx.window.BAR_KASSE_FIREBASE));
const strip = ({ id, ...r }) => r;

const stateRef = doc(db, 'state', 'current');
if (!(await getDoc(stateRef)).exists()) {
  const b = writeBatch(db);
  DEFAULT_CATEGORIES.forEach((c) => b.set(doc(db, 'categories', c.id), strip(c)));
  DEFAULT_PRODUCTS.forEach((p) => b.set(doc(db, 'products', p.id), strip(p)));
  b.set(stateRef, { epoch: 1, resetAt: serverTimestamp() });
  await b.commit();
  console.log('Startsortiment angelegt');
}
const state = (await getDoc(stateRef)).data();
console.log('epoch', state.epoch, '| Getränke', (await getDocs(collection(db, 'products'))).size, '| Kategorien', (await getDocs(collection(db, 'categories'))).size);

const ref = doc(collection(db, 'orders'));
await setDoc(ref, { epoch: -1, items: [{ id: 'p-cola', name: 'Coca-Cola 3dl', icon: '🥤', price: 300, qty: 1 }], total: 300, device: 'Verbindungstest', createdAt: serverTimestamp() });
console.log('Testbestellung geschrieben, gelesen:', (await getDoc(ref)).exists());
await deleteDoc(ref);
console.log('Testbestellung gelöscht:', !(await getDoc(ref)).exists());
await terminate(db);
