import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resumenSemanal } from '../scripts/semanal.mjs';
const dias = (desde, n, v) => Array.from({ length: n }, (_, i) => { const d = new Date(desde + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + i); return [d.toISOString().slice(0, 10), v]; });
test('suma los últimos 7 días completos contra los 7 anteriores', () => {
  const data = { antes: { diario: [...dias('2026-11-09', 7, 10), ...dias('2026-11-16', 7, 20), ['2026-11-23', 999]] }, arianna: { estado: 'ok', diario: { '2026-11-20': 3, '2026-11-12': 1 } }, dias: [] };
  const s = resumenSemanal(data, new Date('2026-11-23T18:00:00Z'));
  assert.equal(s.desde, '2026-11-16'); assert.equal(s.hasta, '2026-11-22');
  assert.deepEqual(s.web, { act: 140, ant: 70 });
  assert.deepEqual(s.arianna, { act: 3, ant: 1 });
  assert.deepEqual(s.ventas, { act: null, ant: null }, 'sin ventas → Sin dato, no 0');
});
test('un día faltante de la web deja la semana en Sin dato', () => {
  const s = resumenSemanal({ antes: { diario: dias('2026-11-16', 6, 10) } }, new Date('2026-11-23T18:00:00Z'));
  assert.equal(s.web.act, null);
});
test('reseñas nuevas solo con los dos extremos exactos', () => {
  const r = (date, c) => ({ date, google: { count: c, rating: 4.8 }, yelp: { count: null, rating: null } });
  const s = resumenSemanal({ review_history: { version: 1, days: [r('2026-11-15', 365), r('2026-11-22', 371)] } }, new Date('2026-11-23T18:00:00Z'));
  assert.equal(s.resenas.google, 6); assert.equal(s.resenas.yelp, null);
});
