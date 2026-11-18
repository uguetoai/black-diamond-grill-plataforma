const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function api(){const c={URL};vm.createContext(c);vm.runInContext(fs.readFileSync('assets/reviews-growth.js','utf8'),c);return c.ReviewsGrowth;}
test('a failed API read later the same day keeps the good observation of that day',()=>{
 const g=api();
 let h=g.snapshot(null,{google:{count:371,rating:4.6},yelp:{count:151,rating:4.1}},'2026-11-18T15:12:00Z');
 h=g.snapshot(h,{yelp:{count:152,rating:4.1}},'2026-11-18T23:12:00Z');
 assert.equal(h.days.length,1);
 assert.equal(h.days[0].google.count,371);assert.equal(h.days[0].google.rating,4.6);
 assert.equal(h.days[0].yelp.count,152);
 h=g.snapshot(h,{google:{count:0,rating:4.6}},'2026-11-18T23:50:00Z');
 assert.equal(h.days[0].google.count,0,'a real zero still replaces');
});
test('updater pins the verified Place ID instead of trusting the first search result',()=>{
 const s=fs.readFileSync('scripts/update.mjs','utf8');
 assert.match(s,/const PLACE_ID = 'ChIJm2ou8Aj1kFQRSImFlrPXl3Q'/);
 assert.doesNotMatch(s,/places\[0\]/);
 assert.match(s,/find\(x => x\.id === PLACE_ID\)/);
 const g=api();
 assert.ok(g.reviewURL('https://search.google.com/local/writereview?placeid=ChIJm2ou8Aj1kFQRSImFlrPXl3Q'));
});
test('a link from the encrypted source is only prefilled; the QR still needs the checkbox',()=>{
 const s=fs.readFileSync('assets/reviews-growth-ui.js','utf8');
 assert.doesNotMatch(s,/source='payload'/);
});
