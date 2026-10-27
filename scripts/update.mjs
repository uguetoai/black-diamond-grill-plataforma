import crypto from 'node:crypto';
import fs from 'node:fs';
import { abrirFuentes } from './fuentes.mjs';
const env = process.env;
const enc = o => Buffer.from(JSON.stringify(o)).toString('base64url');

async function google() {
  const h = { 'Content-Type': 'application/json', 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY };
  const s = await (await fetch('https://places.googleapis.com/v1/places:searchText', { method: 'POST', headers: { ...h, 'X-Goog-FieldMask': 'places.id,places.rating,places.userRatingCount' }, body: JSON.stringify({ textQuery: 'Black Diamond Grill Black Diamond WA' }) })).json();
  const p = s.places[0];
  const d = await (await fetch(`https://places.googleapis.com/v1/places/${p.id}?languageCode=en`, { headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': 'reviews' } })).json();
  return { rating: p.rating, count: p.userRatingCount, reviews: (d.reviews || []).map(r => ({ rating: r.rating, when: r.relativePublishTimeDescription, text: r.text?.text || '', author: r.authorAttribution?.displayName || '' })) };
}
async function yelp() {
  const r = await (await fetch('https://api.yelp.com/v3/businesses/black-diamond-grill-black-diamond', { headers: { Authorization: 'Bearer ' + env.YELP_API_KEY } })).json();
  return { rating: r.rating, count: r.review_count };
}
async function gaToken() {
  const k = JSON.parse(env.GA_SERVICE_ACCOUNT_JSON); const now = Math.floor(Date.now() / 1000);
  const u = enc({ alg: 'RS256', typ: 'JWT' }) + '.' + enc({ iss: k.client_email, scope: 'https://www.googleapis.com/auth/analytics.readonly', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 });
  const s = crypto.sign('RSA-SHA256', Buffer.from(u), k.private_key).toString('base64url');
  const r = await (await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=' + u + '.' + s })).json();
  return r.access_token;
}
async function ga(body) {
  const t = await gaToken();
  return (await fetch('https://analyticsdata.googleapis.com/v1beta/properties/560126954:runReport', { method: 'POST', headers: { Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' }, body: JSON.stringify(body) })).json();
}
async function borrador(texto, estrellas) {
  const r = await (await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' }, body: JSON.stringify({ model: 'claude-haiku-5-5', max_tokens: 300, system: 'Escribes la respuesta del dueño, Rudy Carrillo, a una reseña de Black Diamond Grill (restaurante italiano-americano en Black Diamond, WA). Responde en el mismo idioma de la reseña, en 2 o 3 frases, cálido y sin prometer descuentos ni regalos. Si hay una queja, agradece el aviso y pide que llamen al (360) 886-5662. No inventes datos.', messages: [{ role: 'user', content: `Reseña de ${estrellas} estrellas:\n${texto}` }] }) })).json();
  return r.content?.[0]?.text || '';
}
async function redes() {
  const out = { cuentas: [], posts: [] };
  if (env.META_PAGE_TOKEN) {
    const f = 'name,followers_count,fan_count,instagram_business_account{username,followers_count,media_count,media.limit(6){caption,like_count,comments_count,timestamp,permalink}}';
    const r = await (await fetch(`https://graph.facebook.com/v26.0/me?fields=${encodeURIComponent(f)}&access_token=${env.META_PAGE_TOKEN}`)).json();
    if (r.error) throw new Error(r.error.message);
    out.cuentas.push({ red: 'Facebook', cuenta: r.name, estado: 'ok', seguidores: r.followers_count ?? r.fan_count ?? null });
    const ig = r.instagram_business_account;
    if (ig) {
      out.cuentas.push({ red: 'Instagram', cuenta: '@' + ig.username, estado: 'ok', seguidores: ig.followers_count, publicaciones: ig.media_count });
      out.posts = (ig.media?.data || []).map(m => ({ fecha: m.timestamp, likes: m.like_count ?? 0, comentarios: m.comments_count ?? 0, texto: m.caption || '', permalink: m.permalink }));
    } else out.cuentas.push({ red: 'Instagram', cuenta: '@blackdgrill', estado: 'sin_acceso', falta: 'vincular Instagram Business a la página', falta_en: 'link Instagram Business to the page' });
  } else out.cuentas.push({ red: 'Instagram', cuenta: '@blackdgrill', estado: 'sin_acceso', falta: 'META_PAGE_TOKEN', falta_en: 'META_PAGE_TOKEN' }, { red: 'Facebook', cuenta: 'Black Diamond Grill', estado: 'sin_acceso', falta: 'META_PAGE_TOKEN', falta_en: 'META_PAGE_TOKEN' });
  out.cuentas.push({ red: 'TikTok', cuenta: '—', estado: 'pendiente', falta: 'app de TikTok y autorización de Rudy', falta_en: "TikTok app and Rudy's authorization" });
  return out;
}
const range = [{ startDate: '30daysAgo', endDate: 'today' }];
async function antes() {
  const out = { usuarios: 0, vistas: 0, order_pickup: 0, call_restaurant: 0, acciones: [], canales: [] };
  const t = await ga({ dateRanges: range, metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }] });
  if (t.rows) { out.usuarios = +t.rows[0].metricValues[0].value; out.vistas = +t.rows[0].metricValues[1].value; }
  const e = await ga({ dateRanges: range, dimensions: [{ name: 'eventName' }], metrics: [{ name: 'eventCount' }] });
  const names = { get_directions: 'Cómo llegar', reviews_google: 'Ver reseñas en Google', reviews_yelp: 'Ver reseñas en Yelp', gift_card: 'Gift cards', order_pickup: 'Pedido para recoger', call_restaurant: 'Llamadas' };
  for (const r of e.rows || []) { const n = r.dimensionValues[0].value, c = +r.metricValues[0].value; if (n === 'order_pickup') out.order_pickup = c; if (n === 'call_restaurant') out.call_restaurant = c; if (names[n] && n !== 'order_pickup' && n !== 'call_restaurant') out.acciones.push([names[n], c]); }
  const c = await ga({ dateRanges: range, dimensions: [{ name: 'sessionDefaultChannelGroup' }], metrics: [{ name: 'activeUsers' }] });
  out.canales = (c.rows || []).map(r => [r.dimensionValues[0].value, +r.metricValues[0].value]);
  return out;
}
const F = abrirFuentes();
const csv = f => { const [h, ...l] = F[f].trim().split('\n'); const k = h.split(','); return l.map(x => { const v = x.match(/("([^"]*)"|[^,]+|(?<=,)(?=,|$))/g) || []; return Object.fromEntries(k.map((n, i) => [n, (v[i] || '').replace(/^"|"$/g, '')])); }); };
const v = csv('data/reportes/ventas_diarias.csv'), t15 = csv('data/reportes/top15_articulos.csv');
const data = {
  dias: v.map(r => ({ fecha: r.fecha, ventas: +r.ventas_netas, pedidos: +r.pedidos, invitados: +r.invitados })),
  items: t15.map(r => ({ rank: +r.rank, articulo: r.articulo, cantidad: +r.cantidad_vendida, ventas: +r.ventas_netas })),
  reseñas: {}, antes: {}, google_reviews: [], control: JSON.parse(F['data/control.json']), arquitectura: JSON.parse(F['data/arquitectura.json']),
};
try { const g = await google(); data.reseñas.google = { rating: g.rating, count: g.count }; data.google_reviews = g.reviews; } catch (e) { console.log('google error', e.message); }
const TEMAS = { comida: /comida|food|dish|delicious|flavor|sabor|rica/i, servicio: /servicio|service|staff|waiter|waitress|server|atenci/i, espera: /espera|wait|slow|tard/i, precio: /precio|price|expensive|caro|valor|value/i, ambiente: /ambiente|ambience|atmosphere|music|decor|cozy|acogedor/i, postres: /dessert|postre|cheesecake|tiramisu/i, pasta: /pasta|ravioli|spaghetti|fettuccine|linguini/i, carne: /steak|sirloin|ribeye|filet|carne|chop/i };
const reseñasG = data.google_reviews;
data.resumen = Object.entries(TEMAS).map(([tema, re]) => [tema, reseñasG.filter(r => re.test(r.text)).length]);
data.alertas = reseñasG.filter(r => r.rating <= 2).length;
data.borradores = [];
if (env.ANTHROPIC_API_KEY) for (const r of reseñasG.filter(r => r.text).slice(0, 8)) { try { data.borradores.push({ autor: r.author, estrellas: r.rating, cuando: r.when, texto: r.text, borrador: await borrador(r.text, r.rating) }); } catch (e) { console.log('borrador error', e.message); } }
try { data.reseñas.yelp = await yelp(); } catch (e) { console.log('yelp error', e.message); }
try { data.antes = await antes(); } catch (e) { console.log('analytics error', e.message); }
try { data.redes = await redes(); } catch (e) { console.log('redes error', e.message); }
data.actualizado = new Date().toISOString();
const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
const cip = crypto.createCipheriv('aes-256-gcm', crypto.pbkdf2Sync(env.BDG_PLATAFORMA_PASSWORD, salt, 200000, 32, 'sha256'), iv);
const ct = Buffer.concat([cip.update(JSON.stringify(data)), cip.final()]), tag = cip.getAuthTag();
fs.writeFileSync('data.enc.json', JSON.stringify({ s: salt.toString('base64'), i: iv.toString('base64'), c: Buffer.concat([ct, tag]).toString('base64') }));
console.log('ok: dias', data.dias.length, 'google', data.reseñas.google?.count, 'yelp', data.reseñas.yelp?.count, 'antes usuarios', data.antes.usuarios);
