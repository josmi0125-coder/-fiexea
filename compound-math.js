(function(root){'use strict';
function project(options){
 const {initial,monthly,years,rate,fee=0,inflation=0}=options;
 if(![initial,monthly,years,rate,fee,inflation].every(Number.isFinite)||initial<0||initial>1e8||monthly<0||monthly>1e6||!Number.isInteger(years)||years<1||years>60||rate<=-100||rate>100||fee<0||fee>20||inflation<0||inflation>30)throw new RangeError('Revisa los importes, los años y los porcentajes.');
 const annual=(1+rate/100)*(1-fee/100)-1,r=Math.expm1(Math.log1p(annual)/12),points=[{year:0,total:initial,contributed:initial}];let total=initial;
 for(let month=1;month<=years*12;month++){total=total*(1+r)+monthly;if(month%12===0)points.push({year:month/12,total,contributed:initial+monthly*month});}
 const contributed=initial+monthly*years*12;
 return{total,contributed,growth:total-contributed,realTotal:total/Math.pow(1+inflation/100,years),points};
}
function requiredMonthly(options,target){
 if(!Number.isFinite(target)||target<=0||target>1e10)throw new RangeError('Introduce un objetivo mayor que cero, hasta 10.000 millones de euros.');
 const base=project({...options,monthly:0}),unit=project({...options,initial:0,monthly:1}),needed=Math.max(0,(target-base.total)/unit.total);
 const monthly=Math.max(0,Math.ceil((needed-1e-10)*100)/100);
 if(monthly>1e6)throw new RangeError('La aportación necesaria supera el máximo de esta calculadora. Prueba con más años o una meta menor.');
 return{monthly,result:project({...options,monthly})};
}
const api={project,requiredMonthly};if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.FiexeaCompoundMath=api;
})(typeof window!=='undefined'?window:globalThis);
