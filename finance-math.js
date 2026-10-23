(function(root){
'use strict';
const money=value=>{const n=Number(value);return Number.isFinite(n)?Math.max(0,n):0};
function dateValue(value){if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return null;const [y,m,d]=value.split('-').map(Number),date=new Date(y,m-1,d,12);return date.getFullYear()===y&&date.getMonth()===m-1&&date.getDate()===d?date:null}
function savings(target,saved,deadline,now=new Date()){
 const remaining=Math.max(0,money(target)-money(saved)),end=dateValue(deadline),today=new Date(now.getFullYear(),now.getMonth(),now.getDate(),12);
 if(!end)return{remaining,status:'date',months:0,monthly:0};
 if(!remaining)return{remaining,status:'complete',months:0,monthly:0};
 if(end<today)return{remaining,status:'past',months:0,monthly:0};
 const delta=(end.getFullYear()-today.getFullYear())*12+end.getMonth()-today.getMonth(),lastDay=new Date(end.getFullYear(),end.getMonth()+1,0).getDate();
 const months=delta+1-(end.getDate()<Math.min(today.getDate(),lastDay)?1:0);
 return{remaining,status:'active',months,monthly:Math.ceil((remaining/months-1e-9)*100)/100};
}
function recurring(amount,frequency){const perYear={monthly:12,quarterly:4,halfyear:2,yearly:1}[frequency];if(!perYear)return{monthly:0,annual:0};const annual=money(amount)*perYear;return{monthly:annual/12,annual};}
function budget(income,expenses,reserve){const spent=expenses.reduce((sum,n)=>sum+money(n),0),balance=money(income)-spent,available=balance-money(reserve);return{spent,balance,available};}
const api={savings,recurring,budget,money,dateValue};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FiexeaMath=api;
})(typeof window!=='undefined'?window:globalThis);
