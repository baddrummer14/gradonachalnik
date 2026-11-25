// Причины вместо «таяния»: у каждой убыли есть понятный источник и способ её снять.
// Плюс: жильё, из чего состоят запасы в каждой эпохе, подсветка всего нового.

// ---------- высокое трудно поднять ещё выше ----------
const _changeL=change;
change=function(fx){ const f={...fx};
  for(const k of ["mood","trust"]){ const v=f[k], cur=S.stats[k];
    if(v>0 && cur>60){ const x=v*(100-cur)/40, whole=Math.floor(x); f[k]=whole+(Math.random()<x-whole?1:0); } }
  return _changeL(f); };
STATS.mood.tip=(STATS.mood.tip||"")+" Довольных людей трудно обрадовать ещё сильнее: чем выше довольство, тем слабее действует каждая новая прибавка.";
STATS.trust.tip=(STATS.trust.tip||"")+" Доверие падает только от поступков. Но чем оно выше, тем труднее поднять его ещё.";

// ---------- жильё ----------
const HOUSE_BASE=[26,30,38,46,56,68];
const HOMES=[null,
  {id:"home1",name:"Длинные дома",cost:16},{id:"home2",name:"Глинобитный квартал",cost:24},{id:"home3",name:"Жилой квартал",cost:30},
  {id:"home4",name:"Слобода за стеной",cost:34},{id:"home5",name:"Каменные дома",cost:38}];
HOMES.forEach((h,e)=>{ if(h) BUILDINGS[e].unshift({...h, eff:{}, cap:12, tip:"жильё ещё на 12 человек"}); });
function housing(){ return HOUSE_BASE[S.eraIdx]+S.built.reduce((a,b)=>a+(b.cap||0),0); }

// ---------- хозяйство: теснота и сундуки ----------
const _economyL=economy;
economy=function(){ const r=_economyL(), fx=r.fx, n=r.notes, s=S.stats, e=S.eraIdx;
  const cap=housing();
  if(s.people>cap){ const d=Math.ceil((s.people-cap)/4); fx.mood-=d; n.push(`БЕДА: тесно. Людей ${s.people}, а жилья на ${cap}: довольство −${d}. Построй жильё`); }
  if(e>=1 && s.goods>50){ S.hoard=(S.hoard||0)+1; if(S.builtAt===e+":"+S.turn) S.hoard=0;
    if(S.hoard>=3){ fx.trust-=2; n.push(`БЕДА: ${GOODS_NAME()} полна третий ход, а в дело не идёт. Говорят, правитель копит для себя: доверие −2. Строй или трать`); } }
  else S.hoard=0;
  return r; };
const GOODS_NAME=()=>S.eraIdx>=2?"казна":"кладовая";

// ---------- из чего состоят еда и запасы, что даёт каждое дело ----------
const WHAT={
  food: ["мясо, рыба, коренья","зерно, молоко, мясо","ячмень, финики, рыба","хлеб, масло, вино","хлеб и привозное зерно","хлеб с округи"],
  goods:["шкуры, соль, кремень","горшки, ткань, зерно на обмен","ячмень и серебро на вес","серебряная монета","монета и товар на складах","монета и бумажные деньги"],
  hunt: ["мясо и шкуры","мясо и молоко","ячмень и скот","хлеб и скот","хлеб","хлеб"],
  gather:["коренья, ягоды, рыба","зерно с полей","овощи, финики, рыба","оливки, вино, рыба","рыба, соль, лён","рыба, соль, овощи"],
  craft:["","горшки, ткань, орудия","горшки, ткань, медь","оружие, посуда, ткань","сукно, стекло, оружие","сукно, железо, часы"],
  trade:["шкуры и соль в обмен на нужное","зерно в обмен на соль и камень","ячмень в обмен на медь и лес","монета с рынка","",""]
};
const _applyLabelsL=applyLabels;
applyLabels=function(){ _applyLabelsL(); const e=S.eraIdx;
  for(const k of ["hunt","gather","craft","trade"]){ const w=WHAT[k][e]; if(w && JOBS[k]) JOBS[k].tip=w+" · "+JOBS[k].tip; } };

// ---------- что нового в эпохе ----------
const NEW_IN=[ [],
 [[".buildbox","Постройки","Панель справа. Стоят запасов, работают до конца игры и смягчают беды. Жильё понадобится, когда людей станет больше, чем места."],
  ['.job[data-k="craft"]',"Ремесло","Старики и женщины делают горшки, ткань и орудия. Это запасы: на них строят и меняются."],
  ['.job[data-k="hunt"]',"Охота стала «Охота и скот», сбор стал «Посевы»","Те же люди, но теперь они растят, а не только находят."]],
 [[".lawbox","Законы","Пишешь сам. Каждый закон действует каждый ход: одно даёт, другое отнимает."],
  ['.job[data-k="army"]',"Войско","Новое дело для мужчин. Воин в бою стоит троих, но ест казну каждый ход."],
  ["#stats .stat:nth-child(2)","Запасы стали казной","Теперь это ячмень и серебро на вес. Город каждый ход берёт из казны на содержание."]],
 [["#treasury","Казна и налог","Новая панель справа. Налог кормит казну и злит людей."],
  ["#treasury","Монета","Свою монету можно испортить: быстрые деньги сейчас, недоверие потом."]],
 [["#treasury","Караваны","Отправляются из панели «Казна»: три пути, чем богаче, тем опаснее."],
  ['.job[data-k="guard"]',"Торговля ушла из списка дел","Рынок больше не кормит казну сам: купцы ходят караванами."]],
 [["#treasury","Банк","В панели «Казна»: вклады дают деньги сразу, кредиты дают прибыль, малый резерв грозит паникой."],
  ["#treasury","Караванов больше нет","Товар идёт по векселям, деньги работают через банк."]]
];
const _startEraL2=startEra;
startEra=function(){ _startEraL2(); S.hoard=0;
  const list=NEW_IN[S.eraIdx]||[]; if(!list.length) return;
  $("eraGo")?.insertAdjacentHTML("beforebegin",`<div class="newin"><b>Новое в этой эпохе</b>${list.map(x=>`<div><i>${x[1]}.</i> ${x[2]}</div>`).join("")}<small>Новое первые три хода подсвечено справа.</small></div>`);
};

// ---------- отрисовка: подписи, жильё, подсветка нового ----------
const _renderL=render;
render=function(ch){ _renderL(ch); const e=S.eraIdx;
  const tiles=document.querySelectorAll("#stats .stat");
  [["food",0],["goods",1]].forEach(([k,i])=>{ const t=tiles[i]; if(t && !t.querySelector(".what")) t.insertAdjacentHTML("beforeend",`<div class="what">${WHAT[k][e]}</div>`); });
  const pop=$("pop"); if(pop){ const cap=housing(), ppl=S.stats.people; pop.insertAdjacentHTML("beforeend",`<span class="${ppl>cap?"down":""}" title="Когда людей больше, чем жилья, довольство падает каждый ход. Жильё строится в панели «Постройки».">Жильё <b>${ppl}</b> из ${cap}</span>`); }
  // новое дело, открытое вехой посреди эпохи
  S.seenJobs=S.seenJobs||[...S.open.jobs]; S.jobNew=S.jobNew||{};
  S.open.jobs.forEach(k=>{ if(!S.seenJobs.includes(k)){ S.seenJobs.push(k); S.jobNew[k]=e+":"+(S.turn+3); } });
  const mark=el=>{ if(el && !el.classList.contains("isnew")){ el.classList.add("isnew"); if(!el.querySelector(".newtag")) el.insertAdjacentHTML("afterbegin",'<span class="newtag">новое</span>'); } };
  if(S.turn<=3) (NEW_IN[e]||[]).forEach(x=>mark(document.querySelector(x[0])));
  for(const k in S.jobNew){ const [je,jt]=S.jobNew[k].split(":"); if(+je===e && S.turn<=+jt) mark(document.querySelector(`.job[data-k="${k}"]`)); }
  if(S.turn>3) document.querySelectorAll(".lawbox.isnew,.buildbox.isnew,#treasury.isnew").forEach(el=>{ el.classList.remove("isnew"); el.querySelector(".newtag")?.remove(); });
};
const _newGameL=newGame;
newGame=function(silent){ S.seenJobs=null; S.jobNew={}; S.hoard=0; return _newGameL(silent); };
