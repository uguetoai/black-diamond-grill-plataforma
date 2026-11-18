import crypto from 'node:crypto';
import '../assets/reviews-growth.js';
const growth=globalThis.ReviewsGrowth;
// Caller supplies runtime key. Never log decrypted payloads, keys or envelopes.
export function priorHistory(raw,password){
 try{
  const e=JSON.parse(raw),s=Buffer.from(e.s,'base64'),iv=Buffer.from(e.i,'base64'),ct=Buffer.from(e.c,'base64');
  if(s.length!==16||iv.length!==12||ct.length<17)throw new Error();
  const decipher=crypto.createDecipheriv('aes-256-gcm',crypto.pbkdf2Sync(password,s,200000,32,'sha256'),iv);decipher.setAuthTag(ct.subarray(-16));
  const data=JSON.parse(Buffer.concat([decipher.update(ct.subarray(0,-16)),decipher.final()]).toString('utf8'));
  if(data.review_history!==undefined&&(data.review_history?.version!==1||!Array.isArray(data.review_history.days)))throw new Error();
  return growth.cleanHistory(data.review_history);
 }catch{throw new Error('Previous encrypted review history cannot be read; refusing to overwrite. Check runtime key/schema privately.');}
}
export function withSnapshot(data,history){data.review_history=growth.snapshot(history,data.reseñas,data.actualizado);return data;}
