import {test} from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {readFileSync,existsSync} from 'node:fs';
function fixture(data,password='fixture-only'){const salt=crypto.randomBytes(16),iv=crypto.randomBytes(12),key=crypto.pbkdf2Sync(password,salt,200000,32,'sha256'),c=crypto.createCipheriv('aes-256-gcm',key,iv);const ct=Buffer.concat([c.update(JSON.stringify(data)),c.final(),c.getAuthTag()]);return JSON.stringify({s:salt.toString('base64'),i:iv.toString('base64'),c:ct.toString('base64')});}
test('previous encrypted payload retains history; old schema works; corrupt envelope fails closed',async()=>{
 assert.ok(existsSync('scripts/review-history.mjs'),'encrypted history adapter exists');const {priorHistory,withSnapshot}=await import('../scripts/review-history.mjs');
 const raw=fixture({review_history:{version:1,days:[{date:'2026-10-01',google:{count:4,rating:4}}]}});
 const h=priorHistory(raw,'fixture-only');const d={actualizado:'2026-10-08T20:00:00Z',reseñas:{google:{count:0,rating:4}}};withSnapshot(d,h);assert.equal(d.review_history.days.length,2);assert.equal(d.review_history.days.at(-1).google.count,0);
 assert.equal(priorHistory(fixture({}),'fixture-only').days.length,0);assert.throws(()=>priorHistory(fixture({review_history:{version:99,days:[]}}),'fixture-only'));assert.throws(()=>priorHistory(fixture({review_history:{version:1,days:'bad'}}),'fixture-only'));assert.throws(()=>priorHistory(raw,'wrong'));assert.throws(()=>priorHistory('{bad','fixture-only'));assert.throws(()=>priorHistory(JSON.stringify({s:'a',i:'b',c:'c'}),'fixture-only'));
 const updater=readFileSync('scripts/update.mjs','utf8');assert.match(updater,/priorHistory/);assert.match(updater,/withSnapshot/);assert.match(updater,/place_id: g.id/);
 assert.match(updater,/places.id,places.rating,places.userRatingCount'/);assert.doesNotMatch(updater,/places.googleMapsLinks/);
});
