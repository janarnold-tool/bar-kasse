// End-to-End-Test gegen den Firebase-Emulator: zwei "Laptops", Offline-Fall, Zurücksetzen.
// Start: test/run.sh
import { chromium } from 'playwright';
import assert from 'node:assert/strict';

const URL = process.env.APP_URL || 'http://127.0.0.1:5000/';
const SHOTS = 'test/shots';

const browser = await chromium.launch();
async function laptop(name) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 768 }, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.error(`[${name}]`, e));
  await page.goto(URL);
  await page.waitForSelector('.drink');
  return { ctx, page };
}
const tap = (page, name, n = 1) => page.locator('.drink', { hasText: name }).first().click({ clickCount: 1 }).then(async () => {
  for (let i = 1; i < n; i++) await page.locator('.drink', { hasText: name }).first().click();
});
const reportQty = (page, name) => page.locator('#report-table tr', { hasText: name }).first().locator('td.qty').innerText();
const statusText = (page) => page.locator('#status').innerText();

const A = await laptop('A');
const B = await laptop('B');
await A.page.waitForFunction(() => document.querySelector('#status').textContent.includes('Online'));
await A.page.screenshot({ path: `${SHOTS}/1-kasse-leer.png` });

// 1) Kassieren auf A
await tap(A.page, 'Spezli', 4);
await tap(A.page, 'Coca-Cola', 2);
await A.page.locator('.cart-lines li', { hasText: 'Coca-Cola' }).locator('.minus').click();
assert.equal(await A.page.locator('#cart-total').innerText(), 'CHF 27.00');
await tap(A.page, 'Aperol');
await A.page.screenshot({ path: `${SHOTS}/2-kasse-bestellung.png` });
await A.page.click('#btn-checkout');
assert.equal(await A.page.locator('#checkout-total').innerText(), 'CHF 37.00');
await A.page.screenshot({ path: `${SHOTS}/3-abrechnen.png` });
await A.page.click('#btn-new-order');
assert.equal(await A.page.locator('#cart-total').innerText(), 'CHF 0.00');
console.log('✓ Kassieren, Minus, Abrechnen, Neue Bestellung');

// 2) Auswertung auf B (anderer Laptop)
await B.page.click('[data-view=auswertung]');
await B.page.waitForFunction(() => document.querySelector('#report-summary').textContent.includes('37.00'));
assert.equal(await reportQty(B.page, 'Spezli'), '4');
assert.equal(await reportQty(B.page, 'Coca-Cola'), '1');
console.log('✓ Auswertung auf zweitem Gerät');

// 3) Nicht abgerechnete Bestellung zählt nicht; "Zurück" nimmt sie raus
await tap(A.page, 'Hugo 3dl');
await A.page.click('#btn-checkout');
await A.page.click('#btn-undo-checkout');
await A.page.waitForTimeout(800);
assert.equal(await reportQty(B.page, 'Hugo 3dl'), '0');
await A.page.click('#btn-clear');
await A.page.click('#dialog-ok');
console.log('✓ Zurück zur Bestellung zählt nicht');

// 4) Einstellung auf B -> sofort auf A
await B.page.click('[data-view=einstellungen]');
const colaRow = B.page.locator('.set-row', { has: B.page.locator('input.f-name[value^="Coca-Cola"]') });
await colaRow.locator('.f-price').fill('3,5');
await colaRow.locator('.f-price').press('Enter');
await A.page.waitForFunction(() => [...document.querySelectorAll('.drink')].some((b) => b.textContent.includes('Coca-Cola') && b.textContent.includes('CHF 3.50')));
await B.page.click('[data-add-product="c-shots"]');
await B.page.waitForTimeout(500);
await B.page.keyboard.press('Control+A');
await B.page.keyboard.type('Zwetschgen 2cl');
await B.page.keyboard.press('Enter');
await A.page.waitForSelector('.drink:has-text("Zwetschgen 2cl")');
await B.page.screenshot({ path: `${SHOTS}/5-einstellungen.png` });
console.log('✓ Preis ändern und Getränk hinzufügen gelten sofort auf anderem Gerät');

// 5) Offline auf A: weiterkassieren, neu laden, nachsenden
await A.ctx.setOffline(true);
await tap(A.page, 'Hugo 3dl', 2);
await A.page.click('#btn-checkout');
await A.page.click('#btn-new-order');
await A.page.waitForFunction(() => /Offline.*1 ausstehend/.test(document.querySelector('#status').textContent), null, { timeout: 30000 });
await A.page.screenshot({ path: `${SHOTS}/6-offline.png` });
await A.page.reload();
await A.page.waitForSelector('.drink');
await A.page.waitForFunction(() => document.querySelector('#status').textContent.includes('1 ausstehend'), null, { timeout: 30000 });
await tap(A.page, 'Gin Tonic');
await A.page.click('#btn-checkout');
await A.page.click('#btn-new-order');
await A.page.waitForFunction(() => document.querySelector('#status').textContent.includes('2 ausstehend'));
assert.equal(await reportQty(B.page, 'Hugo 3dl').catch(() => '0'), '0');
console.log('✓ Offline weiterkassiert, auch nach Neuladen:', await statusText(A.page));
await A.ctx.setOffline(false);
await A.page.waitForFunction(() => document.querySelector('#status').textContent.trim() === 'Online', null, { timeout: 60000 });
await B.page.click('[data-view=auswertung]');
await B.page.waitForFunction(() => {
  const row = [...document.querySelectorAll('#report-table tr')].find((r) => r.textContent.includes('Hugo 3dl'));
  return row && row.querySelector('td.qty').textContent === '2';
}, null, { timeout: 30000 });
assert.equal(await reportQty(B.page, 'Gin Tonic'), '1');
await B.page.screenshot({ path: `${SHOTS}/4-auswertung.png` });
console.log('✓ Nach Wiederverbindung nachgesendet');

// 6) Zurücksetzen mit Bestätigung
await B.page.click('#btn-reset');
await B.page.click('#dialog-cancel');
assert.equal(await reportQty(B.page, 'Spezli'), '4');
await B.page.click('#btn-reset');
await B.page.screenshot({ path: `${SHOTS}/7-zuruecksetzen.png` });
await B.page.click('#dialog-ok');
await A.page.click('[data-view=auswertung]');
await A.page.waitForFunction(() => document.querySelector('#report-summary').textContent.includes('CHF 0.00'));
console.log('✓ Zählung zurückgesetzt (auf allen Geräten)');

await browser.close();
console.log('ALLE TESTS OK');
