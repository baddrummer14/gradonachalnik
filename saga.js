// Сквозная линия партии: испытание в конце каждой эпохи, наследие между эпохами, счёт правления.
// Испытание проверяет то, что игрок построил и накопил за эпоху; наследие выбирается из пройденных вех.

const hasB = id => S.built.some(b=>b.id===id);
const warPower = () => S.jobs.guard*2 + (S.jobs.army||0)*3 + (S.built.some(b=>b.theft)?4:0) + Math.floor(S.pop.men/4);
const advOk = k => ADVISORS[k] && S.rel[k]>=1;
const advName = (k,alt) => ADVISORS[k] ? ADVISORS[k].name : alt;

const TRIAL_HINT = [
  "зверь уйдёт от реки. Пригодятся запас еды, добрые соседи и верный охотник.",
  "засуха. Пригодятся скот, общий амбар и жрица на твоей стороне.",
  "набег горцев. Пригодятся стража, стена и казна.",
  "война с соседним городом. Пригодятся войско, казна и доверие людей.",
  "чёрный мор. Пригодятся доверие людей, госпиталь и слово настоятельницы.",
  "биржевой крах. Пригодятся полная казна и доверие."
];

function makeTrial(){
  const s=S.stats, e=S.eraIdx, p=warPower(), n3=Math.max(9,Math.round(s.people/5)), n4=Math.max(12,Math.round(s.people/4.5)), pay3=Math.max(18,Math.round(s.goods*0.4)), pay4=Math.max(24,Math.round(s.goods*0.5));
  const T=[
   {title:"Зверь ушёл", text:`Стада ушли за реку, охотники возвращаются с пустыми руками. До тепла далеко. У тебя еды ${s.food}.`,
    hist:"Охотники-собиратели жили движением зверя: когда стада уходили, племя либо шло следом, либо жило запасом и помощью соседей.",
    choices:[
     {t:"Жить запасом и ждать", hint:"нужно еды от 40", test:()=>s.food>=40, win:{fx:{food:-12,trust:+2}, n:"Запаса хватило. Племя дождалось тепла и запомнило, кто велел копить."}, lose:{fx:{food:-15,people:-3,mood:-5}, n:"Запас кончился раньше холодов. Не все дожили до весны."}},
     {t:"Просить мяса у соседей", hint:"нужна веха «Первый обмен»", test:()=>!!S.ms.trade, win:{fx:{goods:-4,food:+8,trust:+2}, n:"Соседи помнят честный обмен и поделились мясом. Шкуры ушли в уплату."}, lose:{fx:{food:-8,mood:-4,trust:-3}, n:"Соседи вас не знают и прогнали от своих костров."}},
     {t:"Идти за стадом всем племенем", hint:`нужно расположение охотника (${advName("hort","его нет в совете")})`, test:()=>advOk("hort"), win:{fx:{food:+8,mood:-2}, n:"Охотники вывели племя на след. Дорога далась тяжело, но мясо есть."}, lose:{fx:{food:-6,people:-2,mood:-4}, n:"Вести было некому: шли наугад и потеряли людей на переправе."}}]},
   {title:"Засуха", text:`Дождей нет второй месяц, посевы горят. У тебя еды ${s.food}.`,
    hist:"Первые земледельцы зависели от одного урожая. Поэтому общие запасы зерна и стада появились почти одновременно с полями.",
    choices:[
     {t:"Резать скот", hint:"нужна веха «Приручить скот» или загон", test:()=>!!S.ms.herd||hasB("pen"), win:{fx:{food:+6,goods:-3}, n:"Стадо спасло людей. Его стало меньше, но народ цел."}, lose:{fx:{food:-12,people:-3,mood:-4}, n:"Резать некого. Голод пришёл в каждый дом."}},
     {t:"Открыть общий амбар", hint:"нужна веха «Первый амбар» и еды от 45", test:()=>!!S.ms.granary&&s.food>=45, win:{fx:{food:-14,trust:+3,mood:+1}, n:"Амбар открыли и делили по ртам. Хватило всем."}, lose:{fx:{food:-14,people:-2,mood:-6,trust:-3}, n:"Запаса не хватило, у амбара дрались."}},
     {t:"Молить о дожде всем народом", hint:`нужно расположение жрицы (${advName("vedana","её нет в совете")}) или святилище`, test:()=>advOk("vedana")||hasB("shrine"), win:{fx:{food:-8,mood:+4}, n:"Дождь пришёл поздно, но люди держались вместе и не разбрелись."}, lose:{fx:{food:-8,mood:-8,trust:-4}, n:"Молились вразнобой, и каждый винил соседа. Многие ушли искать воду сами."}}]},
   {title:"Набег горцев", text:`С гор спустилось войско, идёт на город. Твоя сила ${p}: воин считается за троих, стражник за двоих, стена даёт 4, ещё каждый четвёртый мужчина возьмёт копьё. У врага ${n3}. Казны ${s.goods}, еды ${s.food}.`,
    hist:"Города Междуречья веками жили под угрозой набегов с гор. Около XXII века до н. э. горцы-гутии разорили Аккад.",
    choices:[
     {t:"Встретить у ворот", hint:`твоя сила ${p}, нужно ${n3}`, test:()=>p>=n3, win:{fx:{trust:+3,goods:+4,people:-1}, n:"Стража выстояла. Горцы ушли, бросив обоз."}, lose:{fx:{people:-5,goods:-10,trust:-4,mood:-4}, n:"Стражи не хватило. Город разграблен."}},
     {t:"Откупиться серебром", hint:`отдашь ${pay3} казны`, test:()=>s.goods>pay3+5, win:{fx:{goods:-pay3,trust:-4}, n:"Горцы взяли серебро и ушли. Дорого, но все живы."}, lose:{fx:{goods:-10,people:-3,trust:-5}, n:"Серебра оказалось мало. Забрали, что нашли, и увели людей."}},
     {t:"Закрыть ворота и ждать", hint:"нужна городская стена и еды от 40", test:()=>hasB("wall")&&s.food>=40, win:{fx:{food:-10,trust:+3}, n:"Стена выдержала, еды хватило. Горцы постояли и ушли."}, lose:{fx:{food:-10,goods:-8,people:-2,mood:-5}, n:"Отсидеться не вышло: без стены и запаса осаду не держат."}}]},
   {title:"Война с соседним городом", text:`Соседний город объявил войну из-за рудников. Твоя сила ${p} (воин за троих, стражник за двоих, стена 4, каждый четвёртый мужчина), у врага ${n4}. Казны ${s.goods}, доверия ${s.trust}.`,
    hist:"Греческие города воевали друг с другом почти без перерыва. На наёмников и флот уходила большая часть их казны.",
    choices:[
     {t:"Вывести войско", hint:`твоя сила ${p}, нужно ${n4}`, test:()=>p>=n4, win:{fx:{trust:+3,goods:+5,people:-2}, n:"Войско победило. Рудники твои."}, lose:{fx:{people:-6,mood:-6,trust:-5}, n:"Войско разбито. Город платит победителю людьми."}},
     {t:"Нанять наёмников", hint:`стоит ${pay4} казны`, test:()=>s.goods>pay4+5, win:{fx:{goods:-pay4,trust:-1}, n:"Наёмники сделали своё дело и ушли с твоим серебром."}, lose:{fx:{people:-4,mood:-5,trust:-6}, n:"Платить нечем. Наёмники перешли к врагу."}},
     {t:"Послать послов и мириться", hint:"нужно доверия от 60", test:()=>s.trust>=60, win:{fx:{goods:-6,trust:+1,mood:+2}, n:"Народ поддержал мир. Рудники поделили."}, lose:{fx:{people:-3,mood:-4,trust:-6}, n:"Свои же назвали мир трусостью. Послов не слушали ни дома, ни у соседей."}}]},
   {title:"Чёрный мор", text:`С кораблей в город пришла чума. У тебя доверия ${s.trust}, казны ${s.goods}.`,
    hist:"Слово «карантин» пришло из Венеции: quaranta giorni, сорок дней, корабли стояли на рейде, прежде чем войти в порт.",
    choices:[
     {t:"Закрыть ворота на сорок дней", hint:"нужно доверия от 55", test:()=>s.trust>=55, win:{fx:{goods:-8,people:-2,trust:+3}, n:"Люди послушались. Торговля встала, но город выжил."}, lose:{fx:{people:-8,mood:-6,trust:-4}, n:"Запрету не поверили и ходили через стену. Мор прошёл по всем улицам."}},
     {t:"Лечить в госпитале", hint:"нужен госпиталь", test:()=>hasB("hospital"), win:{fx:{goods:-4,people:-2,mood:+3}, n:"Больных отделили и выходили многих."}, lose:{fx:{people:-9,mood:-5}, n:"Госпиталя нет. Больные лежали в домах рядом со здоровыми."}},
     {t:"Молебны и крестный ход", hint:`нужно расположение настоятельницы (${advName("vedana","её нет в совете")})`, test:()=>advOk("vedana"), win:{fx:{people:-5,mood:+4}, n:"Мор взял своё, но город не впал в отчаяние."}, lose:{fx:{people:-9,mood:-6,trust:-3}, n:"Толпа на площади разнесла заразу, а утешить людей было некому."}}]},
   {title:"Биржевой крах", text:`Бумаги на бирже упали вдвое за день, у банка очередь. У тебя казны ${s.goods}, вкладов ${S.bank?S.bank.dep:0}, доверия ${s.trust}.`,
    hist:"Панику 1907 года в США остановил банкир Дж. П. Морган, собрав деньги крупных банков. После неё создали Федеральную резервную систему.",
    choices:[
     {t:"Выдавать вклады всем без отказа", hint:"нужно казны от 40 и не меньше вкладов", test:()=>s.goods>=40&&s.goods>=(S.bank?S.bank.dep:0), win:{fx:{goods:-15,trust:+4}, n:"Очередь увидела, что деньги есть, и разошлась."}, lose:{fx:{trust:-10,mood:-6}, n:"Касса опустела к полудню. Двери закрыли перед толпой."}},
     {t:"Закрыть биржу и банки на неделю", hint:"нужно доверия от 55", test:()=>s.trust>=55, win:{fx:{trust:-3,mood:-2}, n:"Тебе поверили и переждали. Через неделю страх прошёл."}, lose:{fx:{trust:-9,mood:-7}, n:"Закрытые двери приняли за признание: денег нет."}},
     {t:"Допечатать бумажных денег", hint:"сработает всегда, но деньги подешевеют", test:()=>true, win:{fx:{goods:+10,trust:-6,food:-4}, n:"Вкладчикам выдали всё, новыми бумажками. Цены поползли вверх.", infl:3}}]}
  ];
  const t=T[e]; t.trial=true; t.who=Object.keys(ADVISORS)[0];
  t.choices.forEach(c=>{ c.t=`${c.t} (${c.hint})`; });
  return t;
}

// ход-испытание: после последнего события эпохи
const _nextTurnSaga=nextTurn;
nextTurn=function(){
  if(!S.queue.length && !S.trialDone){
    S.trialDone=true; $("audPic")?.remove(); returnAway(); $("log").innerHTML=""; $("nextBtn").classList.add("hidden");
    S.cur=makeTrial(); S.turn++; if(S.lawCd>0) S.lawCd--;
    showEvent("Испытание эпохи"); return;
  }
  return _nextTurnSaga();
};
const _applyS=apply;
apply=function(res){
  if(S.cur?.trial){
    S.trials=S.trials||{};
    if(res.test){ const ok=!!res.test(), o=ok?res.win:res.lose; res.fx={...o.fx}; res.narration=o.n; if(o.infl) S.infl=o.infl;
      res.mem=(ok?"выдержал":"не выдержал")+" испытание «"+S.cur.title+"»"; S.trials[S.eraIdx]=ok; }
    else { const sum=Object.values(res.fx||{}).reduce((a,b)=>a+b,0); S.trials[S.eraIdx]=sum>=-4; }   // своё решение судит ИИ
    const ok=S.trials[S.eraIdx];
    setTimeout(()=>{ glowScene(ok?"good":"bad"); toast(ok?"<b>Испытание выдержано</b>":"<b>Испытание не выдержано</b><br>Народ входит в новую эпоху потрёпанным", ok?"ms":""); },300);
  }
  return _applyS(res);
};

// вход в эпоху: лишнее событие из запаса и предупреждение об испытании
const EXTRA_SKIP=["thief","furs","prince_feast","birchbark","hunt"];
if(typeof POOL!=="undefined" && POOL.wall) POOL.wall.text=POOL.wall.text.replace("князь","царь");
const _startEraS=startEra;
startEra=function(){
  _startEraS(); S.trialDone=false;
  const era=ERAS[S.eraIdx], ex=(era.extra||[]).filter(x=>!EXTRA_SKIP.includes(x.id)&&!S.queue.includes(x));
  const pick=shuffle(ex).slice(0,2); pick.forEach((x,i)=>S.queue.splice(Math.min(2+i*3,S.queue.length),0,x));
  $("eraGo")?.insertAdjacentHTML("beforebegin",`<p><b>В конце эпохи народ ждёт испытание.</b> Какое, никто не знает: копи запасы, держи стражу и не ссорься с советом.</p>`);
  render();
};
const _newGameS=newGame;
newGame=function(silent){ S.trials={}; S.legacy=[]; S.trialDone=false; return _newGameS(silent); };

// ---------- наследие эпохи: одно из трёх, по пройденным вехам ----------
const LEGACY=[
  [{ms:"share", n:"Обычай дележа", eff:{mood:1}, trait:"faith"}, {ms:"trade", n:"Дружба с соседями", eff:{goods:1}, trait:"trade"}, {ms:"winter", n:"Зимние кладовые", eff:{food:1}, trait:"law"}],
  [{ms:"herd", n:"Большие стада", eff:{food:1}, trait:"war"}, {ms:"granary", n:"Общий амбар", eff:{trust:1}, trait:"law"}, {ms:"settle", n:"Праздник урожая", eff:{mood:1}, trait:"faith"}],
  [{ms:"law", n:"Писаный закон", eff:{trust:1}, trait:"law"}, {ms:"scribe", n:"Счёт и письмо", eff:{goods:1}, trait:"trade"}, {ms:"temple", n:"Храмовые житницы", eff:{food:1}, trait:"faith"}],
  [{ms:"coin", n:"Свой чекан", eff:{goods:1}, trait:"trade"}, {ms:"tax", n:"Постоянное войско", eff:{trust:1}, trait:"war"}, {ms:"honest", n:"Слово правителя", eff:{mood:1}, trait:"law"}],
  [{ms:"road", n:"Дорожная стража", eff:{trust:1}, trait:"war"}, {ms:"bill", n:"Вексельное право", eff:{goods:1}, trait:"trade"}, {ms:"fair", n:"Городские вольности", eff:{mood:1}, trait:"law"}]
];
const effText = eff => Object.entries(eff).map(([k,v])=>sign(v)+" "+STATS[k].name.toLowerCase()).join(", ")+" каждый ход до конца игры";
const _endEraS=endEra;
endEra=async function(){
  await _endEraS();
  const e=S.eraIdx, box=$("ovBox"), tr=(S.trials||{})[e];
  if(tr!==undefined && tr!==null) box.querySelector(".msres")?.insertAdjacentHTML("afterend",`<p class="${tr?"up":"down"}"><b>Испытание эпохи ${tr?"выдержано":"не выдержано"}.</b></p>`);
  const L=LEGACY[e]; if(!L) return;
  const btn=[...box.querySelectorAll("button")].pop(); if(!btn) return;
  if(!L.some(l=>S.ms[l.ms])) return;
  const ok=ERAS[e].goal.check(S.stats);
  btn.outerHTML=`<div class="nation"><h3>Наследие эпохи</h3><p>Выбери одно, что народ унесёт в следующие эпохи. Доступно то, чьи вехи пройдены.</p>
    <div class="talkopts">${L.map((l,i)=>S.ms[l.ms]?`<button onclick="takeLegacy(${i},${ok})"><b>${l.n}</b>: ${effText(l.eff)}</button>`:`<button disabled>☆ ${l.n}: веха не пройдена</button>`).join("")}</div></div>`;
};
function takeLegacy(i,ok){
  const l=LEGACY[S.eraIdx][i]; S.built.push({id:"leg_"+S.eraIdx+"_"+i, name:l.n, eff:l.eff});
  if(S.traits[l.trait]!==undefined) S.traits[l.trait]+=2;
  (S.legacy=S.legacy||[]).push(l.n); S.memory.push(`наследие эпохи: «${l.n}»`);
  closeOv(); nextEra(ok);
}

// ---------- счёт правления и память о прошлой партии ----------
const HIST_KEY="gradonachalnik-hist";
const readHist = () => { try{ return JSON.parse(localStorage.getItem(HIST_KEY))||{}; }catch(e){ return {}; } };
function reignScore(){
  const ms=Object.values(S.ms).filter(Boolean).length, tr=Object.values(S.trials||{}).filter(Boolean).length;
  const total=ms*10 + tr*15 + S.eraIdx*10 + Math.round(S.stats.people/2) + Math.round(S.stats.trust/2);
  const rank= total>=350?"Великий градоначальник": total>=270?"Государь": total>=180?"Правитель": total>=90?"Староста":"Вожак на час";
  return {total, rank, ms, tr};
}
function scoreHtml(){
  const sc=reignScore(), h=readHist(), best=Math.max(h.best||0, sc.total);
  try{ localStorage.setItem(HIST_KEY, JSON.stringify({best, last:{score:sc.total, rank:sc.rank, era:ERAS[S.eraIdx].name, t:Date.now()}})); }catch(e){}
  return `<div class="nation"><h3>Счёт правления: ${sc.total} — ${sc.rank}</h3>
    <p>Вех пройдено: ${sc.ms} из 18 · испытаний выдержано: ${sc.tr} из 6 · эпох позади: ${S.eraIdx}${(S.legacy||[]).length?`<br>Наследие: ${S.legacy.join(", ")}`:""}</p>
    <p>${h.best?(sc.total>h.best?`Новый лучший счёт. Прежний был ${h.best}.`:`Лучший счёт: ${best}.`):"Это твоё первое правление. Сыграй ещё и побей свой счёт."}</p></div>`;
}
const _overlayS=overlay;
overlay=function(h){ if(/Правление окончено|class="nation"><h3>Твой народ/.test(h)) h=h.replace(/<button/, scoreHtml()+"<button"); return _overlayS(h); };
const _chronS=AI.chronicle.bind(AI);
AI.chronicle=async function(state, ending){ const c=await _chronS(state, ending);
  try{ const h=readHist(); if(c&&c.nickname&&h.last&&Date.now()-h.last.t<180000){ h.last.nick=c.nickname; localStorage.setItem(HIST_KEY, JSON.stringify(h)); } }catch(e){}
  return c; };
const _titleScreenS=titleScreen;
titleScreen=function(){ _titleScreenS(); const h=readHist(), b=document.querySelector(".title-screen .btns"); if(!h.last||!b) return;
  b.insertAdjacentHTML("beforebegin",`<p class="end">Прошлое правление: ${h.last.rank}${h.last.nick?" «"+esc(h.last.nick)+"»":""}, счёт ${h.last.score} (${h.last.era}). Лучший счёт: ${h.best}.</p>`); };
