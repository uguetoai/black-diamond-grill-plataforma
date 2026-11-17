// Lectura de la plataforma para agentes (Arianna). Solo lectura.
// Uso: BDG_AGENT_KEY=... node leer-agente.mjs            → imprime todo el JSON
//      BDG_AGENT_KEY=... node leer-agente.mjs dias       → solo una sección (dias, reseñas, antes, arianna, redes)
import crypto from 'node:crypto';
const URL = 'https://uguetoai.github.io/black-diamond-grill-plataforma/data.agent.enc.json';
const clave = process.env.BDG_AGENT_KEY;
if (!clave) { console.error('Falta BDG_AGENT_KEY'); process.exit(1); }
const e = await (await fetch(URL, { cache: 'no-store' })).json();
const b = x => Buffer.from(x, 'base64'), c = b(e.c);
const d = crypto.createDecipheriv('aes-256-gcm', crypto.pbkdf2Sync(clave, b(e.s), 200000, 32, 'sha256'), b(e.i));
d.setAuthTag(c.subarray(-16));
const data = JSON.parse(Buffer.concat([d.update(c.subarray(0, -16)), d.final()]).toString());
const sec = process.argv[2];
console.log(JSON.stringify(sec ? data[sec] : data, null, 2));
