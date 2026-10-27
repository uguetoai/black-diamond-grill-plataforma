// Fuentes privadas (ventas, control, arquitectura) cifradas en data/fuentes.enc.json.
// Editar: BDG_PLATAFORMA_PASSWORD=... node scripts/fuentes.mjs abrir → cambiar archivos → node scripts/fuentes.mjs cerrar
// Los archivos abiertos están en .gitignore: nunca se suben en claro.
import crypto from 'node:crypto';
import fs from 'node:fs';
const ENC = 'data/fuentes.enc.json';
const FILES = ['data/reportes/ventas_diarias.csv', 'data/reportes/top15_articulos.csv', 'data/control.json', 'data/arquitectura.json'];
const key = s => { const p = process.env.BDG_PLATAFORMA_PASSWORD; if (!p) throw new Error('falta BDG_PLATAFORMA_PASSWORD'); return crypto.pbkdf2Sync(p, s, 200000, 32, 'sha256'); };
export function abrirFuentes() {
  const j = JSON.parse(fs.readFileSync(ENC, 'utf8')), b = Buffer.from(j.c, 'base64');
  const d = crypto.createDecipheriv('aes-256-gcm', key(Buffer.from(j.s, 'base64')), Buffer.from(j.i, 'base64'));
  d.setAuthTag(b.subarray(b.length - 16));
  return JSON.parse(Buffer.concat([d.update(b.subarray(0, b.length - 16)), d.final()]).toString());
}
function cerrar() {
  const o = Object.fromEntries(FILES.map(f => [f, fs.readFileSync(f, 'utf8')]));
  const s = crypto.randomBytes(16), i = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key(s), i);
  const ct = Buffer.concat([c.update(JSON.stringify(o)), c.final()]);
  fs.writeFileSync(ENC, JSON.stringify({ s: s.toString('base64'), i: i.toString('base64'), c: Buffer.concat([ct, c.getAuthTag()]).toString('base64') }));
  console.log('cifrado:', ENC);
}
function abrir() {
  for (const [f, t] of Object.entries(abrirFuentes())) { fs.mkdirSync(f.slice(0, f.lastIndexOf('/')), { recursive: true }); fs.writeFileSync(f, t); }
  console.log('archivos abiertos en data/ (no se suben a GitHub)');
}
if (process.argv[1]?.endsWith('fuentes.mjs')) { if (process.argv[2] === 'cerrar') cerrar(); else if (process.argv[2] === 'abrir') abrir(); else console.log('uso: node scripts/fuentes.mjs abrir|cerrar'); }
