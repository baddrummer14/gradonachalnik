// Сложность и последствия: богатство надо удерживать, стройки дороги, беды случаются, советники соперничают.

// ---------- стройки: дороже и по одной за ход ----------
BUILDINGS.forEach(list=>list.forEach(b=>{ b.cost=Math.round(b.cost*2.2); }));
const _buildB=build;
build=function(id){
  const key=S.eraIdx+":"+S.turn;
  if(S.builtAt===key){ toast("Строители заняты: за один ход одна стройка."); return; }
  const n=S.built.length; const r=_buildB(id); if(S.built.length>n) S.builtAt=key; return r;
};

// ---------- смена эпохи: накопленное не переносится целиком ----------
const _nextEraB=nextEra;
nextEra=function(ok){ const s=S.stats;
  s.food=Math.min(s.food,55); s.goods=Math.min(45,Math.round(s.goods*0.5)+10);
  s.mood=Math.round((s.mood+50)/2); s.trust=Math.round((s.trust+50)/2);
  return _nextEraB(ok); };
const _startEraB=startEra;
startEra=function(){ _startEraB(); S.seen=[];
  if(S.eraIdx>0) $("eraGo")?.insertAdjacentHTML("beforebegin",`<p><i>Прошли поколения. Запасы прежней эпохи проедены и растрачены. Новое поколение не помнит заслуг твоего деда: доверие и довольство придётся заслужить заново.</i></p>`);
  if(S.eraIdx===1) setTimeout(()=>toast("<b>Открыто: Постройки</b><br>Панель справа. Стройка стоит запасов, за ход можно начать одну.","ms"),1800);
};

// ---------- хозяйство: чем больше накоплено, тем труднее удержать ----------
const CALAMITY=[ [],
  [{n:"волки порезали стадо", fx:{food:-9}, soft:()=>S.jobs.guard>=2, why:"стража отогнала стаю"}, {n:"гниль в зерновых ямах", fx:{food:-11}, soft:()=>!!S.ms.granary, why:"амбар уберёг большую часть"}],
  [{n:"пожар в квартале мастеров", fx:{goods:-12}, soft:()=>S.built.some(b=>b.id==="canal"), why:"воду подали из канала"}, {n:"саранча на полях", fx:{food:-14}, soft:()=>S.laws.some(l=>l.kind==="work"), why:"поля спасли общим трудом"}],
  [{n:"на рынке ходит фальшивая монета", fx:{goods:-8,trust:-6}, soft:()=>S.built.some(b=>b.id==="mint"), why:"монетный двор изъял подделки"}, {n:"неурожай", fx:{food:-16}, soft:()=>S.built.some(b=>b.id==="road"), why:"хлеб подвезли по дороге"}],
  [{n:"пираты взяли торговые суда", fx:{goods:-16}, soft:()=>S.jobs.guard>=5, why:"охрана отбила часть груза"}, {n:"чума пришла с караваном", fx:{people:-5,mood:-6}, soft:()=>S.built.some(b=>b.id==="hospital"), why:"госпиталь удержал заразу"}],
  [{n:"лопнул крупный торговый дом", fx:{goods:-18,trust:-5}, soft:()=>S.built.some(b=>b.id==="exchange"), why:"биржа разнесла убытки на многих"}, {n:"холера в бедных кварталах", fx:{people:-6,mood:-6}, soft:()=>S.built.some(b=>b.id==="hospital"), why:"госпиталь удержал заразу"}]
];
const _economyB=economy;
economy=function(){
  const r=_economyB(), fx=r.fx, n=r.notes, s=S.stats, e=S.eraIdx;
  if(s.food>60){ const keep=!!S.ms.granary||!!S.ms.temple, d=Math.ceil((s.food-60)/(keep?10:5)); fx.food-=d; n.push(keep?`лишняя еда портится −${d} (амбар бережёт половину)`:`лишняя еда портится −${d}: хранить негде, нужен амбар`); }
  if(e>=1 && e<3 && s.goods>40 && S.jobs.guard<Math.ceil(s.people/8) && !S.built.some(b=>b.theft) && Math.random()<0.3){ fx.goods-=7; fx.trust-=2; n.push("разбойники прослышали о богатстве: стражи мало, унесли 7"); }
  if(e>=3 && s.goods<=0){ fx.trust-=7; fx.mood-=5; n.push("БЕДА: казна пуста, страже и писцам не плачено. Наполни её налогом, торговлей или займом"); }
  // беда: раз в несколько ходов, со второй эпохи
  const list=CALAMITY[e]||[];
  if(list.length && S.turn>=2 && S.calamAt!==e+":"+S.turn && Math.random()<0.18){ S.calamAt=e+":"+S.turn;
    const c=list[Math.floor(Math.random()*list.length)], soft=c.soft();
    for(const k in c.fx) fx[k]+=soft?Math.round(c.fx[k]/3):c.fx[k];
    n.push(`БЕДА: ${c.n}${soft?", но "+c.why:""}`); S.memory.push(`ход ${S.turn}: беда, ${c.n}`); }
  return r;
};

// ---------- события: что уже было в эпохе (ИИ не повторяет) и расклад сил перед боем ----------
const _showEventB=showEvent;
showEvent=function(kind,aud){
  if(S.cur && S.cur.title==="Нашествие" && !S.cur._pw){ S.cur._pw=1; const ep=enemyPower();
    S.cur.text+=` Твоя сила ${fightPower()}: воин за троих, стражник за двоих, стена 4, каждый третий мужчина. У врага от ${ep} до ${ep+5}. Если враг вдвое сильнее, бой кончится твоим свержением.`;
    S.cur.choices=S.cur.choices.map(c=>c.fight?c:{...c, fx:c.fx&&c.fx.goods?{...c.fx, goods:-Math.max(14,Math.round(S.stats.goods*0.45)), trust:-5}:c.fx}); }
  const r=_showEventB(kind,aud);
  if(S.cur?.title){ S.seen=S.seen||[]; if(!S.seen.includes(S.cur.title)) S.seen.push(S.cur.title); }
  return r;
};

// ---------- советники: соперничество, ответ на твоё решение ----------
const RIVAL={hort:"miron", miron:"hort", vedana:"gost", gost:"vedana"};
const _applyB=apply;
apply=function(res){
  const c=S.cur, who=c&&c.who;
  if(c && c.aud && ADVISORS[who]){
    const d=(res.rel&&res.rel[who])||0, f=isFem(who), rv=RIVAL[who];
    if(!res.lines||!res.lines.length) say(who, d>=2?(f?"Благодарю. Я этого не забуду.":"Благодарю. Я этого не забуду."):d<0?(f?"Что ж. Я просила по-хорошему.":"Что ж. Я просил по-хорошему."):"Половина лучше, чем ничего. Но запомню и это.");
    if(d>=2 && ADVISORS[rv]){ res.rel={...res.rel, [rv]:(res.rel[rv]||0)-1}; line("fx",`${ADVISORS[rv].name} видит, чью сторону ты взял: отношение −1`); }
  } else if(c && c.source==="ai" && ADVISORS[who] && (!res.lines||!res.lines.length)){
    const d=(res.rel&&res.rel[who])||0; say(who, d>0?"Справедливо. Так и сделаем.":d<0?"Так нельзя. Ты ещё вспомнишь мои слова.":"Быть по сему.");
  }
  if(res.possible===false) line("fx","Совет не смог исполнить это: не по силам или не по времени.");
  return _applyB(res);
};

// закон о суде: подпись в панели
if(typeof LAW_KINDS!=="undefined"){ const _lawEffectB=lawEffect; lawEffect=function(l){ const t=_lawEffectB(l); return t&&l.kind==="court"?t+", воровства нет":t; }; }
