// Сохранение партии (в браузере игрока) и тестовый режим ?test=1 — переход в любую эпоху.
const SAVE_KEY="grad_save_v2";
const SKIP=new Set(["busy","cur","evNext","audNext","evReady"]);

function saveGame(){
  try{
    const s={}; for(const k in S) if(!SKIP.has(k)) s[k]=S[k];
    s.built=S.built.map(b=>({...b}));
    localStorage.setItem(SAVE_KEY, JSON.stringify({S:s, A:ADVISORS, t:Date.now()}));
  }catch(e){ console.warn("сохранение:", e); }
}
function hasSave(){ try{ return !!JSON.parse(localStorage.getItem(SAVE_KEY)||"null")?.S; }catch(e){ return false; } }
function clearSave(){ localStorage.removeItem(SAVE_KEY); }

// внешний вид эпохи без сброса её хода (фон, цвета, подписи)
function eraLook(){
  const era=ERAS[S.eraIdx]; applyLabels(); document.body.dataset.era=era.id;
  const bg=$("bg"); bg.innerHTML="";
  if(era.video && !matchMedia("(prefers-reduced-motion: reduce)").matches){ const v=document.createElement("video"); v.src=era.video; v.muted=true; v.loop=true; v.autoplay=true; v.playsInline=true; v.setAttribute("playsinline",""); v.poster=era.bg; bg.appendChild(v); v.play().catch(()=>{}); }
  $("era").textContent=era.name; if(era.bg) bg.style.backgroundImage=`url(${era.bg})`;
}

function loadGame(){
  let d; try{ d=JSON.parse(localStorage.getItem(SAVE_KEY)); }catch(e){ return false; }
  if(!d?.S) return false;
  Object.assign(S, d.S, {busy:false, cur:null, evNext:null, audNext:null, evReady:null});
  // постройки текущей эпохи снова те же объекты, что в списке (иначе не отметятся как построенные)
  S.built=S.built.map(b=>BUILDINGS.flat().find(x=>x.id===b.id)||b);
  for(const k in ADVISORS) delete ADVISORS[k];
  for(const k in d.A) ADVISORS[k]={...d.A[k], banter:d.A[k].banter||BANTER[k]};
  eraLook(); render(); nextTurn(); return true;
}

// сохраняемся в начале каждого хода: состояние после прошлого решения
const _nextTurn=nextTurn;
nextTurn=function(){ saveGame(); return _nextTurn(); };
const _checkDeath=checkDeath;
checkDeath=function(){ const dead=_checkDeath(); if(dead) clearSave(); return dead; };

// титульный экран: кнопка «Продолжить», если есть сохранение
const _titleScreen=titleScreen;
titleScreen=function(){
  _titleScreen();
  if(!hasSave()) return;
  const btns=document.querySelector(".title-screen .btns"); if(!btns) return;
  const b=document.createElement("button"); b.className="main"; b.textContent="Продолжить партию";
  b.onclick=()=>{ closeOv(); if(!loadGame()) newGame(); };
  btns.prepend(b);
};

// ---------- тестовый режим: ?test=1 ----------
function jumpEra(i){
  newGame(true); closeOv(); $("log").innerHTML="";
  const joins=[];
  for(let e=0;e<i;e++){
    S.eraIdx=e;
    joins.push(...unlockByKey("era:"+e).joins);
    for(const m of ERAS[e].milestones){ S.ms[m[0]]=true; joins.push(...unlockByKey("ms:"+m[0]).joins); }
  }
  for(const k of new Set(joins)) if(!ADVISORS[k]){ ADVISORS[k]={...BASE_ADVISORS[k], banter:BANTER[k]}; S.rel[k]=1; }
  // народ растёт с эпохами
  S.pop={men:5+3*i, women:5+3*i, elders:3+i, kids:5+2*i};
  S.stats.people=Object.values(S.pop).reduce((a,b)=>a+b,0);
  S.stats.food=50; S.stats.goods=Math.min(100,20+10*i); S.stats.mood=60; S.stats.trust=60;
  S.jobs={hunt:S.pop.men-1, gather:S.pop.women+S.pop.elders+S.pop.kids, craft:0, trade:0, guard:S.open.jobs.includes("guard")?1:0};
  if(!assign().ok) S.jobs={hunt:S.pop.men, gather:S.pop.women+S.pop.elders+S.pop.kids, craft:0, trade:0, guard:0};
  S.tutorial=false; S.eraIdx=i; startEra();
}
if(/[?&]test=1/.test(location.search)){
  const p=document.createElement("div"); p.id="testPanel";
  p.style.cssText="position:fixed;left:8px;bottom:8px;z-index:9999;background:#000c;color:#fff;padding:6px 8px;border-radius:8px;font:13px sans-serif";
  p.innerHTML=`Тест: <select id="testEra">${ERAS.map((e,i)=>`<option value="${i}">${i+1}. ${e.name}</option>`).join("")}</select> <button id="testGo">Перейти</button> <button id="testWipe" title="Стереть сохранение">⟲</button>`;
  document.body.appendChild(p);
  $("testGo").onclick=()=>jumpEra(+$("testEra").value);
  $("testWipe").onclick=()=>{ clearSave(); titleScreen(); };
}

titleScreen();
