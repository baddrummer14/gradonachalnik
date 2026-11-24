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
  for(const k in JOBS) S.jobs[k]=JOBS[k].start;
  S.pop={}; for(const k in GROUPS) S.pop[k]=GROUPS[k].start; S.acc={food:0,goods:0};
  S.flags={}; S.memory=[]; S.pending=[]; S.eraIdx=0; S.audNext=null; S.laws=[]; S.lawCd=0; S.evNext=null; S.evReady=null; S.tutorial=true; S.built=[];
  for(const k in ADVISORS) delete ADVISORS[k];
  for(const k in BASE_ADVISORS) ADVISORS[k]={...BASE_ADVISORS[k], banter:BANTER[k]};
  S.reserve=RESERVE.map(r=>({...r})); S.rel={}; for(const k in ADVISORS) S.rel[k]=0;
  if(silent){ S.cur=ERAS[0].events[0]; $("era").textContent=ERAS[0].name; showEvent("Пример события"); S.cur=null; return; }
  startEra();
}

function applyLabels(){
  const L=ERA_LABELS[S.eraIdx]; STATS.goods.name=L.goods;
  for(const k in JOBS) JOBS[k].name=L.jobs[k];
}
function startEra(){
  const era=ERAS[S.eraIdx]; applyLabels(); S.evReady=null; S.evNext=null; S.audNext=null;
  S.turn=0; S.queue=shuffle(era.events).slice(0,era.turns); S.audTurn=2+Math.floor(Math.random()*2);
  $("era").textContent=era.name;
  if(era.bg) $("bg").style.backgroundImage=`url(${era.bg})`;
  overlay(`<h2>${era.name}</h2><p>${era.intro}</p>
    <p><b>Цель эпохи:</b> ${era.goal.text}.</p>
    <button onclick="closeOv();nextTurn()">Начать</button>`);
  render();
}

// ---------- ход ----------
function nextTurn(){
  $("log").innerHTML=""; $("nextBtn").classList.add("hidden");
  const due=S.pending.findIndex(p=>p.at<=S.turn);
  let kind="Событие";
  if(!S.queue.length) return endEra();
  if(due>=0){ S.cur={...LATER[S.pending[due].id]}; S.pending.splice(due,1); S.queue.pop(); kind="Последствие твоего решения"; }
  else if(S.turn+1>=S.audTurn && S.audNext){ return showAudience(); }
  else if(S.queue.length){
    if(S.evReady && (S.turn+1)%3===0){ S.cur=S.evReady; S.evReady=null; S.queue.pop(); kind="Событие из твоей истории"; }
    else S.cur=S.queue.shift();
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
  S.audNext=AI.audience(aiState(), who);
}

async function showAudience(){
  setBusy(true);
  const aud=await S.audNext; S.audNext=null; S.audTurn=S.turn+3+Math.floor(Math.random()*2);
  if(!aud||!ADVISORS[aud.who]) return nextTurn();
  S.turn++; S.queue.pop();
  S.cur={...aud, who:aud.who};
  showEvent("Частная аудиенция · "+ADVISORS[aud.who].name, true);
}

function showEvent(kind, aud=false){
  if(S.eco){ line("fx", S.eco); S.eco=null; }
  $("turnInfo").textContent=`· ход ${S.turn}`;
  $("evKind").textContent=kind; $("evKind").className=aud?"aud":"";
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
    1:"Ведана: Вождь, слушай. Сверху — то, чем живёт племя. Наведи на любой знак, я объясню. Справа — люди по делам: кто охотится, кто сторожит. Это работает каждый ход.",
    2:"Мирон: Кнопки — то, что советуем мы. Но ты вождь. Напиши своё решение в поле внизу, любыми словами, и мы поймём.",
    3:"Хорт: Иногда кто-то из нас попросит говорить наедине. Слушай внимательно: каждый тянет одеяло на себя."
  };
  if(tips[S.turn]) line("tip", tips[S.turn]);
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
  const lines=shuffle(Object.entries(ADVISORS).flatMap(([k,a])=>(a.banter||[]).map(t=>[k,t]))); let i=0, last="";
  await sleep(900);
  while(!done && i<lines.length && i<6){ let [who,t]=lines[i++]; if(who===last&&i<lines.length) [who,t]=lines[i++]; last=who; say(who,t,"banter"); await Promise.race([sleep(3600), p]); }
  const res=await p;
  if(res.source!=="ai" && AI.lastError) console.warn("[ИИ]", AI.lastError);
  res.lines?.forEach(l=>say(l.who,l.text));
  apply(res);
};

function apply(res){
  const ch=change(res.fx||{});
  for(const k in res.rel){ S.rel[k]=Math.max(-5,Math.min(5,S.rel[k]+(res.rel[k]||0))); }
  if(res.flag) S.flags[res.flag]=true;
  if(res.later) S.pending.push({id:res.later, at:S.turn+2+Math.floor(Math.random()*2)});
  if(res.mem) S.memory.push(`ход ${S.turn}: ${res.mem}`);
  if(res.narration) line("nar", res.narration);
  fxLine(ch);
  ["choices","own","hint"].forEach(id=>$(id).classList.add("hidden"));
  render(ch);
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
  if(S.jobs.guard < Math.floor(s.people/10) && !S.built.some(b=>b.theft) && Math.random()<0.5){ fx.goods-=3; fx.trust-=2; notes.push("стражи мало, растащили запасы"); }
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
  const box=`<div id="chron"><i>Летописец пишет…</i></div>`;
  setTimeout(async()=>{ const c=await AI.chronicle(aiState(), ending); const el=$("chron"); if(!el) return;
    el.innerHTML = c ? `<h3>${esc(c.nickname?"Вождь "+c.nickname:"Летопись")}</h3><p class="chron">${esc(c.text)}</p>`
      : `<h3>Летопись</h3><ul>${S.memory.map(m=>`<li>${esc(m)}</li>`).join("")}</ul>`; },50);
  return box;
}

function checkDeath(){
  const dead=Object.keys(S.stats).find(k=>S.stats[k]<=0); if(!dead) return false;
  const why={food:"Племя голодает и разбредается.",goods:"Запасы кончились, менять и платить нечем.",
    mood:"Люди восстали против вождя.",trust:"Тебе больше никто не верит. Выбрали нового вождя.",people:"Племени не стало."}[dead];
  chronicleHtml("правление окончено: "+why).then(ch=>overlay(`<h2>Правление окончено</h2><p>${why}</p>${ch}
    <button onclick="closeOv();newGame()">Ещё раз</button>`));
  return true;
}

async function endEra(){
  const era=ERAS[S.eraIdx], ok=era.goal.check(S.stats);
  const last=S.eraIdx===ERAS.length-1;
  const ch=await chronicleHtml(`конец эпохи «${era.name}», цель ${ok?"выполнена":"провалена"}`);
  overlay(`<h2>${era.outro.title}</h2><p>${era.outro.text}</p>
    <p><b>Цель эпохи ${ok?"выполнена":"не выполнена"}.</b> ${ok?era.goal.win:era.goal.lose}</p>
    ${ch}
    ${last?`<p><b>Правление окончено.</b> Ты провёл людей от костра у реки до банка. Сыграй ещё: события, советники и аудиенции будут другими.</p><button onclick="closeOv();titleScreen()">Новая партия</button>`
          :`<button onclick="closeOv();nextEra(${ok})">Дальше: ${ERAS[S.eraIdx+1].name}</button>`}`);
}
function nextEra(ok){
  ageing(); change(ok?{trust:+4,goods:+5,people:+4}:{trust:-6,mood:-5,people:+2});
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
  S.laws.push({name:r.name,text}); S.lawCd=3; S.memory.push(`ход ${S.turn}: издал закон «${r.name}»`);
  if(r.narration) line("nar",r.narration);
  const ch=change(r.fx); for(const k in r.rel) S.rel[k]=Math.max(-5,Math.min(5,S.rel[k]+r.rel[k]));
  fxLine(ch); render(ch); if(!checkDeath()) setBusy(false);
}
function repeal(i){ if(S.busy) return; const l=S.laws.splice(i,1)[0]; S.memory.push(`ход ${S.turn}: отменил закон «${l.name}»`);
  const ch=change({trust:-2}); line("fx",`Закон «${l.name}» отменён. Люди удивлены: Доверие −2`); render(ch); }

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
    return `<div class="stat ${v<25?"low":""}" title="${s.tip}"><div class="row"><span>${s.name}</span><span><b>${v}</b>${d[k]?`<span class="d ${d[k]>0?"up":"down"}">${sign(d[k])}</span>`:""}</span></div><div class="bar"><i style="width:${v}%"></i></div></div>`;}).join("");
  const era=ERAS[S.eraIdx];
  $("goal").innerHTML=`Цель эпохи: <b class="${era.goal.check(S.stats)?"ok":""}">${era.goal.text}</b> · осталось ходов: ${S.queue.length}`;
  $("council").innerHTML=(Object.keys(ADVISORS).length?"":'<div class="law empty">Советников нет. Ты решаешь один.</div>')+Object.entries(ADVISORS).map(([k,a])=>{
    const r=S.rel[k], m=r>=3?"предан":r>=1?"доволен":r>=-1?"спокоен":r>-4?"недоволен":"враждебен";
    return `<div class="adv ${S.cur?.who===k?"talk":""}"><div class="pic"${a.img?` style="background-image:url(${a.img})"`:""}>${a.img?"":a.ch}</div>
      <div><div class="nm">${a.name}</div><div class="rl">${a.role}</div><div class="mood ${r<0?"down":"up"}">${m} (${sign(r)})</div><div class="perk ${r<=-3?"down":r>=0?"up":""}">${r<=-3?"вредит: "+SLOTS[k].bad:r>=0?"даёт: "+SLOTS[k].good:"обижен, пользы нет"}</div></div><button class="exile" title="Прогнать из совета" onclick="askExile('${k}')">✕</button></div>`;
  }).join("");
  const asg=assign();
  $("units").textContent="";
  $("pop").innerHTML=Object.entries(GROUPS).map(([k,gr])=>'<span>'+gr.name+' <b>'+S.pop[k]+'</b>'+(k!=="kids"&&asg.free[k]?' <i>('+asg.free[k]+' своб.)</i>':'')+'</span>').join("");
  $("jobs").innerHTML=Object.entries(JOBS).map(([k,j])=>
    `<div class="job" data-k="${k}"><span>${j.name}<small>${j.tip}</small></span><span></span>
      <button onclick="setJob('${k}',-1)">−</button><span class="n">${S.jobs[k]}</span><button onclick="setJob('${k}',1)">+</button></div>`).join("");
  $("laws").innerHTML = S.laws.map((l,i)=>`<div class="law" title="${esc(l.text)}"><span>§ ${esc(l.name)}</span><button onclick="repeal(${i})" title="Отменить (Доверие −2)">×</button></div>`).join("") || '<div class="law empty">Законов пока нет</div>';
  const can=S.lawCd<=0&&S.laws.length<4;
  $("lawText").disabled=!can||S.busy; $("lawBtn").disabled=!can||S.busy;
  $("lawText").placeholder = S.laws.length>=4 ? "Не больше 4 законов" : S.lawCd>0 ? `Новый закон через ${S.lawCd} х.` : "«десятая часть добычи — в общий запас»";
  $("builds").innerHTML=BUILDINGS[S.eraIdx].map(b=>{ const has=S.built.some(x=>x.id===b.id);
    return `<div class="bld ${has?"has":""}"><span>${b.name}<small>${b.tip}</small></span>${has?"<b>✓</b>":`<button onclick="build('${b.id}')" ${S.stats.goods<=b.cost?"disabled":""}>${b.cost}</button>`}</div>`;}).join("")
    + (S.built.filter(b=>!BUILDINGS[S.eraIdx].includes(b)).length?`<div class="bld old">Прежние: ${S.built.filter(b=>!BUILDINGS[S.eraIdx].includes(b)).map(b=>b.name).join(", ")}</div>`:"");
  const f=forecast();
  $("forecast").innerHTML=`За ход: еда <b class="${f.food<0?"down":"up"}">${sign(f.food)}</b>, запасы <b class="up">${sign(f.goods)}</b>${S.jobs.guard>=Math.floor(S.stats.people/10)||S.built.some(b=>b.theft)?"":' · <span class="down">стражи мало, будут воровать</span>'}`;
}

function say(who,text,cls=""){
  const n = who==="you" ? ERA_LABELS[S.eraIdx].leader : ADVISORS[who]?.name || "Голос из толпы";
  line("say "+(who==="you"?"you ":"")+cls, `<b>${n}:</b> ${esc(text)}`, true);
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
  overlay(`<div class="title-screen"><h1>Градоначальникъ</h1>
  <div class="sub">Правь от племени у реки до первого банка и узнай, откуда взялись деньги.</div>
  <p>Ты вождь сорока человек. Денег ещё не придумали: есть мясо, шкуры и память о том, кто кому должен. За пять эпох твоё племя может стать городом с монетой, налогами и банком, или развалиться от голода, бунта и жадных советников.</p>
  <p><b>Что ты делаешь:</b></p>
  <ol>
   <li><b>Решаешь, что делать с событием.</b> Можно нажать вариант советника или написать своё решение словами. ИИ поймёт и рассудит честно.</li>
   <li><b>Раскидываешь людей по делам:</b> кто охотится, кто ремесленничает, кто сторожит. Это кормит племя каждый ход.</li>
   <li><b>Издаёшь законы</b> и слушаешь советников. Каждый из них тянет одеяло на себя.</li>
  </ol>
  <p><b>Цель:</b> пройти эпохи, не дав ни одному показателю упасть до нуля, и выполнить цель каждой эпохи. В конце летописец опишет твоё правление и даст тебе прозвище.</p>
  <button onclick="closeOv();startTour()">Показать, как играть</button> <button onclick="closeOv();newGame()">Я разберусь сам</button></div>`);
}

const TOUR=[
  ["#stats","Чем живёт племя","Пять показателей. Если любой упадёт до нуля, правление окончено. Красная рамка значит опасно. Наведи мышь на показатель, чтобы узнать подробнее."],
  ["#goal","Цель эпохи","Её нужно выполнить к последнему ходу. Выполнишь, и следующая эпоха начнётся с бонусом. Здесь же видно, сколько ходов осталось."],
  ["#eventCard","Событие хода","Каждый ход что-то случается: охота, долг, вор, чужаки. Ниже варианты советников."],
  ["#own","Твоё решение","Главное в игре. Не нравятся варианты? Напиши своё, например «простить вора, если отработает неделю у кузнеца». ИИ рассудит, что из этого выйдет."],
  ["#council","Совет","Четыре советника со своими интересами. Они помнят твои решения, обижаются и иногда сами просят тайной встречи, чтобы протолкнуть свою идею."],
  ["#laws","Законы","Постоянные правила, которые ты пишешь сам. ИИ учитывает их во всех следующих событиях. Новый закон можно издать раз в три хода."],
  ["#builds","Постройки","Строятся за запасы и приносят пользу каждый ход до конца игры. В каждой эпохе свои. Все сразу не потянешь, выбирай."],
  [".peoplebox","Люди по делам","Люди разные: на охоту и в стражу идут только мужчины, ремеслу лучше всех учат старики, дети помогают собирать. Раскидай их по делам кнопками − и +. Под списком прогноз еды и запасов за ход. Между эпохами дети взрослеют, а взрослые стареют."],
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
