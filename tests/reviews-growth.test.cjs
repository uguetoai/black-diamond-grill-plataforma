const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
function api(){const c={URL}; vm.createContext(c); const p='assets/reviews-growth.js'; assert.ok(fs.existsSync(p),'growth module exists');vm.runInContext(fs.readFileSync(p,'utf8'),c);return c.ReviewsGrowth;}
test('daily history uses LA civil dates across DST, latest per day, and exact coverage only',()=>{
 const g=api(); assert.equal(g.dayLA('2026-11-01T07:30:00Z'),'2026-11-01');assert.equal(g.dayLA('2026-11-01T09:30:00Z'),'2026-11-01');assert.equal(g.dayLA('2026-03-08T07:30:00Z'),'2026-03-07');
 let h=g.snapshot(null,{'google':{count:10,rating:4}},'2026-10-25T19:00:00Z');
 h=g.snapshot(h,{'google':{count:8,rating:4.1}},'2026-11-01T19:00:00Z');
 assert.equal(g.delta(h,'google',7),-2);assert.equal(g.delta(h,'google',30),null);
 h=g.snapshot(h,{'google':{count:9,rating:4.1}},'2026-11-01T20:00:00Z');assert.equal(h.days.length,2);assert.equal(g.delta(h,'google',7),-1);
 h=g.snapshot(h,{},'2026-11-02T20:00:00Z');assert.equal(h.days.at(-1).google.count,null);assert.equal(g.delta(h,'google',7),null);
 assert.equal(g.cleanHistory({version:99,days:[]}).days.length,0);assert.equal(g.cleanHistory({version:1,days:[null,{}, {date:'2026-02-30'}]}).days.length,0);
 assert.equal(g.cleanHistory({version:1,days:'bad'}).days.length,0);
});
test('QR validates official review paths only and generates a locally decodable symbol',()=>{
 const g=api();for(const s of ['https://evil.test','https://www.google.com.evil.test/maps/place/a','javascript:alert(1)','https://www.google.com/maps/place/a','https://u:p@search.google.com/local/writereview?placeid=test','https://search.google.com/local/writereview?placeid=test&key=secret'])assert.equal(g.reviewURL(s),null);
 const documented='https://www.google.com/maps/place//data=!4m3!3m2!1s0x1111111111111111:0x2222222222222222!12e1';assert.equal(g.reviewURL(documented),documented);
 const url='https://search.google.com/local/writereview?placeid=fixture-only-not-a-real-place';assert.equal(g.reviewURL(url),url);assert.equal(g.reviewURL('https://g.page/r/fixture-only/review'),'https://g.page/r/fixture-only/review');
 const c={URL,TextEncoder};vm.createContext(c);vm.runInContext(fs.readFileSync('assets/vendor/qrcodegen.js','utf8'),c);vm.runInContext(fs.readFileSync('assets/reviews-growth.js','utf8'),c);
 const qr=c.ReviewsGrowth.qrMatrix(url),scale=6,n=(qr.size+8)*scale,rgba=new Uint8ClampedArray(n*n*4).fill(255);
 for(let y=0;y<qr.size;y++)for(let x=0;x<qr.size;x++)if(qr.getModule(x,y))for(let j=0;j<scale;j++)for(let i=0;i<scale;i++){const p=(((y+4)*scale+j)*n+(x+4)*scale+i)*4;rgba[p]=rgba[p+1]=rgba[p+2]=0;}
 assert.equal(require('jsqr')(rgba,n,n).data,url);assert.match(c.ReviewsGrowth.qrSVG(url),/viewBox/);assert.throws(()=>c.ReviewsGrowth.qrSVG('https://evil.test'));
});
test('30-day deltas require exact endpoints and preserve zero and negative net change',()=>{
 const g=api();let h=g.snapshot(null,{google:{count:3}},'2026-10-19T19:00:00Z');h=g.snapshot(h,{google:{count:0}},'2026-11-18T20:00:00Z');assert.equal(g.delta(h,'google',30),-3);assert.equal(g.delta(h,'yelp',30),null);
 h=g.snapshot(h,{google:{count:0}},'2026-11-19T20:00:00Z');assert.equal(g.delta(h,'google',30),null);assert.equal(g.dayLA('2026-03-08T10:30:00Z'),'2026-03-08');assert.throws(()=>g.snapshot(null,{},'bad-date'));
 const cleaned=g.cleanHistory({version:1,days:[{date:'2026-01-02',google:{count:1}},{date:'2026-01-01',google:{count:0}},{date:'2026-01-02',google:{count:2}}]});assert.equal(cleaned.days.length,2);assert.equal(cleaned.days[0].google.count,0);assert.equal(cleaned.days[1].google.count,2);
});
test('metrics preserve missing vs real zero, reject invalid source data',()=>{
 const g=api(); assert.equal(g.metric(undefined,'count'),null); assert.equal(g.metric({count:0},'count'),0);assert.equal(g.metric({count:'12'},'count'),null);assert.equal(g.metric({count:-1},'count'),null);assert.equal(g.metric({count:1.5},'count'),null);assert.equal(g.metric({rating:0},'rating'),null);assert.equal(g.metric({rating:4.5},'rating'),4.5);
});
