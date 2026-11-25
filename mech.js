// Механики поздних эпох: IV — налог и порча монеты, V — караваны (вместо «обмена»), VI — банк: вклады, кредит, паника.
// Каждая открывается с объяснением и влияет на вехи эпохи.
const TAX = [ {n:"нет",g:0,m:0}, {n:"умеренный",g:1/12,m:2}, {n:"тяжёлый",g:1/7,m:5} ];
const ROUTES = {
  near:  {n:"К соседям",  cost:8,  men:2, tip:"надёжно: +16 казны"},
  steppe:{n:"Через степь",cost:10, men:2, tip:"+28, но без стражи (3+) могут ограбить"},
  sea:   {n:"Морем",      cost:12, men:2, tip:"+36, но корабль может не вернуться"}
};

function mechIntro(id, html){ if(S.flags["intro_"+id]) return; S.flags["intro_"+id]=true; toast(html,"ms"); }

// экономика хода: добавляем налог, порчу, караван, банк
const _economy=economy;
economy=function(){
  const r=_economy(), fx=r.fx, notes=r.notes, s=S.stats;
  if(S.eraIdx>=3 && S.tax){ const t=TAX[S.tax];
    if(S.tax===2 && s.trust<50){ notes.push("тяжёлый налог при малом доверии: недоимки, казна не пришла"); }
    else { const g=Math.floor(s.people*t.g); fx.goods+=g; notes.push(`налог ${t.n} +${g}`); }
    fx.mood-=t.m;
    if(S.eraIdx===3 && !S.ms.tax){ S.flags.taxHeld=(S.flags.taxHeld||0)+1; if(S.flags.taxHeld>=3 && s.mood>=40) setTimeout(()=>markMs("tax"),500); } }
  else if(S.eraIdx===3) S.flags.taxHeld=0;
  if(S.infl>0){ S.infl--; fx.food-=2; fx.trust-=1; notes.push("порченая монета: цены растут, хлеба меньше"); }
  if(S.caravan && S.turn>=S.caravan.back){ const c=S.caravan, R=ROUTES[c.route]; S.caravan=null; let g=0, lost=0;
    if(c.route==="near") g=16;
    else if(c.route==="steppe"){ if(S.jobs.guard>=3||S.flags.steppeAlly) g=28; else if(Math.random()<0.5){ g=0; lost=1; } else g=28; }
    else { if(Math.random()<0.7) g=36; else { g=0; lost=2; } }
    if(g && ADVISORS.miron && S.rel.miron>=0) g=Math.round(g*1.25);
    S.pop.men+=R.men-lost; s.people=Math.min(100,Object.values(S.pop).reduce((x,y)=>x+y,0)); fx.goods+=g;
    notes.push(g?`караван «${R.n}» вернулся: +${g}`:`караван «${R.n}» пропал${lost?", погибли "+lost:""}`);
    if(g && S.eraIdx===4 && !S.ms.fair) { S.flags.caravansOk=(S.flags.caravansOk||0)+1; if(S.flags.caravansOk>=2) setTimeout(()=>markMs("fair"),500); } }
  if(S.bank){ const b=S.bank; const pay=Math.ceil(b.dep*0.1); if(pay){ fx.goods-=pay; notes.push(`проценты вкладчикам −${pay}`); }
    b.loans=b.loans.filter(l=>{ if(S.turn<l.back) return true;
      if(Math.random()<loanChance()){ fx.goods+=l.ret; notes.push(`кредит вернули с процентом +${l.ret}`); if(S.eraIdx===5 && !S.ms.credit) setTimeout(()=>markMs("credit"),500); } else { notes.push("должник разорился, кредит пропал"); fx.trust-=1; }
      return false; });
    if(b.dep>0 && s.goods < b.dep*0.5 && Math.random()<0.4){
      const w=Math.min(s.goods-1,b.dep); fx.goods-=w; fx.trust-=8; fx.mood-=5; b.dep=0; b.panics=(b.panics||0)+1;
      notes.push(`ПАНИКА: вкладчики забрали ${w}. Казна держала слишком мало резерва`); S.flags.panicHit=S.turn; }
    else if(S.flags.panicHit && S.turn-S.flags.panicHit>=2 && !S.ms.panic){ S.flags.panicHit=0; setTimeout(()=>markMs("panic"),500); } }
  return r;
};

function loanChance(){ if(!ADVISORS.miron) return 0.8; return S.rel.miron>=0?0.9:S.rel.miron<=-3?0.65:0.8; }
function setTax(i){ if(S.busy) return; S.tax=i; render(); }
function debase(){ if(S.busy||S.flags.debased) return; S.flags.debased=true; S.infl=3; const ch=change({goods:+15});
  S.memory.push(`ход ${S.turn}: подмешал медь в монету`); line("fx","Монету облегчили: казна +15. Купцы скоро заметят.",true); fxLine(ch); render(ch); }
function sendCaravan(k){ const R=ROUTES[k]; if(S.busy||S.caravan||S.stats.goods<=R.cost) return;
  if(assign().free.men<R.men){ $("forecast").innerHTML='<span class="down">Нет свободных мужчин для каравана: сними кого-то с дела.</span>'; return; }
  S.pop.men-=R.men; S.caravan={route:k,back:S.turn+2}; const ch=change({goods:-R.cost});
  S.memory.push(`ход ${S.turn}: отправил караван ${R.n.toLowerCase()}`); line("fx",`Караван ушёл (${R.n}). Вернётся через 2 хода.`); fxLine(ch); render(ch); }
function bankDeposit(){ if(S.busy||S.bank.took===S.turn) return; S.bank.took=S.turn; S.bank.dep+=10; const ch=change({goods:+10});
  line("fx","Горожане сдали серебро в банк: казна +10. Но это их деньги: плати им десятую долю за ход и держи резерв."); fxLine(ch); render(ch); }
function bankLoan(){ if(S.busy||S.stats.goods<=15||S.bank.lent===S.turn) return; S.bank.lent=S.turn; S.bank.loans.push({back:S.turn+3,ret:21}); const ch=change({goods:-15});
  line("fx","Выдан кредит 15. Через 3 хода вернут 21, если должник не разорится."); fxLine(ch); render(ch); }

// при входе в эпоху: открываем новое и убираем отжившее
const _startEraM=startEra;
startEra=function(){
  if(S.eraIdx>=4 && S.open.jobs.includes("trade")){ S.open.jobs=S.open.jobs.filter(j=>j!=="trade"); S.jobs.gather+=S.jobs.trade; S.jobs.trade=0; if(!assign().ok){ S.jobs.gather=0; } }
  if(S.eraIdx>=5 && !S.bank) S.bank={dep:0,loans:[]};
  _startEraM();
  SLOTS.hort.good=JOBS.hunt.name.toLowerCase()+" +25%, стража надёжна";
  SLOTS.gost.good=JOBS.craft.name.toLowerCase()+" +30%";
  SLOTS.miron.good=S.eraIdx===4?"караваны привозят на четверть больше":S.eraIdx>=5?"кредиты возвращают чаще (9 из 10)":JOBS.trade.name.toLowerCase()+" +40%";
  SLOTS.miron.bad=S.eraIdx>=5?"утаивает казну: −3 за ход, должники не платят":"утаивает запасы: −3 за ход";
  render();
  setTimeout(()=>{
    if(S.eraIdx===3) mechIntro("tax","<b>Открыто: Казна и налог</b><br>Налог даёт казну каждый ход, но люди недовольны. Тяжёлый налог при низком доверии не соберёшь. Есть и соблазн: подмешать медь в монету.");
    if(S.eraIdx===4) mechIntro("car","<b>Открыто: Караваны</b><br>Обмен с соседями отжил своё: теперь торгуют караваны. Выбирай путь: надёжный, степной (нужна стража) или морской (богато, но опасно).");
    if(S.eraIdx===5) mechIntro("bank","<b>Открыто: Банк</b><br>Караваны ушли в прошлое: торговлю теперь ведут через банк и векселя. Принимай вклады (банк платит по ним десятую долю за ход) и давай кредиты: без кредитов вклады только в убыток. Но если казна меньше половины вкладов, может начаться паника.");
  },1500);
};

// панель «Казна»
const _renderM=render;
render=function(ch){ _renderM(ch);
  let box=$("treasury"); if(!box){ box=document.createElement("div"); box.id="treasury"; box.className="buildbox"; document.querySelector(".peoplebox").before(box); }
  if(S.eraIdx<3){ box.classList.add("hidden"); return; } box.classList.remove("hidden");
  const t=S.tax||0;
  let h=`<h3>Казна</h3><div class="bld"><span>Налог<small>${t?`+${Math.floor(S.stats.people*TAX[t].g)} казны, −${TAX[t].m} довольства за ход`:"налога нет"}${S.eraIdx===3&&!S.ms.tax&&t?` · до вехи: ${Math.max(0,3-(S.flags.taxHeld||0))} х.`:""}</small></span><span>${TAX.map((x,i)=>`<button class="nz" ${i===t?"disabled":""} onclick="setTax(${i})">${x.n}</button>`).join(" ")}</span></div>`;
  if(S.eraIdx===3) h+=`<div class="bld"><span>Подмешать медь<small>+15 казны сейчас, потом 3 хода дороговизна и недоверие</small></span>${S.flags.debased?"<b>сделано</b>":`<button class="nz" onclick="debase()">Сделать</button>`}</div>`;
  if(S.eraIdx===4) h+= S.caravan?`<div class="bld"><span>Караван в пути<small>${ROUTES[S.caravan.route].n}, вернётся на ходу ${S.caravan.back}</small></span></div>`
    : Object.entries(ROUTES).map(([k,R])=>`<div class="bld"><span>Караван: ${R.n}<small>${R.tip}; ${R.men} муж.</small></span><button onclick="sendCaravan('${k}')" ${S.stats.goods<=R.cost?"disabled":""}>${R.cost}</button></div>`).join("");
  if(S.bank){ const b=S.bank, safe=S.stats.goods>=b.dep*0.5;
    h+=`<div class="bld"><span>Вклады: ${b.dep}<small class="${safe?"up":"down"}">${b.dep?`проценты −${Math.ceil(b.dep*0.1)} за ход · `+(safe?"резерв в порядке":"резерва мало, опасность паники"):"вкладов нет"}</small></span><button class="nz" onclick="bankDeposit()" ${b.took===S.turn?"disabled":""}>+10</button></div>
      <div class="bld"><span>Кредит<small>−15 сейчас, +21 через 3 хода (вернут ${Math.round(loanChance()*10)} из 10); в долгах ${b.loans.length}</small></span><button onclick="bankLoan()" ${S.stats.goods<=15||b.lent===S.turn?"disabled":""}>15</button></div>`; }
  box.innerHTML=h;
};
// союз с послом Чингисхана делает степной путь безопасным
const _guestOutcome=guestOutcome;
guestOutcome=function(out){ if(S.cur?.id==="g_genghis" && (out==="alliance"||out==="trade")) S.flags.steppeAlly=true; return _guestOutcome(out); };

// Усложнение к поздним эпохам: город дороже, богатство манит разбойников, люди требовательнее.
const UPKEEP_K = [0,0,1,1.4,1.8,2.2];
const _economyHard=economy;
economy=function(){
  const r=_economyHard(), fx=r.fx, notes=r.notes, s=S.stats, e=S.eraIdx;
  if(e>=3){ const extra=Math.round(s.people/12*(UPKEEP_K[e]-1)); if(extra>0){ fx.goods-=extra; notes.push(`город растёт, содержание дороже −${extra}`); } }
  if(e>=3 && s.goods>50 && S.jobs.guard < Math.ceil(s.people/8) && Math.random()<0.25+0.1*(e-3)){
    const loss=6+3*(e-3); fx.goods-=loss; fx.trust-=2; notes.push(`богатый город манит разбойников: стражи мало, унесли ${loss}`); }
  return r;
};
// в поздних эпохах удачные решения дают меньше, ошибки бьют сильнее
const _decideHard=decide;
decide=function(c,t){
  if(c && c.fx){ const fx={}; for(const key in c.fx) fx[key]=hardFx(c.fx[key]); c={...c, fx}; }
  return _decideHard(c,t); };

// Древо родов: кто сидел в совете в каждой эпохе. Показывается в финале.
function recordLineage(){ S.lineage=S.lineage||{}; for(const k in ADVISORS){ const L=S.lineage[k]=S.lineage[k]||[]; L[S.eraIdx]={n:ADVISORS[k].name, img:portrait(k)||"", r:S.rel[k]}; } }
const _startEraL=startEra; startEra=function(){ _startEraL(); recordLineage(); };
const _exileL=exile; exile=async function(k,b){ S.lineage=S.lineage||{}; const L=S.lineage[k]=S.lineage[k]||[]; if(L[S.eraIdx]) L[S.eraIdx].gone=true; const res=await _exileL(k,b); if(ADVISORS[k]) (S.lineageX=S.lineageX||[]).push({k,era:S.eraIdx,n:ADVISORS[k].name,img:portrait(k)||""}); return res; };
function lineageHtml(){ const L=S.lineage||{}; const keys=Object.keys(L); if(!keys.length) return "";
  return `<div class="lineage"><h3>Древо твоего совета</h3>${keys.map(k=>`<div class="lrow">${ERAS.map((e,i)=>{ const p=L[k][i];
    return p?`<div class="lcell ${p.gone?"gone":""}" title="${esc(p.n)}${p.gone?" — прогнан":""}"><div class="lpic" style="background-image:url(${p.img})"></div><small>${esc(p.n)}</small></div>`:`<div class="lcell empty"></div>`; }).join("")}</div>`).join("")}</div>`; }
const _nationHtml=nationHtml; nationHtml=function(){ return _nationHtml()+lineageHtml(); };

// портрет исторического гостя в его событии
const _showEventG=showEvent; showEvent=function(kind,aud){ const r=_showEventG(kind,aud);
  if(S.cur?.guest && S.cur.id){ const id=S.cur.id.replace(/^g_/,""); $("audPic")?.remove(); const im=document.createElement("div"); im.id="audPic"; im.className="guestPic";
    im.style.backgroundImage=`url(img/guest_${id}.jpg)`; im.innerHTML=`<span>${S.cur.guest}</span>`; $("scene").appendChild(im); }
  return r; };

// Законы действуют постоянно: ИИ относит закон к одному из видов, код каждый ход считает его пользу и цену.
const LAW_KINDS = {
  court: {n:"суд",    fx:{trust:+1, goods:-1}},
  tax:   {n:"подать", fx:{goods:+2, mood:-1}},
  temple:{n:"обычай", fx:{mood:+1,  food:-1}},
  trade: {n:"торг",   fx:{goods:+2, trust:-1}},
  work:  {n:"труд",   fx:{food:+2,  mood:-1}}
};
function lawEffect(l){ const k=LAW_KINDS[l.kind]; return k?Object.entries(k.fx).map(([s,v])=>STATS[s].name.toLowerCase()+" "+sign(v)).join(", ")+" за ход":""; }
const _economyLaw=economy;
economy=function(){ const r=_economyLaw(); const act=S.laws.filter(l=>LAW_KINDS[l.kind]);
  for(const l of act) for(const k in LAW_KINDS[l.kind].fx) r.fx[k]+=LAW_KINDS[l.kind].fx[k];
  if(act.length) r.notes.push("законы: "+act.map(l=>"«"+l.name+"»").join(", "));
  return r; };

// Решение в событии включает ту же механику, что и панель «Казна»: событие и панель говорят об одном.
const _applyM=apply;
apply=function(res){
  if(res.mech==="tax" && !S.tax){ S.tax=1; line("fx","Налог введён: в панели «Казна» стоит «умеренный». Его можно менять."); }
  if((res.mech==="loanHalf"||res.mech==="loanAll") && S.bank){ const all=res.mech==="loanAll"; S.bank.dep+=all?20:10; S.bank.loans.push({back:S.turn+3,ret:all?14:7});
    line("fx",`В банке вклады +${all?20:10}; часть ушла в долг купцам, через 3 хода вернут ${all?14:7}. Проценты вкладчикам платишь каждый ход.`); }
  if(res.flag==="debased" && !S.infl) S.infl=3;
  return _applyM(res); };
