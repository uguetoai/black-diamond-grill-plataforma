// Resumen semanal: últimos 7 días completos (hasta ayer, hora de Los Ángeles) contra los 7 anteriores.
// Si falta el dato de algún día, la cifra queda en null («Sin dato»); nunca se rellena.
const dia = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Los_Angeles', year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
const mover = (f, n) => { const d = new Date(f + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const rango = (hasta, n) => Array.from({ length: n }, (_, i) => mover(hasta, i - n + 1));
function sumar(mapa, fechas, completo = true) {
  let t = 0, con = 0;
  for (const f of fechas) { const v = mapa.get(f); if (typeof v === 'number' && Number.isFinite(v)) { t += v; con++; } }
  return completo && con < fechas.length ? null : Math.round(t * 100) / 100;
}
export function resumenSemanal(data, ahora = new Date()) {
  const hasta = mover(dia(ahora), -1), act = rango(hasta, 7), ant = rango(mover(hasta, -7), 7);
  const web = new Map((data.antes?.diario || []).map(([f, v]) => [f, v]));
  const ari = new Map(Object.entries(data.arianna?.diario || {}));
  const ven = new Map((data.dias || []).map(r => [r.fecha, +r.ventas_netas]));
  const ped = new Map((data.dias || []).map(r => [r.fecha, +r.pedidos]));
  const ariOk = data.arianna?.estado === 'ok';
  const hist = new Map((data.review_history?.days || []).map(r => [r.date, r]));
  const nuevas = p => { const a = hist.get(hasta)?.[p]?.count, b = hist.get(mover(hasta, -7))?.[p]?.count; return Number.isInteger(a) && Number.isInteger(b) ? a - b : null; };
  const par = (m, completo) => ({ act: sumar(m, act, completo), ant: sumar(m, ant, completo) });
  return {
    desde: act[0], hasta,
    web: par(web, true),
    arianna: ariOk ? { act: sumar(ari, act, false), ant: sumar(ari, ant, false) } : { act: null, ant: null },
    ventas: par(ven, true),
    pedidos: par(ped, true),
    resenas: { google: nuevas('google'), yelp: nuevas('yelp') },
  };
}
