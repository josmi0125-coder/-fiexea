/* Receipt extraction is a suggestion only; a person confirms every saved field. */
(function(root){
'use strict';
const norm=s=>String(s||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
function money(s){s=String(s).replace(/[^\d,.]/g,'');const decimal=Math.max(s.lastIndexOf(','),s.lastIndexOf('.'));if(decimal<0||s.length-decimal!==3)return null;const n=Number(s.slice(0,decimal).replace(/[.,]/g,'')+'.'+s.slice(decimal+1));return Number.isFinite(n)&&n>0&&n<=999999999?Math.round(n*100)/100:null}
function validDate(s){if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;const d=new Date(s+'T12:00:00Z');return !isNaN(d)&&d.toISOString().slice(0,10)===s&&s>='1900-01-01'&&s<='2199-12-31'}
function parse(text){
 const lines=String(text||'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean),totals=[];let date='';
 for(let i=0;i<lines.length;i++){
  const line=lines[i],key=norm(line);
  if(!date){const m=line.match(/\b(\d{1,2})[/.\-](\d{1,2})[/.\-](\d{2}|\d{4})\b/);if(m){const year=m[3].length===2?'20'+m[3]:m[3],candidate=year+'-'+m[2].padStart(2,'0')+'-'+m[1].padStart(2,'0');if(validDate(candidate))date=candidate}else{const iso=line.match(/\b20\d{2}-\d{2}-\d{2}\b/);if(iso&&validDate(iso[0]))date=iso[0]}}
  if(/\btotal\b|importe a pagar|a pagar|amount due|grand total/.test(key)&&!(/sub\s*total|total.*(?:iva|impuesto|tax|articulo|descuento|ahorro)/.test(key))){
   const amounts=(line.match(/\d[\d.,]*[,.]\d{2}\b/g)||[]).map(money).filter(Boolean);
   let value=amounts.at(-1);if(!value&&/^\D*(?:total|importe total|total a pagar)\D*$/i.test(key))value=money(lines[i+1]||'');
   if(value)totals.push({value,score:/a pagar|importe total|grand total|amount due|total compra/.test(key)?2:1});
  }
 }
 // Bank transfer and payment confirmations may show IMPORTE rather than TOTAL.
 const full=norm(lines.join(' '));
 if(!totals.length&&/justificante|operacion|cargo|abanca|transferencia/.test(full)){
  for(let i=0;i<lines.length;i++){
   const key=norm(lines[i]);
   if(/\bimporte\b|\btotal\b/.test(key)){
    const candidates=[lines[i],lines[i+1]||'',lines[i+2]||''];
    for(const candidate of candidates){const amounts=(candidate.match(/\b\d{1,3}(?:[. ]\d{3})*,\d{2}\b|\b\d+[.,]\d{2}\b/g)||[]).map(money).filter(Boolean);if(amounts.length){totals.push({value:amounts.at(-1),score:/\btotal\b/.test(key)?3:2});break}}
   }
  }
 }
 totals.sort((a,b)=>b.score-a.score);const best=totals[0],ambiguous=!!best&&totals.some(t=>t.score===best.score&&t.value!==best.value);
 const bank=/\babanca\b/.test(norm(lines.join(' ')))?'ABANCA · Justificante de operación':null;
 const name=bank||lines.slice(0,7).find(s=>/[a-záéíóúñ]{3}/i.test(s)&&!/(factura|ticket|recibo|copia|bienvenid|cif|nif|fecha|telefono|www\.|https?:|\d{5})/i.test(s))||'';
 let category='';const all=norm(lines.join(' '));
 for(const[pattern,cat]of [[/mercadona|consum\b|carrefour|lidl|aldi|supermercado|alimentacion/,'Alimentación'],[/gasolinera|repsol|cepsa|combustible|gasoil|gasolina/,'Gasolina'],[/farmacia/,'Salud'],[/restaurante|cafeteria|bar\b|menu del dia/,'Restaurantes'],[/gimnasio|gym/,'Gym'],[/seguro|poliza/,'Seguros'],[/electricidad|iberdrola|endesa|naturgy|agua/,'Suministros']]){if(pattern.test(all)){category=cat;break}}
 return {name:name.slice(0,100),amount:ambiguous?null:best?.value||null,date,category,warnings:[...(!name?['Revisa el comercio.']:[]),...(!best||ambiguous?['No se ha identificado un total único. Introduce el importe.']:[]),...(!date?['No se ha identificado una fecha válida.']:[]),...(/\b(?:usd|gbp|dolar|pound)\b|[$£]/i.test(all)?['Revisa la moneda: no se convierten divisas automáticamente.']:[])]};
}
function duplicates(list,{amount,date,name}){return list.filter(m=>m.type==='expense'&&m.date===date&&Math.abs(Number(m.amount)-Number(amount))<.005).sort((a,b)=>Number(norm(b.desc)===norm(name))-Number(norm(a.desc)===norm(name)))}
const api={parse,money,validDate,duplicates,norm};root.FiexeaReceiptScanMath=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
