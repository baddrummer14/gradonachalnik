const $ = id => document.getElementById(id);
const sleep = ms => new Promise(r=>setTimeout(r,ms));
const shuffle = a => a.map(v=>[Math.random(),v]).sort((x,y)=>x[0]-y[0]).map(v=>v[1]);
const sign = v => (v>0?"+":"")+v;

const S = { stats:{}, rel:{}, jobs:{}, flags:{}, memory:[], pending:[], eraIdx:0, turn:0,
  queue:[], cur:null, busy:false, audNext:null, audTurn:0, tutorial:true, laws:[], lawCd:0, evNext:null, built:[] };
const BASE_ADVISORS=JSON.parse(JSON.stringify(ADVISORS));

function aiState(){ return {stats:S.stats, rel:S.rel, memory:S.memory, laws:S.laws, pop:S.pop, eraName:ERAS[S.eraIdx].name}; }

function newGame(silent){
  for(const k in STATS) S.stats[k]=STATS[k].start;
  S.stats.food=32; S.stats.goods=10; S.stats.people=18;
  S.pop={men:5,women:5,elders:3,kids:5}; S.acc={food:0,goods:0};
  S.jobs={hunt:5,gather:10,craft:0,trade:0,guard:0};
  S.ms={}; S.traits={war:0,trade:0,law:0,faith:0,nomad:false}; S.open={jobs:["hunt","gather"],laws:false,builds:false};
  S.flags={}; S.memory=[]; S.pending=[]; S.eraIdx=0; S.audNext=null; S.laws=[]; S.lawCd=0; S.evNext=null; S.evReady=null; S.tutorial=true; S.built=[];
  for(const k in ADVISORS) delete ADVISORS[k];
  ADVISORS.hort={...BASE_ADVISORS.hort, banter:BANTER.hort};
  S.reserve=RESERVE.map(r=>({...r})); S.rel={}; for(const k in ADVISORS) S.rel[k]=0;
  if(silent){ S.cur=ERAS[0].events[0]; $("era").textContent=ERAS[0].name; showEvent("Пример события"); S.cur=null; return; }
  startEra();
}

function applyLabels(){
  const L=ERA_LABELS[S.eraIdx]; STATS.goods.name=L.goods;
  for(const k in JOBS) JOBS[k].name=L.jobs[k];
  if(S.traits?.nomad && S.eraIdx>=1){ JOBS.hunt.name="Стада"; JOBS.gather.name="Кочевые промыслы"; }
}
function unlockByKey(key){
  const news=[];
  for(const j in JOB_UNLOCK) if(JOB_UNLOCK[j]===key && !S.open.jobs.includes(j)){ S.open.jobs.push(j); news.push("новое дело: "+JOBS[j].name); }
  for(const p in PANEL_UNLOCK) if(PANEL_UNLOCK[p]===key && !S.open[p]){ S.open[p]=true; news.push(p==="laws"?"панель «Законы»: пиши законы своими словами":"панель «Постройки»: строй за запасы"); }
  const joins=Object.keys(JOIN).filter(k=>!ADVISORS[k] && !S.gone?.[k] && (JOIN[k].at===key || (key==="era:"+S.eraIdx && JOIN[k].era===S.eraIdx && JOIN[k].at==="start")));
  return {news, joins};
}
async function showJoins(joins){
  for(const k of joins){
    ADVISORS[k]={...BASE_ADVISORS[k], banter:BANTER[k]}; S.rel[k]=0;
    await new Promise(res=>{ overlay(`<div class="join"><div class="jpic" style="background-image:url(${ADVISORS[k].img})"></div>
      <h2>В совет ${k==="vedana"?"пришла":"пришёл"} ${ADVISORS[k].name}</h2><p class="rl">${ADVISORS[k].role}</p><p>«${JOIN[k].why}»</p>
      <p class="perk up">Пока доволен: ${SLOTS[k].good}</p><p class="perk down">Если обидеть: ${SLOTS[k].bad}</p>
      <button id="joinOk">Принять в совет</button></div>`); $("joinOk").onclick=()=>{ closeOv(); res(); }; });
  }
  render();
}
function toast(html, cls=""){
  const t=document.createElement("div"); t.className="toast "+cls; t.innerHTML=html; document.body.appendChild(t);
  requestAnimationFrame(()=>t.classList.add("in")); setTimeout(()=>{ t.classList.remove("in"); setTimeout(()=>t.remove(),600); }, 4200);
}
function glowScene(kind){ const s=$("scene"); s.classList.remove("good","bad"); void s.offsetWidth; s.classList.add(kind); }
async function markMs(id){
  if(S.ms[id]) return; const era=ERAS[S.eraIdx], m=era.milestones.find(x=>x[0]===id); if(!m) return;
  S.ms[id]=true; S.memory.push(`ход ${S.turn}: веха «${m[1]}»`);
  const u=unlockByKey("ms:"+id);
  toast(`<b>Веха пройдена: ${m[1]}</b><br><i>Урок правителя:</i> ${m[2]}${u.news.length?"<br>Открыто: "+u.news.join(", "):""}`, "ms");
  glowScene("good"); render();
  if(u.joins.length){ await sleep(900); await showJoins(u.joins); }
}
function startEra(){
  const era=ERAS[S.eraIdx]; applyLabels(); S.evReady=null; S.evNext=null; S.audNext=null;
  document.body.dataset.era=era.id;
  const bg=$("bg"); bg.innerHTML="";
  if(era.video && !matchMedia("(prefers-reduced-motion: reduce)").matches){ const v=document.createElement("video"); v.src=era.video; v.muted=true; v.loop=true; v.autoplay=true; v.playsInline=true; v.setAttribute("playsinline",""); v.poster=era.bg; bg.appendChild(v); v.play().catch(()=>{}); }
  S.turn=0; S.queue=era.events.slice(0,era.turns); S.audTurn=3+Math.floor(Math.random()*2);
  $("era").textContent=era.name;
  if(era.bg) $("bg").style.backgroundImage=`url(${era.bg})`;
  if(S.eraIdx>=1 && !S.open.jobs.includes("guard")) S.open.jobs.push("guard");
  const u=unlockByKey("era:"+S.eraIdx);
  overlay(`<h2>${era.name}</h2><p>${era.intro}</p>
    <p><b>Вехи эпохи</b> (нужно пройти хотя бы две):</p><ol class="mslist">${era.milestones.map(m=>`<li>${m[1]}</li>`).join("")}</ol>
    ${u.news.length?`<p><b>Открыто:</b> ${u.news.join(", ")}</p>`:""}
    <button id="eraGo">Начать</button>`);
  $("eraGo").onclick=async()=>{ closeOv(); if(u.joins.length) await showJoins(u.joins); nextTurn(); };
  render();
}

// ---------- ход ----------
function dropOne(){ for(let i=S.queue.length-1;i>=0;i--) if(!S.queue[i].ms && !S.queue[i].guest){ S.queue.splice(i,1); return; } }
function returnAway(){
  if(!S.away||S.turn<S.away.back) return;
  const lost=Math.random()<0.3?1:0, a=S.away; S.away=null; S.pop.men+=a.men-lost;
  const ch=change(a.ret||{}); if(lost){ S.stats.people=Math.max(0,S.stats.people-1); }
  S.eco=(S.eco?S.eco+" · ":"")+`Вернулись из похода (${a.what}): ${ch.map(([k,v])=>STATS[k].name+" "+sign(v)).join(", ")||"с пустыми руками"}${lost?", один не вернулся":""}.`;
}
function nextTurn(){
  $("audPic")?.remove(); returnAway();
  $("log").innerHTML=""; $("nextBtn").classList.add("hidden");
  const due=S.pending.findIndex(p=>p.at<=S.turn);
  let kind="Событие";
  if(!S.queue.length) return endEra();
  if(due>=0){ S.cur={...LATER[S.pending[due].id]}; S.pending.splice(due,1); dropOne(); kind="Последствие твоего решения"; }
  else if(S.turn+1>=S.audTurn && S.audNext){ return showAudience(); }
  else if(S.queue.length){
    if(S.evReady && (S.turn+1)%3===0 && !S.queue[0].ms && !S.queue[0].guest){ S.cur=S.evReady; S.evReady=null; S.queue.shift(); kind="Событие из твоей истории"; }
    else { S.cur=S.queue.shift(); if(S.cur.guest) kind="Историческое событие · "+S.cur.guest; else if(S.cur.ms) kind="Веха эпохи"; }
  }
  else return endEra();
  S.turn++; if(S.lawCd>0) S.lawCd--;
  showEvent(kind);
  if(!S.evNext && !S.evReady && S.turn>=2){ S.evNext=AI.event(aiState()).then(e=>{ S.evReady=e; S.evNext=null; }); }
  // аудиенцию готовим заранее, пока игрок думает над событием: ожидания не будет
  if(!S.audNext && S.turn+1>=S.audTurn-1) prepareAudience();
}

function prepareAudience(){
  const ks=Object.keys(ADVISORS); if(!ks.length) return;
  // чаще приходит тот, у кого сильнее чувства к вождю (в любую сторону)
  const who=ks.sort((a,b)=>Math.abs(S.rel[b])-Math.abs(S.rel[a])+Math.random()*3-1.5)[0];
  S.audNext=AI.audience({...aiState(), asked:(S.asked||[]).slice(-6)}, who);
}

async function showAudience(){
  setBusy(true);
  const aud=await S.audNext; S.audNext=null; S.audTurn=S.turn+4+Math.floor(Math.random()*2);
  if(!aud||!ADVISORS[aud.who]) return nextTurn();
  S.asked=[...(S.asked||[]), ADVISORS[aud.who].name+' — '+aud.title]; S.usedAud=[...(S.usedAud||[]), aud.who];
  S.turn++; dropOne();
  S.cur={...aud, who:aud.who};
  showEvent("Частная аудиенция · "+ADVISORS[aud.who].name, true);
}

function showEvent(kind, aud=false){
  if(S.eco){ line("fx", S.eco); S.eco=null; }
  $("turnInfo").textContent=`· ход ${S.turn}`;
  $("evKind").textContent=kind; $("evKind").className=aud?"aud":S.cur.guest?"guest":S.cur.ms?"msk":"";
  $("eventCard").className=aud?"aud":S.cur.guest?"guest":"";
  $("audPic")?.remove(); if(aud&&ADVISORS[S.cur.who]){ const im=document.createElement("div"); im.id="audPic"; im.style.backgroundImage=`url(${portrait(S.cur.who)})`; im.innerHTML=`<span>${ADVISORS[S.cur.who].name}</span>`; $("scene").appendChild(im); }
  if(aud||S.cur.guest) toast(aud?`<b>${ADVISORS[S.cur.who]?.name||"Советник"}</b> просит говорить наедине`:`<b>Историческое событие</b><br>${S.cur.guest}`, aud?"aud":"guest");
  $("law-hint")?.remove(); if(S.cur.lawMs) line("tip","Открыта панель «Законы» справа. Напиши там закон своими словами и нажми «Издать».");
  $("evTitle").textContent=S.cur.title;
  $("evText").textContent=S.cur.text;
  const box=$("choices"); box.innerHTML="";
  S.cur.choices.forEach(c=>{
    const b=document.createElement("button"); b.textContent=c.t;
    b.onclick=()=>decide({...c, fx:{...c.fx}, rel:{...(c.rel||{})}}, c.t);
    box.appendChild(b);
  });
  $("ownText").value="";
  $("choices").classList.remove("hidden"); $("own").classList.remove("hidden"); $("hint").classList.remove("hidden");
  render();
  if(S.tutorial) tutorial();
  setBusy(false);
}

function tutorial(){
  const tips={
    1:"Хорт: Я Хорт, веду охотников. Сверху — вехи эпохи: три дела, которые нам надо сделать, чтобы выжить и вырасти. Первое — договориться, как делить добычу. Решай: нажми вариант или напиши своё.",
    2:"Хорт: Справа — наши люди. Мужчины ходят на охоту, женщины, старики и дети собирают коренья. Переставляй их кнопками − и +. Внизу видно, сколько еды прибавится за ход.",
    3:"Хорт: Еда — главное. Если она кончится, племя разбредётся. Копи к зиме."
  };
  if(tips[S.turn]){ const [who,txt]=tips[S.turn].split(/:\s(.+)/); const k=Object.keys(ADVISORS).find(x=>ADVISORS[x].name===who); if(k) say(k,txt,"tip"); else line("tip",tips[S.turn]); }
  if(S.turn>=3) S.tutorial=false;
}

async function decide(res, label){
  if(S.busy) return; setBusy(true);
  say("you", label);
  await sleep(400);
  apply(res);
}

$("own").onsubmit = async e=>{
  e.preventDefault();
  const text=$("ownText").value.trim(); if(!text||S.busy) return;
  setBusy(true); say("you", text);
  const p=AI.judge(aiState(), S.cur, text);
  let done=false; p.then(()=>done=true);
  // пока ИИ думает — историческая справка вместо болтовни
  const dots=document.createElement("div"); dots.className="line thinking"; dots.textContent="⋯";
  await sleep(500);
  if(S.cur?.hist){ line("hist","📜 В истории: "+S.cur.hist); S.histShown=true; }
  else { const sc=(WAIT_SCENES[S.eraIdx]||WAIT_SCENES[0]); line("wait", sc[Math.floor(Math.random()*sc.length)].replace("{a}", ADVISORS[S.cur?.who]?.name||"Гонец")); }
  $("log").appendChild(dots); await p;
  dots.remove();
  const res=await p;
  if(res.source!=="ai" && AI.lastError){ console.warn("[ИИ]", AI.lastError); if(location.search.includes("debug")) line("fx","[отладка] "+AI.lastError); }
  res.lines?.forEach(l=>say(l.who,l.text));
  apply(res);
};

async function apply(res){
  const ch=change(res.fx||{});
  for(const k in res.rel){ S.rel[k]=Math.max(-5,Math.min(5,S.rel[k]+(res.rel[k]||0))); }
  if(res.flag) S.flags[res.flag]=true;
  if(res.trait&&S.traits[res.trait]!==undefined) S.traits[res.trait]++;
  if(res.set==="nomad"){ S.traits.nomad=true; applyLabels(); } if(res.set==="settled") S.traits.nomad=false;
  let msId=res.ms; if(!msId && res.msIf && S.cur?.check) { /* проверим после применения */ }
  if(res.out) guestOutcome(res.out);
  if(res.fight) fight(res);
  if(res.unlockGuard){ const u=unlockByKey("ms:thief"); if(u.news.length) line("fx","Открыто: "+u.news.join(", ")+". Запасы надо стеречь: поставь мужчин в дозор."); }
  if(res.away && S.pop.men>res.away.men){ S.pop.men-=res.away.men; S.away={men:res.away.men, back:S.turn+res.away.turns, ret:res.away.ret, what:res.away.what};
    while(!assign().ok){ const k=Object.keys(S.jobs).sort((a,b)=>S.jobs[b]-S.jobs[a])[0]; if(!S.jobs[k]) break; S.jobs[k]--; }
    line("fx",`${res.away.men} мужчин ушли (${res.away.what}). Вернутся через ${res.away.turns} хода. Пока их рук нет на охоте.`); }
  if(res.later) S.pending.push({id:res.later, at:S.turn+2+Math.floor(Math.random()*2)});
  if(res.mem) S.memory.push(`ход ${S.turn}: ${res.mem}`);
  if(res.narration) line("nar", res.narration);
  fxLine(ch);
  if(S.cur?.hist && !S.histShown) line("hist", "📜 В истории: "+S.cur.hist);
  S.histShown=false;
  ["choices","own","hint"].forEach(id=>$(id).classList.add("hidden"));
  render(ch);
  if(res.msIf && S.cur?.check && S.cur.check(S.stats)) msId=res.msIf;
  if(msId) await markMs(msId); else if(S.cur?.ms && !res.ms) glowScene("bad");
  if(checkDeath()) return;
  if(res.removed){ return exile(res.removed, true).then(()=>{ $("nextBtn").classList.remove("hidden"); setBusy(false); }); }
  $("nextBtn").classList.remove("hidden"); setBusy(false);
}

// конец хода: работа отрядов и расход еды
$("nextBtn").onclick=()=>{
  const e=economy(); const ch=change(e.fx);
  const notes=[...e.notes];
  S.eco=null; if(ch.length){ S.eco=("Хозяйство за прошлый ход: "+ch.map(([k,v])=>`${STATS[k].name} ${sign(v)}`).join(" · ")+(notes.length?" — "+notes.join("; "):"")); }
  render(ch);
  if(checkDeath()) return;
  setTimeout(nextTurn, 700);
};

// кто реально стоит на каждом деле (распределение по группам)
function assign(){
  const p={...S.pop}, j=S.jobs, a={}; let ok=true;
  const take=(job,groups,n)=>{ a[job]=a[job]||{}; for(const gr of groups){ const t=Math.min(n,p[gr]); if(t>0){ a[job][gr]=(a[job][gr]||0)+t; p[gr]-=t; n-=t; } } if(n>0) ok=false; };
  take("hunt",["men"],j.hunt); take("guard",["men"],j.guard);
  take("craft",["elders","women"],j.craft); take("gather",["kids","elders","women"],j.gather);
  take("trade",["women","men"],j.trade);
  return {a, ok, free:p};
}
function slotMult(job){ let m=1; for(const s in SLOTS){ if(!ADVISORS[s]||SLOTS[s].job!==job) continue; const r=S.rel[s]; if(r>=0) m*=SLOTS[s].mult; else if(r<=-3&&s==="gost") m*=0.5; } return m; }
function produce(){
  const {a}=assign(), f={food:0,goods:0};
  for(const job in a) for(const gr in a[job]){ const n=a[job][gr], o=JOBS[job].out;
    let k=slotMult(job); if(job==="gather"&&gr==="kids") k=0.6; if(job==="craft"&&gr==="elders") k=4/3;
    for(const r in o) f[r]+=o[r]*n*k; }
  for(const gr in S.pop) f.food-=GROUPS[gr].eat*S.pop[gr];
  for(const b of S.built){ f.food+=b.eff.food||0; f.goods+=b.eff.goods||0; }
  return f;
}
function economy(){
  const s=S.stats, fx={food:0,goods:0,mood:0,trust:0,people:0}, notes=[], f=produce();
  for(const r of ["food","goods"]){ S.acc[r]+=f[r]; const w=Math.trunc(S.acc[r]); fx[r]+=w; S.acc[r]-=w; }
  for(const b of S.built) for(const k in b.eff) if(k!=="food"&&k!=="goods") fx[k]+=b.eff[k];
  for(const sl in SLOTS){ if(!ADVISORS[sl]) continue; const r=S.rel[sl];
    if(r>=0&&SLOTS[sl].mood) fx.mood+=SLOTS[sl].mood;
    if(r<=-3){ if(sl==="vedana"){ fx.mood-=2; notes.push(ADVISORS[sl].name+" мутит народ"); }
      if(sl==="miron"){ fx.goods-=3; notes.push(ADVISORS[sl].name+" утаил запасы"); }
      if(sl==="hort"&&Math.random()<0.6){ fx.goods-=3; fx.trust-=1; notes.push(ADVISORS[sl].name+" распустил стражу, воруют"); } } }
  const foes=Object.keys(ADVISORS).filter(k=>S.rel[k]<=-4);
  if(foes.length>=2){ fx.trust-=6; notes.push("заговор: "+foes.map(k=>ADVISORS[k].name).join(" и ")+" подбивают людей против тебя"); }
  if(S.open.jobs.includes("guard") && S.jobs.guard < Math.floor(s.people/10) && !S.built.some(b=>b.theft) && Math.random()<0.5){ fx.goods-=3; fx.trust-=2; notes.push("стражи мало, растащили запасы"); }
  if(s.food>70 && s.goods<15 && S.open.jobs.length>2) notes.push("еды вдоволь, а запасов мало: переставь людей на ремесло или обмен");
  if(s.food<20) notes.push("еды мало: больше людей на охоту и сбор");
  if(S.flags.tribute){ fx.goods-=2; notes.push("дань старшему −2"); }
  if(s.trust>70){ fx.trust-=1; notes.push("к хорошему привыкают: доверие тает"); }
  if(S.eraIdx>=2){ const up=Math.floor(s.people/12); fx.goods-=up; notes.push("содержание города −"+up); }
  const {free}=assign(), idle=free.men+free.women;
  if(idle>4){ fx.mood-=1; notes.push(idle+" взрослых без дела, ропщут"); }
  if(s.food>60 && s.mood>55){ fx.people+=2; notes.push("сытно и спокойно, родились дети"); }
  if(s.food<15){ fx.people-=2; fx.mood-=3; notes.push("голод"); }
  return {fx,notes};
}
function forecast(){ const f=produce(); if(S.eraIdx>=2) f.goods-=Math.floor(S.stats.people/12); return {food:Math.round(f.food*10)/10, goods:Math.round(f.goods*10)/10}; }

// люди прибавились или убыли: раскладываем по группам
function popChange(v){
  if(v>0){ for(let i=0;i<v;i++){ const gr=["kids","men","women","kids"][i%4]; S.pop[gr]++; } }
  else for(let i=0;i<-v;i++){ const gr=Object.keys(S.pop).sort((a,b)=>S.pop[b]-S.pop[a])[0]; if(S.pop[gr]>0) S.pop[gr]--; }
}
// смена поколения между эпохами: дети взрослеют, взрослые стареют, старики уходят
function ageing(){
  const p=S.pop, grow=Math.round(p.kids*0.5), old=Math.round((p.men+p.women)*0.15), die=Math.round(p.elders*0.5);
  p.kids-=grow; p.men+=Math.ceil(grow/2); p.women+=Math.floor(grow/2);
  p.men-=Math.ceil(old/2); p.women-=Math.floor(old/2); p.elders+=old-die;
  p.kids+=Math.round((p.men+p.women)*0.2);
  S.stats.people=Math.min(100,Object.values(p).reduce((a,b)=>a+b,0));
}
function change(fx){ const ch=[];
  for(const k in fx){ const v=fx[k]; if(!v) continue;
    if(k==="people"){ popChange(v); const t=Object.values(S.pop).reduce((a,b)=>a+b,0); const d=t-S.stats.people; S.stats.people=Math.min(100,t); if(d) ch.push([k,d]); continue; }
    S.stats[k]=Math.max(0,Math.min(100,S.stats[k]+v)); ch.push([k,v]); }
  // людей стало меньше — снимаем с дел тех, кого больше нет
  while(!assign().ok){ const k=Object.keys(S.jobs).sort((a,b)=>S.jobs[b]-S.jobs[a])[0]; if(!S.jobs[k]) break; S.jobs[k]--; }
  return ch; }
function fxLine(ch){ if(ch.length) line("fx", ch.map(([k,v])=>`<span class="${v>0?"up":"down"}">${STATS[k].name} ${sign(v)}</span>`).join(" · "), true); }

async function chronicleHtml(ending){
  const box=`<details class="chronbox"><summary>📜 Летопись правления</summary><div id="chron"><i>Летописец пишет…</i></div></details>`;
  setTimeout(async()=>{ const c=await AI.chronicle(aiState(), ending); const el=$("chron"); if(!el) return;
    el.innerHTML = c ? `<h3>${esc(c.nickname?"Вождь "+c.nickname:"Летопись")}</h3><p class="chron">${esc(c.text)}</p>`
      : `<h3>Летопись</h3><ul>${S.memory.map(m=>`<li>${esc(m)}</li>`).join("")}</ul>`; },50);
  return box;
}

function nationHtml(){ const n=NATIONS.find(x=>x.when(S.traits)); return `<div class="nation"><h3>Твой народ прошёл путь, похожий на путь ${n.name}</h3><p>${n.text}</p></div>`; }
function checkDeath(){
  const dead=Object.keys(S.stats).find(k=>S.stats[k]<=0 && !(k==="goods"&&S.eraIdx<3)); if(!dead) return false;
  const why={food:"Племя голодает и разбредается.",goods:"Запасы кончились, менять и платить нечем.",
    mood:"Люди восстали против вождя.",trust:"Тебе больше никто не верит. Выбрали нового вождя.",people:"Племени не стало."}[dead];
  chronicleHtml("правление окончено: "+why).then(ch=>overlay(`<h2>Правление окончено</h2><p>${why}</p>${ch}
    <button onclick="closeOv();newGame()">Ещё раз</button>`));
  return true;
}

async function endEra(){
  const era=ERAS[S.eraIdx];
  for(const k in (era.endCheck||{})) if(era.endCheck[k]()) S.ms[k]=true;
  const ok=era.goal.check(S.stats);
  const last=S.eraIdx===ERAS.length-1;
  const ch=await chronicleHtml(`конец эпохи «${era.name}», цель ${ok?"выполнена":"провалена"}`);
  const done=era.milestones.filter(m=>S.ms[m[0]]), miss=era.milestones.filter(m=>!S.ms[m[0]]);
  overlay(`<div class="erapic" style="background-image:url(${era.bg})"></div><h2>Итог: ${era.name}</h2>
    <ul class="msres">${done.map(m=>`<li class="ok">★ ${m[1]} — <i>${m[2]}</i></li>`).join("")}${miss.map(m=>`<li class="no">☆ ${m[1]} — не пройдена</li>`).join("")}</ul>
    <p>${era.outro.text||era.outro}</p>
    <p><b>Цель эпохи ${ok?"выполнена":"не выполнена"}.</b> ${ok?era.goal.win:era.goal.lose}</p>
    ${ch}
    ${last?`${nationHtml()}<p>Сыграй ещё: выбери другой путь, и народ станет другим.</p><button onclick="closeOv();titleScreen()">Новая партия</button>`
          :`<button onclick="closeOv();nextEra(${ok})">Дальше: ${ERAS[S.eraIdx+1].name}</button>`}`);
}
function nextEra(ok){
  ageing(); change(ok?{trust:+4,goods:+8,mood:+5,people:+4}:{trust:-6,goods:+4,people:+2});
  S.memory.push(`--- ${ERAS[S.eraIdx+1].name}: начало, прошлая цель ${ok?"выполнена":"провалена"} ---`);
  S.eraIdx++; startEra();
}

// ---------- законы ----------
async function newLaw(){
  const text=$("lawText").value.trim(); if(!text||S.busy||S.lawCd>0||S.laws.length>=4) return;
  setBusy(true); $("lawText").value=""; say("you","Объявляю закон: "+text);
  line("banter","Советники собираются у костра, люди слушают…");
  const r=await AI.law(aiState(), text);
  if(!r){ line("fx","Ветер унёс слова вождя: закон не услышали. Попробуй позже."); setBusy(false); return; }
  r.lines.forEach(l=>say(l.who,l.text));
  if(!r.accepted){ if(r.narration) line("nar",r.narration); setBusy(false); return; }
  S.laws.push({name:r.name,text}); S.lawCd=3; S.traits.law++; S.memory.push(`ход ${S.turn}: издал закон «${r.name}»`);
  if(r.narration) line("nar",r.narration);
  const ch=change(r.fx); for(const k in r.rel) S.rel[k]=Math.max(-5,Math.min(5,S.rel[k]+r.rel[k]));
  fxLine(ch); render(ch); if(checkDeath()) return;
  if(ERAS[S.eraIdx].milestones.some(m=>m[0]==="law")) await markMs("law");
  if(S.cur?.lawMs && !$("choices").classList.contains("hidden")){ ["choices","own","hint"].forEach(id=>$(id).classList.add("hidden")); $("nextBtn").classList.remove("hidden"); }
  setBusy(false);
}
function repeal(i){ if(S.busy) return; const l=S.laws.splice(i,1)[0]; S.memory.push(`ход ${S.turn}: отменил закон «${l.name}»`);
  const ch=change({trust:-2}); line("fx",`Закон «${l.name}» отменён. Люди удивлены: Доверие −2`); render(ch); }

// ---------- исходы исторических гостей ----------
function guestOutcome(out){
  const g=S.cur?.guest||"Чужеземцы";
  if(out==="war"||(out==="risk"&&Math.random()<0.5)){
    S.traits.war++;
    const id="invasion_"+S.turn;
    LATER[id]={title:"Нашествие", who:Object.keys(ADVISORS)[0], hist:S.cur?.hist,
      text:`Войско, посланное за обиду (${g}), стоит у твоих границ. Сила решит дело: воины, стража и запасы.`,
      choices:[{t:"Принять бой",fight:true,mem:"принял бой с нашествием"},
               {t:"Откупиться большой данью",fx:{goods:-12,trust:-3},mem:"откупился от нашествия"},
               {t:"Уйти и переждать в лесах и степи",fx:{food:-8,people:-2,mood:-4},mem:"увёл людей от нашествия"}]};
    S.pending.push({id, at:S.turn+2});
    line("fx","⚔ Посол уехал с угрозой. Жди войска.");
  } else if(out==="tribute"){ S.flags.tribute=true; line("fx","Ты признал старшего. Дань теперь будет уходить каждый ход."); }
  else if(out==="trade"||out==="alliance"){ S.traits.trade++; S.built.push({id:"pact_"+S.turn,name:"Союз: "+g,eff:{goods:1}}); line("fx","Союз заключён: +1 к запасам каждый ход."); }
}
function fight(res){
  const power=S.pop.men+S.jobs.guard*2+Math.floor(S.stats.goods/10)+(S.built.some(b=>b.theft)?4:0);
  const enemy=8+S.eraIdx*3+Math.floor(Math.random()*8);
  const win=power>=enemy;
  res.narration=win?`Твои воины (сила ${power}) отбили врага (сила ${enemy}). О твоём народе заговорили соседи.`:`Враг (сила ${enemy}) оказался сильнее твоих воинов (сила ${power}). Земли разорены.`;
  const ch=change(win?{trust:+6,people:-2,goods:+4}:{people:-5,goods:-10,trust:-4,mood:-5});
  fxLine(ch); S.traits.war++;
}

// ---------- постройки ----------
function build(id){
  if(S.busy) return; const b=BUILDINGS[S.eraIdx].find(x=>x.id===id);
  if(!b||S.built.some(x=>x.id===id)||S.stats.goods<=b.cost) return;
  const ch=change({goods:-b.cost}); S.built.push(b); S.memory.push(`ход ${S.turn}: построил «${b.name}»`);
  line("nar",`Построено: ${b.name}. ${b.tip}.`); render(ch);
}

// ---------- изгнание советника ----------
function askExile(k){
  if(S.busy) return; const a=ADVISORS[k];
  overlay(`<h2>Прогнать ${a.name}?</h2><p>${a.name} (${a.role}) уйдёт из совета. Его сторонники обидятся: Довольство −4. На его место придёт новый человек со своими целями. А изгнанный может вернуться и отомстить.</p>
  <button onclick="closeOv();exile('${k}')">Прогнать</button> <button onclick="closeOv()">Оставить</button>`);
}
async function exile(k, byDecision){
  setBusy(true); const old={...ADVISORS[k]};
  if(!byDecision) say("you",`${old.name}, ты больше не в совете.`);
  line("banter","Совет затих. Ищут, кого позвать на освободившееся место…");
  const n=S.reserve.shift();
  if(!n){ delete ADVISORS[k]; delete S.rel[k]; S.memory.push(`ход ${S.turn}: лишился ${old.name}, замены нет`);
    line("nar", Object.keys(ADVISORS).length?`Место ${old.name} опустело: желающих сидеть в твоём совете больше нет.`:"Советников больше нет. Теперь ты решаешь один.");
    render(change({mood:-4})); if(!byDecision) setBusy(false); return; }
  n.hello=n.hello||"Служу тебе. Но и о себе не забуду.";
  ADVISORS[k]={name:n.name, role:n.role, wants:n.wants, voice:n.voice, ch:n.name[0], banter:n.banter};
  S.rel[k]=1; S.memory.push(`ход ${S.turn}: прогнал ${old.name}, позвал ${n.name}`);
  const ch=change({mood:-4});
  say(k, n.hello); fxLine(ch);
  // изгнанный вернётся через несколько ходов
  const id="exile_"+k+"_"+S.turn;
  LATER[id]={title:`Возвращение ${old.name}`, who:k,
    text:`${old.name}, которого ты прогнал, вернулся с людьми, недовольными твоей властью. Требует вернуть ему место и долю.`,
    choices:[{t:"Вернуть в совет",fx:{trust:-4},rel:{[k]:-2},mem:`вернул изгнанного ${old.name}`},
             {t:"Откупиться",fx:{goods:-8},rel:{},mem:`откупился от ${old.name}`},
             {t:"Изгнать навсегда вместе с людьми",fx:{people:-4,trust:+3},rel:{},mem:`изгнал ${old.name} навсегда`}]};
  if(!byDecision) S.pending.push({id, at:S.turn+3+Math.floor(Math.random()*3)});
  render(ch); if(!byDecision) setBusy(false);
}

// ---------- отряды ----------
function setJob(k,d){ if(d<0&&S.jobs[k]<=0) return; S.jobs[k]+=d; if(!assign().ok){ S.jobs[k]-=d; flash(k); return; } render(); }
function flash(k){ const el=document.querySelector('.job[data-k="'+k+'"]'); if(el){ el.classList.add("nope"); setTimeout(()=>el.classList.remove("nope"),600); }
  const who=JOBS[k].who.map(x=>GROUPS[x].name.toLowerCase()).join(", "); $("forecast").innerHTML='<span class="down">Некого поставить: сюда годятся '+who+', а свободных нет.</span>'; }

// ---------- отрисовка ----------
function render(ch=[]){
  const d=Object.fromEntries(ch);
  $("stats").innerHTML=Object.entries(STATS).map(([k,s])=>{ const v=S.stats[k];
    return `<div class="stat ${(k==="people"?false:k==="goods"&&S.eraIdx<3?v<5:v<25)?"low":""}" title="${s.tip}"><div class="row"><span>${s.name}</span><span><b>${v}</b>${d[k]?`<span class="d ${d[k]>0?"up":"down"}">${sign(d[k])}</span>`:""}</span></div><div class="bar"><i style="width:${v}%"></i></div></div>`;}).join("");
  const era=ERAS[S.eraIdx];
  $("goal").innerHTML=era.milestones.map(m=>`<span class="ms ${S.ms[m[0]]?"done":""}" title="${m[2]}">${S.ms[m[0]]?"★":"☆"} ${m[1]}</span>`).join("")+` <span class="left">ходов: ${S.queue.length}</span>`;
  $("council").innerHTML=(Object.keys(ADVISORS).length?"":'<div class="law empty">Советников нет. Ты решаешь один.</div>')+Object.entries(ADVISORS).map(([k,a])=>{
    const r=S.rel[k], m=r>=3?"предан":r>=1?"доволен":r>=-1?"спокоен":r>-4?"недоволен":"враждебен";
    return `<div class="adv c-${k} ${S.cur?.who===k?"talk":""}" data-k="${k}"><div class="pic"${portrait(k)?` style="background-image:url(${portrait(k)})"`:""}>${portrait(k)?"":a.ch}</div>
      <div><div class="nm">${a.name}</div><div class="rl">${a.role}</div><div class="mood ${r<0?"down":"up"}">${m} (${sign(r)})</div><div class="perk ${r<=-3?"down":r>=0?"up":""}">${r<=-3?"вредит: "+SLOTS[k].bad:r>=0?"даёт: "+SLOTS[k].good:"обижен, пользы нет"}</div></div><button class="exile" title="Прогнать из совета" onclick="askExile('${k}')">✕</button></div>`;
  }).join("");
  const asg=assign();
  $("units").textContent="";
  $("pop").innerHTML=Object.entries(GROUPS).map(([k,gr])=>'<span>'+gr.name+' <b>'+S.pop[k]+'</b>'+(k!=="kids"&&asg.free[k]?' <i>('+asg.free[k]+' своб.)</i>':'')+'</span>').join("");
  $("jobs").innerHTML=Object.entries(JOBS).filter(([k])=>S.open.jobs.includes(k)).map(([k,j])=>
    `<div class="job" data-k="${k}"><span>${j.name}<small>${j.tip}</small></span><span></span>
      <button onclick="setJob('${k}',-1)">−</button><span class="n">${S.jobs[k]}</span><button onclick="setJob('${k}',1)">+</button></div>`).join("");
  $("laws").innerHTML = S.laws.map((l,i)=>`<div class="law" title="${esc(l.text)}"><span>§ ${esc(l.name)}</span><button onclick="repeal(${i})" title="Отменить (Доверие −2)">×</button></div>`).join("") || '<div class="law empty">Законов пока нет</div>';
  const can=S.lawCd<=0&&S.laws.length<4;
  $("lawText").disabled=!can||S.busy; $("lawBtn").disabled=!can||S.busy;
  $("lawText").placeholder = S.laws.length>=4 ? "Не больше 4 законов" : S.lawCd>0 ? `Новый закон через ${S.lawCd} х.` : "«десятая часть добычи — в общий запас»";
  document.querySelector(".lawbox").classList.toggle("hidden",!S.open.laws); document.querySelector(".buildbox").classList.toggle("hidden",!S.open.builds||!BUILDINGS[S.eraIdx].length);
  $("builds").innerHTML=BUILDINGS[S.eraIdx].map(b=>{ const has=S.built.some(x=>x.id===b.id);
    return `<div class="bld ${has?"has":""}"><span>${b.name}<small>${b.tip}</small></span>${has?"<b>✓</b>":`<button onclick="build('${b.id}')" ${S.stats.goods<=b.cost?"disabled":""}>${b.cost}</button>`}</div>`;}).join("")
    + (S.built.filter(b=>!BUILDINGS[S.eraIdx].includes(b)).length?`<div class="bld old">Прежние: ${S.built.filter(b=>!BUILDINGS[S.eraIdx].includes(b)).map(b=>b.name).join(", ")}</div>`:"");
  const f=forecast();
  $("forecast").innerHTML=`За ход: еда <b class="${f.food<0?"down":"up"}">${sign(f.food)}</b>, запасы <b class="up">${sign(f.goods)}</b>${!S.open.jobs.includes("guard")||S.jobs.guard>=Math.floor(S.stats.people/10)||S.built.some(b=>b.theft)?"":' · <span class="down">стражи мало, будут воровать</span>'}${S.away?.men?` · <span>в походе: ${S.away.men} муж.</span>`:""}<br><small>Люди прибавляются, когда еды больше 60 и довольство выше 55. Убывают от голода, войн и бед.</small>`;
}

function say(who,text,cls=""){
  if(who==="you"){ line("say you "+cls, `<b>${ERA_LABELS[S.eraIdx].leader}:</b> ${esc(text)}`, true); return; }
  const a=ADVISORS[who], n=a?.name||"Голос из толпы", p=a?portrait(who):"";
  line("say "+cls+" c-"+who, `${p?`<span class="mini" style="background-image:url(${p})"></span>`:""}<span><b>${n}:</b> ${esc(text)}</span>`, true);
  const card=document.querySelector(`.adv[data-k="${who}"]`); if(card){ card.classList.remove("speak"); void card.offsetWidth; card.classList.add("speak"); }
}
function line(cls, html, raw){
  const el=document.createElement("div"); el.className="line "+cls;
  el.innerHTML= raw?html:esc(html);
  $("log").appendChild(el); el.scrollIntoView({block:"nearest",behavior:"smooth"});
}
const esc = s=>String(s).replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));
function setBusy(b){ S.busy=b; document.querySelectorAll("#choices button,#own button,#ownText").forEach(x=>x.disabled=b); }
function overlay(h){ $("ovBox").innerHTML=h; $("overlay").classList.remove("hidden"); }
function closeOv(){ $("overlay").classList.add("hidden"); }

// ---------- титульный экран и экскурсия ----------
function titleScreen(){
  overlay(`<div class="title-screen"><div class="crest">✦</div><h1>Градоначальникъ</h1>
  <div class="sub">Проведи свой народ от костра у реки до великой державы. Двенадцать тысяч лет истории — твоими решениями.</div>
  <p>У тебя восемнадцать человек, огонь и добыча. Впереди приручение зверя, первые города, законы, монета, торговые пути и банки. Каждая эпоха ставит перед тобой те же задачи, что стояли перед настоящими правителями.</p>
  <ul class="how">
   <li><b>Решай.</b> Выбери вариант или напиши своё решение словами — советники поймут и ответят.</li>
   <li><b>Распоряжайся людьми.</b> Кто охотится, кто собирает, кто сторожит — от этого зависит, будет ли сыт народ.</li>
   <li><b>Проходи вехи.</b> Каждая открывает новое: советников, работы, законы, постройки.</li>
  </ul>
  <p class="end">В конце ты узнаешь, на какой народ истории похож твой.</p>
  <div class="btns"><button class="main" onclick="closeOv();startTour()">Показать, как играть</button><button onclick="closeOv();newGame()">Сразу в игру</button></div></div>`);
}

const TOUR=[
  ["#stats","Чем живёт племя","Еда, запасы, довольство, доверие к тебе и число людей. Если любой показатель упадёт до нуля, правление окончено. Наведи на показатель, чтобы узнать подробнее."],
  ["#goal","Вехи эпохи","Три главных дела эпохи. Пройдёшь веху — она загорится, и откроется что-то новое. Нужно пройти хотя бы две."],
  ["#eventCard","Событие хода","Здесь каждый ход что-то случается. Читай, что произошло, и решай. Ниже появятся ответы советников и последствия."],
  ["#own","Твоё решение","Главное в игре. Напиши, как поступить, своими словами — например «пусть вор отработает неделю у костра». Или выбери один из вариантов ниже."],
  ["#council","Совет","Пока здесь один советник. Другие придут, когда ты пройдёшь вехи. Каждый даёт пользу, пока доволен, и вредит, если обидеть."],
  [".peoplebox","Люди по делам","Мужчины охотятся, женщины, старики и дети собирают коренья и ягоды. Переставляй людей кнопками − и +. Внизу видно, сколько еды прибавится за ход."],
];

let tourI=0;
function startTour(){ newGame(true); tourI=0; tourStep(); }
function tourStep(){
  document.querySelectorAll(".tour-hl").forEach(e=>e.classList.remove("tour-hl"));
  $("tourBox")?.remove();
  if(tourI>=TOUR.length){ startEra(); return; }
  const [sel,title,text]=TOUR[tourI], el=document.querySelector(sel);
  el.classList.add("tour-hl"); el.scrollIntoView({block:"center"});
  const r=el.getBoundingClientRect(), b=document.createElement("div"); b.id="tourBox";
  b.innerHTML=`<h4>${title}</h4><p>${text}</p><div class="tb"><span>${tourI+1} из ${TOUR.length}</span><span><button onclick="tourI=TOUR.length;tourStep()">Пропустить</button> <button onclick="tourI++;tourStep()">${tourI+1<TOUR.length?"Дальше →":"Играть!"}</button></span></div>`;
  document.body.appendChild(b);
  const w=b.offsetWidth,h=b.offsetHeight; let x=r.right+12, y=r.top;
  if(x+w>innerWidth-8) x=Math.max(8,r.left-w-12);
  if(x<8||r.width>innerWidth*0.6){ x=Math.min(innerWidth-w-8,Math.max(8,r.left)); y=r.bottom+12; if(y+h>innerHeight-8) y=Math.max(8,r.top-h-12); }
  b.style.left=x+"px"; b.style.top=Math.max(8,Math.min(y,innerHeight-h-8))+"px";
}

titleScreen();
