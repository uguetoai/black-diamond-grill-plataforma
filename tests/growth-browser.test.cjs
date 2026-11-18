'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { randomBytes, pbkdf2Sync, createCipheriv } = require('node:crypto');
const { chromium } = require('playwright');
const jsQR = require('jsqr');
const { PNG } = require('pngjs');

const ROOT = path.resolve(__dirname, '..');
const ORIGIN = 'https://reviews-browser.test';
// Public identity rule, not fetched from Google. This URL is NEVER navigated.
const PLACE_ID = 'ChIJm2ou8Aj1kFQRSImFlrPXl3Q';
const REVIEW_URL = `https://search.google.com/local/writereview?placeid=${PLACE_ID}`;
const PASSWORD = 'synthetic-browser-fixture-only';
// SIMULATED approval, not a real authorization by Elimar or anyone else.
const SIMULATED_APPROVAL = {
  estado: 'aprobado', por: 'SIMULATED TEST APPROVER (not a real approval)', fecha: '2026-01-02',
};
const INVITATION_LINES = [
  'Share your experience on Google',
  'An honest review is always optional.',
  'Scan now or leave a review later, at your own pace.',
];
const ASSETS = new Map([
  ['/assets/vendor/qrcodegen.js', 'application/javascript'],
  ['/assets/reviews-growth.js', 'application/javascript'],
  ['/assets/reviews-growth-ui.js', 'application/javascript'],
  ['/assets/reviews-growth.css', 'text/css'],
  ['/img/logo.png', 'image/png'],
  ['/img/mark.png', 'image/png'],
]);
let browser;
before(async () => { browser = await chromium.launch({ headless: true }); });
after(async () => { await browser?.close(); });

function fixture({ approval, google = {} } = {}) {
  // Entirely synthetic dashboard, never read/decrypt the repository's real data.
  const data = {
    actualizado: '2026-01-02T20:00:00Z',
    dias: [{ fecha: '2026-01-02', ventas: 12, pedidos: 2, invitados: 3 }],
    items: [], google_reviews: [],
    reseñas: { google: { rating: 4, count: 3, place_id: PLACE_ID, write_review_uri: REVIEW_URL, ...google } },
    review_history: { version: 1, days: [] },
  };
  if (approval !== undefined) data.aprobaciones = { tarjeta_qr: approval };
  return data;
}

function encrypt(data) {
  // Same envelope and crypto parameters as index.html's real password login.
  const salt = randomBytes(16), iv = randomBytes(12);
  const key = pbkdf2Sync(PASSWORD, salt, 200000, 32, 'sha256');
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(JSON.stringify(data), 'utf8'), cipher.final(), cipher.getAuthTag()]);
  return { s: salt.toString('base64'), i: iv.toString('base64'), c: ciphertext.toString('base64') };
}

async function openFixture(t, data, { mobile = false } = {}) {
  const context = await browser.newContext({
    viewport: mobile ? { width: 390, height: 844 } : { width: 1280, height: 900 },
    isMobile: mobile, hasTouch: mobile, acceptDownloads: true, serviceWorkers: 'block',
  });
  const errors = [], unexpected = [], downloads = [];
  const envelope = JSON.stringify(encrypt(data));
  // Every request is intercepted. No server, API, production payload or network fallback.
  await context.route('**/*', async route => {
    const request = route.request(), url = new URL(request.url());
    if (url.origin === ORIGIN && request.method() === 'GET' && !url.search) {
      if (url.pathname === '/' || url.pathname === '/index.html') {
        return route.fulfill({ contentType: 'text/html', body: readFileSync(path.join(ROOT, 'index.html')) });
      }
      if (url.pathname === '/data.enc.json') return route.fulfill({ contentType: 'application/json', body: envelope });
      if (ASSETS.has(url.pathname)) {
        return route.fulfill({ contentType: ASSETS.get(url.pathname), body: readFileSync(path.join(ROOT, url.pathname.slice(1))) });
      }
    }
    // Public decorative requests get inert local responses, never remote content.
    if (url.origin === 'https://fonts.googleapis.com' && request.resourceType() === 'stylesheet') {
      return route.fulfill({ contentType: 'text/css', body: '' });
    }
    if (url.origin === 'https://cdn.jsdelivr.net' && request.resourceType() === 'image'
        && /^\/npm\/simple-icons@11\.0\.0\/icons\/[a-z0-9]+\.svg$/.test(url.pathname)) {
      return route.fulfill({ contentType: 'image/svg+xml', body: '<svg xmlns="http://www.w3.org/2000/svg"/>' });
    }
    unexpected.push(`${request.method()} ${request.url()}`);
    await route.abort('blockedbyclient');
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.stack || error.message));
  page.on('download', download => downloads.push(download));
  t.after(async () => {
    await context.close();
    assert.deepEqual(errors, [], 'No browser JavaScript errors');
    assert.deepEqual(unexpected, [], 'No unexpected requests or external navigations');
  });
  await page.goto(`${ORIGIN}/`);
  await page.locator('#login').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#app').isVisible(), false, 'Dashboard remains locked before login');
  assert.equal(await page.locator('#growth-module').textContent(), '');
  return { page, downloads };
}

async function login(page) {
  await page.locator('#pwd').fill(PASSWORD);
  await page.locator('#loginForm button').click();
  await page.locator('#app').waitFor({ state: 'visible' });
  await page.locator('[data-tab="resenas"]').click();
  await page.locator('#growth-card').waitFor({ state: 'visible' });
}

async function assertBlocked(page, downloads) {
  assert.equal(await page.locator('#growth-card').isDisabled(), true, 'Download must be disabled without both approval and verified link');
  // Even a synthetic click event cannot bypass the handler's guard.
  await page.locator('#growth-card').dispatchEvent('click');
  await page.waitForTimeout(100);
  assert.equal(downloads.length, 0, 'Blocked card must not generate any download');
}

test('browser: no approval blocks the printable card in ES and EN', async t => {
  const { page, downloads } = await openFixture(t, fixture());
  await login(page);
  assert.match(await page.locator('#growth-module').textContent(), /Lo hace el sistema solo/);
  assert.match(await page.locator('#growth-module').textContent(), /Solo necesita tu OK/);
  assert.match(await page.locator('#growth-qr-status').textContent(), /Borrador hasta tu aprobación/);
  assert.equal(await page.locator('#growth-qr svg').count(), 1, 'Verified QR alone is not approval');
  assert.equal(await page.locator('#growth-module input, #growth-module form, #growth-module textarea').count(), 0, 'No manual task or approval forms');
  await assertBlocked(page, downloads);
  await page.locator('#lang').click();
  assert.match(await page.locator('#growth-approval').textContent(), /reply «I approve»/);
  assert.match(await page.locator('#growth-qr-status').textContent(), /Draft until approved/);
  await assertBlocked(page, downloads);
});

test('browser: simulated approval downloads the final SVG with neutral text and decodable correct QR', async t => {
  const { page, downloads } = await openFixture(t, fixture({ approval: SIMULATED_APPROVAL }), { mobile: true });
  await login(page);
  assert.match(await page.locator('#growth-approval').textContent(), /SIMULATED TEST APPROVER/);
  assert.match(await page.locator('#growth-approval').textContent(), /2026-01-02/);
  assert.equal(await page.locator('#growth-card').isEnabled(), true);
  assert.equal(await page.locator('#growth-qr-status').textContent(), 'Lista para imprimir.');
  await page.locator('#lang').click();
  assert.equal(await page.locator('#growth-qr-status').textContent(), 'Ready to print.');
  assert.equal(await page.locator('#growth-card').isEnabled(), true);
  const waiting = page.waitForEvent('download');
  await page.locator('#growth-card').click();
  const download = await waiting;
  assert.equal(download.suggestedFilename(), 'black-diamond-grill-google-review-card.svg');
  assert.equal(await download.failure(), null);
  const svg = readFileSync(await download.path(), 'utf8');
  assert.doesNotMatch(svg, /DRAFT/i, 'Approved download has no draft watermark');
  const lines = await page.evaluate(source => {
    const doc = new DOMParser().parseFromString(source, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('Downloaded SVG is invalid XML');
    return [...doc.querySelectorAll('text')].map(node => node.textContent);
  }, svg);
  assert.deepEqual(lines, ['Black Diamond Grill', ...INVITATION_LINES], 'Exact neutral invitation distributed over SVG text lines');
  // Render the actual downloaded artifact, not a separately regenerated QR.
  const image = await page.evaluate(async source => {
    const img = new Image();
    img.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(source)))}`;
    await img.decode();
    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 760;
    canvas.getContext('2d').drawImage(img, 0, 0, 600, 760);
    return canvas.toDataURL('image/png').split(',')[1];
  }, svg);
  const png = PNG.sync.read(Buffer.from(image, 'base64'));
  const decoded = jsQR(new Uint8ClampedArray(png.data), png.width, png.height);
  assert.ok(decoded, 'QR from downloaded SVG is readable');
  assert.equal(decoded.data, REVIEW_URL, 'QR targets exactly the public restaurant Place ID');
  assert.equal(downloads.length, 1);
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'Approved mobile UI fits viewport');
  await page.locator('#salir').click();
  await page.locator('#login').waitFor({ state: 'visible' });
  assert.equal(await page.locator('#app').isVisible(), false);
  assert.equal(await page.locator('#growth-module').textContent(), '');
  assert.deepEqual(await page.evaluate(() => Object.keys(sessionStorage)), [], 'Logout removes credentials and session approval state');
});

for (const [name, options] of [
  ['pending approval', { approval: { ...SIMULATED_APPROVAL, estado: 'pendiente' } }],
  ['approval without approver', { approval: { estado: 'aprobado', fecha: '2026-01-02' } }],
  ['approval without date', { approval: { estado: 'aprobado', por: 'SIMULATED TEST' } }],
  ['approved but wrong restaurant identity', { approval: SIMULATED_APPROVAL, google: { place_id: 'synthetic-other-place' } }],
  ['approved but missing review link', { approval: SIMULATED_APPROVAL, google: { write_review_uri: null } }],
  ['approved but unsafe review link', { approval: SIMULATED_APPROVAL, google: { write_review_uri: 'http://search.google.com/local/writereview?placeid=synthetic' } }],
]) {
  test(`browser: ${name} keeps download blocked`, async t => {
    const { page, downloads } = await openFixture(t, fixture(options));
    await login(page);
    await assertBlocked(page, downloads);
    if (options.google) {
      assert.equal(await page.locator('#growth-qr svg').count(), 0);
      assert.equal(await page.locator('#growth-qr-status').textContent(), 'Sin enlace verificado todavía.');
    }
  });
}

test('browser: wrong password cannot expose simulated approval or download', async t => {
  const { page, downloads } = await openFixture(t, fixture({ approval: SIMULATED_APPROVAL }));
  await page.locator('#pwd').fill('deliberately-wrong-synthetic-password');
  await page.locator('#loginForm button').click();
  await page.waitForFunction(() => document.getElementById('err').textContent === 'Contraseña incorrecta');
  assert.equal(await page.locator('#app').isVisible(), false);
  assert.equal(await page.locator('#growth-module').textContent(), '');
  assert.equal(await page.locator('#growth-card').count(), 0);
  assert.equal(await page.evaluate(() => sessionStorage.getItem('bdg-ok')), null);
  assert.equal(downloads.length, 0);
});
