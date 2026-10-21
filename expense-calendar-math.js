/* Calendar dates are local civil dates, independent of UTC and budget cycles. */
(function(root){
'use strict';
const pad=n=>String(n).padStart(2,'0');
function dateKey(y,m,d){return y+'-'+pad(m)+'-'+pad(d)}
function validDate(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;const [y,m,d]=value.split('-').map(Number);return y>=1900&&y<=2199&&m>=1&&m<=12&&d>=1&&d<=new Date(y,m,0).getDate()}
function occurrences(plan,year){
 if(!validDate(plan.date)||!Number.isInteger(year)||year<1900||year>2199)return[];
 const [y,m,d]=plan.date.split('-').map(Number),step={once:0,monthly:1,quarterly:3,yearly:12}[plan.repeat];
 if(step===undefined)return[];
 const end=validDate(plan.end)?plan.end:'2199-12-31';
 if(step===0)return y===year&&plan.date<=end?[plan.date]:[];
 const origin=y*12+m-1,first=year*12,out=[];
 for(let month=0;month<12;month++){const delta=first+month-origin;if(delta<0||delta%step)continue;const key=dateKey(year,month+1,Math.min(d,new Date(year,month+1,0).getDate()));if(key>=plan.date&&key<=end)out.push(key)}
 return out;
}
function paidMoves(entries){return entries.filter(x=>x.type==='expense'&&x.scheduledExpenseId&&validDate(x.scheduledDate)&&validDate(x.date))}
function calendarRows(plans,entries,year){
 const paid=paidMoves(entries),rows=[],seen=new Set();
 for(const plan of plans)for(const due of occurrences(plan,year)){
  const move=paid.find(x=>String(x.scheduledExpenseId)===String(plan.id)&&(x.scheduledOriginalDate||x.scheduledDate)===due);
  if(move){if(move.scheduledDate.startsWith(year+'-')){seen.add(String(move.id));rows.push({plan,move,due:move.scheduledDate,amount:Number(move.amount)})}continue}rows.push({plan,move,due:move?move.scheduledDate:due,amount:move?Number(move.amount):Number(plan.amount)});
 }
 for(const move of paid)if(move.scheduledDate.startsWith(year+'-')&&!seen.has(String(move.id)))rows.push({plan:plans.find(x=>String(x.id)===String(move.scheduledExpenseId)),move,due:move.scheduledDate,amount:Number(move.amount)});
 return rows.sort((a,b)=>a.due.localeCompare(b.due));
}
function taxRows(entries,year,property='',category='',onlyReview=true){
 return paidMoves(entries).filter(x=>x.date.startsWith(year+'-')&&(!onlyReview||x.taxReview)&&(!property||x.property===property)&&(!category||x.cat===category)).sort((a,b)=>a.date.localeCompare(b.date));
}
function csvCell(value){const text=String(value??'');return '"'+(/^[\s]*[=+\-@]/.test(text)?"'"+text:text).replace(/"/g,'""')+'"'}
const api={validDate,occurrences,paidMoves,calendarRows,taxRows,csvCell};root.FiexeaCalendarMath=api;if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);

