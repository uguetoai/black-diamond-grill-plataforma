/* Reseñas: todo automático. Rudy y Elimar solo aprueban (respondiendo a Arianna en Telegram). */
(function(root){
 'use strict';
 const G=root.ReviewsGrowth;
 const PLACE_ID='ChIJm2ou8Aj1kFQRSImFlrPXl3Q';
 let data=null,language='es';
 const $=id=>document.getElementById(id);
 const L=(es,en)=>language==='en'?en:es;
 const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const missing=()=>L('Sin dato','No data');
 const val=n=>n===null?missing():String(n);
 function download(name,body,type){const blob=new Blob([body],{type}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
 // El enlace solo cuenta si viene del Place ID verificado del restaurante.
 function reviewLink(){const g=data?.reseñas?.google;return g?.place_id===PLACE_ID?G.reviewURL(g.write_review_uri):null;}
 function approval(){const a=data?.aprobaciones?.tarjeta_qr;return a&&a.estado==='aprobado'&&typeof a.por==='string'&&typeof a.fecha==='string'?a:null;}
 function cardSVG(url,ok){return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 760"><rect width="600" height="760" fill="white"/><g fill="#171513" text-anchor="middle" font-family="Georgia,serif"><text x="300" y="65" font-size="28">Black Diamond Grill</text><text x="300" y="115" font-size="23">Share your experience on Google</text><text x="300" y="150" font-size="17">An honest review is always optional.</text><text x="300" y="180" font-size="17">Scan now or leave a review later, at your own pace.</text></g><svg x="100" y="215" width="400" height="400">${G.qrSVG(url)}</svg>${ok?'':'<g text-anchor="middle" font-family="sans-serif" font-size="15" fill="#6a635a"><text x="300" y="680">DRAFT — pending approval</text></g>'}</svg>`;}
 function report(){const metrics={};for(const p of ['google','yelp'])metrics[p]={rating:G.metric(data?.reseñas?.[p],'rating'),count:G.metric(data?.reseñas?.[p],'count')};return {updated:data?.actualizado??null,metrics,history:G.cleanHistory(data?.review_history),qr_link:reviewLink(),qr_card_approval:approval(),qr_scans:null,attribution:'Not measured. Net changes are not attributable to the QR.'};}
 function render(payload,lang='es'){
  if(!payload)return clear();data=payload;language=lang;const host=$('growth-module');if(!host)return;
  const h=G.cleanHistory(data.review_history),first=h.days[0],latest=h.days.at(-1),current=latest?.date===G.dayLA(data.actualizado);
  const url=reviewLink(),ap=approval();
  const autoRows=[
   [L('Lee Google y Yelp cada hora y guarda el total de cada día','Reads Google and Yelp every hour and saves each day\'s total'),latest?L('Al día · ','Up to date · ')+latest.date:missing()],
   [L('Calcula cuántas reseñas nuevas hubo en 7 y 30 días','Works out new reviews over 7 and 30 days'),h.days.length>=8?L('Activo','Active'):L('Acumulando días · ','Collecting days · ')+h.days.length+'/8'],
   [L('Comprueba que el QR abre la ficha de Black Diamond Grill en Google','Checks the QR opens Black Diamond Grill on Google'),url?L('Verificado','Verified'):L('Sin enlace verificado','No verified link')],
  ];
  host.innerHTML=`<div class="head"><h2>${L('Reseñas y reputación','Reviews & reputation')}</h2></div>
  <div class="growth-metrics">${['google','yelp'].map(p=>`<div><strong>${p==='google'?'Google':'Yelp'}</strong><p>${L('Calificación','Rating')}: ${val(G.metric(data.reseñas?.[p],'rating'))} · ${L('Total','Total')}: ${val(G.metric(data.reseñas?.[p],'count'))}</p><p>${L('Nuevas','New')} 7d: ${val(current?G.delta(h,p,7):null)} · 30d: ${val(current?G.delta(h,p,30):null)}</p></div>`).join('')}</div>
  <div class="growth-columns"><div><h3>${L('Lo hace el sistema solo','Done automatically')}</h3><ul id="growth-auto" style="margin:0;padding-left:18px;line-height:1.7">${autoRows.map(r=>`<li>${esc(r[0])}: <strong>${esc(r[1])}</strong></li>`).join('')}</ul>
  <h3 style="margin-top:18px">${L('Solo necesita tu OK','Only needs your OK')}</h3><p id="growth-approval">${ap?L('✅ Tarjeta con QR aprobada por ','✅ QR card approved by ')+esc(ap.por)+' · '+esc(ap.fecha):L('⏳ Tarjeta con QR para las mesas. Arianna te la manda por Telegram; respóndele «Apruebo» y queda lista para imprimir.','⏳ QR card for the tables. Arianna sends it on Telegram; reply «I approve» and it is ready to print.')}</p></div>
  <div><h3>${L('Tarjeta con QR de Google','Google QR card')}</h3><div id="growth-qr">${url?G.qrSVG(url):''}</div><p id="growth-qr-status" class="note">${url?(ap?L('Lista para imprimir.','Ready to print.'):L('Borrador hasta tu aprobación.','Draft until approved.')):L('Sin enlace verificado todavía.','No verified link yet.')}</p><div class="growth-actions"><button id="growth-card"${url&&ap?'':' disabled'}>${L('Descargar tarjeta para imprimir','Download printable card')}</button></div></div></div>
  <details><summary>${L('Historial diario','Daily history')}</summary><div id="growth-history">${first?`<div class="growth-table"><table><thead><tr><th>${L('Fecha','Date')}</th><th>Google</th><th>Yelp</th></tr></thead><tbody>${h.days.slice(-31).reverse().map(r=>`<tr><td>${r.date}</td><td>${val(r.google.count)}</td><td>${val(r.yelp.count)}</td></tr>`).join('')}</tbody></table></div>`:L('El historial empieza a llenarse solo con la próxima actualización.','History starts filling automatically with the next update.')}</div></details>
  <details><summary>${L('Reglas que sigue el sistema','Rules the system follows')}</summary><p>${L('Invitación neutral y voluntaria, igual para todos: sin pedir 5 estrellas, sin descuentos ni sorteos, sin elegir solo clientes contentos y sin presión en el local. En Yelp no se piden reseñas. No se envían mensajes a clientes sin tu aprobación. Las cifras nuevas son netas (incluyen borrados) y no se atribuyen al QR.','Neutral, voluntary invitation, the same for everyone: no asking for 5 stars, no discounts or raffles, no picking only happy guests, no pressure on site. Yelp reviews are never requested. No messages go to guests without your approval. New counts are net (include deletions) and are not attributed to the QR.')}</p></details>
  <p class="note">${L('Actualizado','Updated')}: ${esc(data.actualizado||missing())} · <button id="growth-export" style="font:inherit">${L('Exportar JSON','Export JSON')}</button></p>`;
  const card=$('growth-card');if(card)card.addEventListener('click',()=>{if(data&&url&&ap)download('black-diamond-grill-google-review-card.svg',cardSVG(url,true),'image/svg+xml');});
  $('growth-export').addEventListener('click',()=>{if(data)download('reputation-summary.json',JSON.stringify(report(),null,2),'application/json');});
 }
 function clear(){data=null;const host=$('growth-module');if(host)host.replaceChildren();}
 root.ReviewsGrowthUI={render,clear,cardSVG:(url,ok)=>cardSVG(url,ok)};
})(globalThis);
