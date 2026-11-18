import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {priorHistory} from '../scripts/review-history.mjs';
function encrypted(data,password='fixture-only'){
 const s=crypto.randomBytes(16),i=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',crypto.pbkdf2Sync(password,s,200000,32,'sha256'),i);
 return JSON.stringify({s:s.toString('base64'),i:i.toString('base64'),c:Buffer.concat([c.update(JSON.stringify(data)),c.final(),c.getAuthTag()]).toString('base64')});
}
test('real updater retains encrypted daily history across repeated runs; agent envelope matches; bad key blocks overwrite',()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'bdg-updater-fixture-'));try{
 for(const sub of ['scripts','assets','data'])fs.mkdirSync(path.join(dir,sub));
 for(const file of ['scripts/update.mjs','scripts/fuentes.mjs','scripts/review-history.mjs','assets/reviews-growth.js'])fs.copyFileSync(file,path.join(dir,file));
 fs.writeFileSync(path.join(dir,'data/fuentes.enc.json'),encrypted({'data/reportes/ventas_diarias.csv':'fecha,ventas_netas,pedidos,invitados\n2026-11-18,0,0,0','data/reportes/top15_articulos.csv':'rank,articulo,cantidad_vendida,ventas_netas\n','data/control.json':'[]','data/arquitectura.json':'{}'}));
 fs.writeFileSync(path.join(dir,'data.enc.json'),encrypted({review_history:{version:1,days:[{date:'2026-11-11',google:{rating:4,count:5},yelp:{rating:null,count:null}}]}}));
 // Only synthetic API responses. All actual network requests are replaced before importing updater.
 fs.writeFileSync(path.join(dir,'fixture-network.mjs'),`const RealDate=Date;globalThis.Date=class extends RealDate{constructor(...a){super(...(a.length?a:['2026-11-18T20:00:00Z']));}static now(){return +new RealDate('2026-11-18T20:00:00Z');}};globalThis.fetch=async function(url,options){let body;if(String(url).endsWith('places:searchText'))body={places:[{id:'ChIJm2ou8Aj1kFQRSImFlrPXl3Q',rating:4,count:999,userRatingCount:Number(process.env.FIXTURE_COUNT)}]};else if(String(url).includes('places.googleapis.com/v1/places/ChIJm2ou8Aj1kFQRSImFlrPXl3Q'))body={reviews:[]};else if(String(url).startsWith('https://api.yelp.com/'))body={rating:4,review_count:0};else throw new Error('Fixture blocks all unexpected network');return {json:async()=>body};};`);
 const run=(count,password='fixture-only')=>spawnSync(process.execPath,['--import','./fixture-network.mjs','scripts/update.mjs'],{cwd:dir,encoding:'utf8',env:{PATH:process.env.PATH,BDG_PLATAFORMA_PASSWORD:password,BDG_AGENT_KEY:'fixture-agent-only',FIXTURE_COUNT:String(count)}});
 let r=run(11);assert.equal(r.status,0,r.stderr);let raw=fs.readFileSync(path.join(dir,'data.enc.json'),'utf8');assert.deepEqual(Object.keys(JSON.parse(raw)).sort(),['c','i','s']);let h=priorHistory(raw,'fixture-only');assert.equal(h.days.length,2);assert.equal(h.days.at(-1).google.count,11);assert.equal(h.days.at(-1).yelp.count,0);
 r=run(12);assert.equal(r.status,0,r.stderr);raw=fs.readFileSync(path.join(dir,'data.enc.json'),'utf8');h=priorHistory(raw,'fixture-only');assert.equal(h.days.length,2);assert.equal(h.days[0].google.count,5);assert.equal(h.days.at(-1).google.count,12);assert.deepEqual(priorHistory(fs.readFileSync(path.join(dir,'data.agent.enc.json'),'utf8'),'fixture-agent-only'),h);
 r=run(15,'wrong-fixture-key');assert.notEqual(r.status,0);assert.match(r.stderr,/refusing to overwrite/);assert.equal(fs.readFileSync(path.join(dir,'data.enc.json'),'utf8'),raw);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
