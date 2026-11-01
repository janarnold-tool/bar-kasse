// Ersetzt in der echten Datenbank die alten Emoji-Symbole des Startsortiments durch die Logos.
// Getränke, deren Symbol inzwischen von Hand geändert wurde, bleiben unberührt.
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc, terminate } from 'firebase/firestore';
import { DEFAULT_PRODUCTS } from '../src/defaults.js';
import fs from 'node:fs';
import vm from 'node:vm';

const OLD = { 'p-cola': '🥤', 'p-mate': '🧉', 'p-wasser-laut': '🫧', 'p-wasser-still': '💧', 'p-rivella': '🧃', 'p-spezli': '🍺', 'p-weisswein': '🥂',
  'p-appenzeller-rocks': '🥃', 'p-gin-tonic': '🍸', 'p-aperol': '🍹', 'p-lillet': '🍓', 'p-hugo': '🌿', 'p-turbo-tony': '⚡', 'p-hugo-af': '🍃',
  'p-virgin-sunrise': '🌅', 'p-bluesblaster': '🎷', 'p-appenzeller-shot': '🌱', 'p-shotbrettli': '🔟' };

const ctx = { window: {} };
vm.runInNewContext(fs.readFileSync('public/config.js', 'utf8'), ctx);
const db = getFirestore(initializeApp(ctx.window.BAR_KASSE_FIREBASE));
for (const p of DEFAULT_PRODUCTS) {
  const ref = doc(db, 'products', p.id);
  const snap = await getDoc(ref);
  if (!snap.exists()) { console.log('fehlt (entfernt):', p.id); continue; }
  const cur = snap.data().icon;
  if (cur === p.icon) continue;
  if (cur !== OLD[p.id]) { console.log('von Hand geändert, bleibt:', p.id, cur); continue; }
  await updateDoc(ref, { icon: p.icon });
  console.log('gesetzt:', p.id, p.icon);
}
await terminate(db);
