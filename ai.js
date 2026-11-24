// ИИ-судья. Запрос идёт на наш прокси (ключ живёт только там).
// Если прокси не задан или не ответил, работает запасной разбор без ИИ.
const BASE_NAMES={hort:"Хорт",vedana:"Ведана",miron:"Мирон",gost:"Гостомысл"};
const AI = {
  // Два прокси: Cloudflare и Vercel. Пробуем по очереди, запоминаем тот, что ответил.
  PROXIES: ["https://functions.yandexcloud.net/d4e0d2fkg4fnfc4dstv3", "https://gradonachalnik.vercel.app/api/judge", "https://gradonachalnik.baddrummer14.workers.dev"],
  get PROXY_URL(){ return this.PROXIES[0]; },
  TIMEOUT_MS: 30000,

  buildPrompt(state, ev, text){
    const adv = Object.entries(ADVISORS).map(([k,a])=>
      `${k}: ${a.name}, ${a.role}; хочет ${a.wants}; говорит ${a.voice}; отношение к вождю ${state.rel[k]}`).join("\n");
    return `Ты строгий, но честный судья в игре про историю денег. Эпоха: ${state.eraName}.
Показатели (0-100): ${Object.entries(state.stats).map(([k,v])=>k+"="+v).join(", ")}.
Советники:\n${adv}
Что вождь делал раньше: ${state.memory.slice(-8).join("; ")||"ничего"}.
${this.lawsLine(state)}
${this.popLine(state)}
Событие: ${ev.title}. ${ev.text}
Решение вождя своими словами: "${text}"

Правила: у каждого решения есть цена. Невозможное (нет таких ресурсов, не по эпохе) не исполняется: советник объясняет почему, эффекты почти нулевые. Щедрость без источника бьёт по запасам. Каждое изменение от -12 до +12.
Ответь ТОЛЬКО JSON:
{"possible":true,"fx":{"food":0,"goods":0,"mood":0,"trust":0,"people":0},"rel":{"hort":0,"vedana":0,"miron":0,"gost":0},
"lines":[{"who":"hort|vedana|miron|gost","text":"реплика 1-2 предложения"}],
"narration":"что произошло, 1-2 предложения, живо, без пафоса","mem":"кратко, что решил вождь (до 8 слов)",
"removed":""}
Если решение вождя убирает советника из совета (казнь, изгнание, смерть, уход), впиши его ключ в "removed" (hort|vedana|miron|gost), иначе оставь пустым.`;
  },

  async judge(state, ev, text){
    this.lastError = "";
    const txt=await this.post(this.buildPrompt(state,ev,text));
    if(txt){ const out=this.parse(txt); if(out) return {...out, source:"ai"}; this.lastError="непонятный ответ ИИ"; }
    console.warn("ИИ:", this.lastError);
    return this.offline(ev, text);
  },

  async post(prompt){
    let last="";
    for(let attempt=0; attempt<2; attempt++){
      for(let i=0;i<this.PROXIES.length;i++){
        const url=this.PROXIES[i];
        try{
          const r=await fetch(url,{method:"POST",signal:AbortSignal.timeout(attempt?20000:12000),headers:{"Content-Type":"application/json"},body:JSON.stringify({prompt})});
          const j=await r.json().catch(()=>({}));
          if(r.ok&&j.text){ if(i>0){ this.PROXIES.splice(i,1); this.PROXIES.unshift(url); } return j.text; }
          last=url+": "+r.status+" "+(j.error||"");
        }catch(e){ last=url+": "+e.name; }
      }
    }
    this.lastError=last; return null;
  },

  // Сырой запрос к прокси: вернёт объект из JSON или null.
  async raw(prompt){
    const txt=await this.post(prompt); if(!txt) return null;
    try{ const m=txt.match(/{[sS]*}/); return m?JSON.parse(m[0]):null; }catch(e){ return null; }
  },

  popLine(state){ return state.pop ? `Состав людей: мужчин ${state.pop.men}, женщин ${state.pop.women}, стариков ${state.pop.elders}, детей ${state.pop.kids}. Учитывай, кто реально может исполнить решение (охота и стража — мужчины, дети не работают в полную силу).` : ""; },
  lawsLine(state){ return state.laws?.length ? `Действующие законы вождя (их нарушение или исполнение должно влиять на исход): ${state.laws.map(l=>`«${l.name}: ${l.text}»`).join("; ")}.` : "Законов пока нет."; },
  ctx(state){ return `Игра про историю денег. Эпоха: ${state.eraName}. Показатели (0-100): ${Object.entries(state.stats).map(([k,v])=>k+"="+v).join(", ")}.
Советники: ${Object.entries(ADVISORS).map(([k,a])=>`${k}=${a.name} (${a.role}, отношение ${state.rel[k]})`).join("; ")}.
Что вождь делал раньше: ${state.memory.slice(-10).join("; ")||"ничего"}.
${this.lawsLine(state)}
${this.popLine(state)}`; },
  clampFx(fx,m=10){ return Object.fromEntries(Object.keys(STATS).map(k=>[k,Math.max(-m,Math.min(m,Math.round(+fx?.[k]||0)))])); },
  clampRel(r){ return Object.fromEntries(Object.keys(ADVISORS).map(k=>[k,Math.max(-2,Math.min(2,Math.round(+r?.[k]||0)))])); },

  // Новый закон своими словами: ИИ даёт ему короткое имя и считает первую реакцию племени.
  async law(state, text){
    const j = await this.raw(`${this.ctx(state)}
Вождь издаёт постоянный закон своими словами: "${text}".
Оцени честно: закон по эпохе? Кому выгоден, кто недоволен? Невозможный или бессмысленный закон не принимается (accepted:false), советник объясняет почему.
Ответь ТОЛЬКО JSON: {"accepted":true,"name":"короткое имя закона, 2-4 слова","fx":{"food":0,"goods":0,"mood":0,"trust":0,"people":0},"rel":{"hort":0,"vedana":0,"miron":0,"gost":0},
"lines":[{"who":"hort|vedana|miron|gost","text":"реакция 1-2 предложения"}],"narration":"как племя приняло закон, 1 предложение"}
Эффекты от -8 до +8.`);
    if(!j) return null;
    return {accepted:j.accepted!==false, name:String(j.name||text).slice(0,40), fx:this.clampFx(j.fx,8), rel:this.clampRel(j.rel),
      lines:(j.lines||[]).filter(l=>ADVISORS[l.who]).slice(0,2), narration:String(j.narration||"")};
  },

  // Событие, придуманное ИИ по истории правления: последствия прошлых решений, законы, обиды советников.
  async event(state){
    const j = await this.raw(`${this.ctx(state)}
Придумай новое событие для племени. Оно должно вырасти из прошлых решений вождя, его законов или обид советников (назови это прямо), и быть про хозяйство, обмен, долги, плату или справедливость — зачатки экономики. По эпохе: денег и металла ещё нет.
Ответь ТОЛЬКО JSON: {"title":"2-4 слова","who":"hort|vedana|miron|gost","text":"что случилось, 2-3 предложения, живо","hist":"реальный исторический факт на эту тему, 1-2 предложения, только проверенное (народ, век, событие)",
"choices":[{"t":"вариант","fx":{"food":0,"goods":0,"mood":0,"trust":0,"people":0},"rel":{"hort":0,"vedana":0,"miron":0,"gost":0},"mem":"до 8 слов"}, ... всего 3 варианта]}
Эффекты от -8 до +8, у каждого варианта своя цена.`);
    if(!j||!j.title||!Array.isArray(j.choices)||j.choices.length<2) return null;
    return {title:String(j.title).slice(0,60), who:ADVISORS[j.who]?j.who:Object.keys(ADVISORS)[0], text:String(j.text||"").slice(0,400), hist:String(j.hist||"").slice(0,400), source:"ai",
      choices:j.choices.slice(0,3).map(c=>({t:String(c.t).slice(0,90), mem:String(c.mem||c.t).slice(0,80), fx:this.clampFx(c.fx,8), rel:this.clampRel(c.rel)}))};
  },

  // Летопись правления в духе древней рукописи + прозвище правителя.
  async chronicle(state, ending){
    const j = await this.raw(`${this.ctx(state)}
Все решения вождя: ${state.memory.join("; ")}.
Итог: ${ending}.
Напиши летопись этого правления в духе древнерусской летописи, но понятным языком, 4-6 предложений, с иронией, опираясь на конкретные решения. И дай вождю прозвище по делам (как «Щедрый», «Простивший вора», «Скупой на соль»).
Ответь ТОЛЬКО JSON: {"nickname":"прозвище","text":"летопись"}`);
    return j&&j.text ? {nickname:String(j.nickname||"").slice(0,40), text:String(j.text).slice(0,1200)} : null;
  },

  // Новый советник на место изгнанного: характер придумывает ИИ
  async newAdvisor(state, oldName, oldRole){
    const j = await this.raw(`${this.ctx(state)}
Вождь прогнал советника ${oldName} (${oldRole}). Придумай нового советника на это место, по эпохе, с ярким характером и своим интересом (карьерист). Славянское имя.
Ответь ТОЛЬКО JSON: {"name":"имя","role":"кто он, 3-6 слов","wants":"чего хочет, коротко","voice":"как говорит, 2-4 слова","hello":"первая фраза вождю, 1-2 предложения"}`);
    if(!j||!j.name) return null;
    const s=v=>String(v||"").slice(0,80);
    return {name:s(j.name).slice(0,20), role:s(j.role), wants:s(j.wants), voice:s(j.voice), hello:s(j.hello).slice(0,200)};
  },

  // Частная аудиенция: советник-карьерист сам предлагает идею в свою пользу.
  async audience(state, who){
    const a=ADVISORS[who];
    const j = await this.raw(`Игра про историю денег. Эпоха: ${state.eraName}. Показатели (0-100): ${Object.entries(state.stats).map(([k,v])=>k+"="+v).join(", ")}.
Советник ${a.name}, ${a.role}. Хочет ${a.wants}. Говорит ${a.voice}. Отношение к вождю ${state.rel[who]} (от -5 до 5).
Что вождь делал раньше: ${state.memory.slice(-6).join("; ")||"ничего"}.
${a.name} карьерист и просит частной аудиенции: предлагает вождю конкретную идею, выгодную прежде всего себе (власть, доля, право решать), но с пользой и для племени. Идея по эпохе (без денег и металла, если их ещё нет), может опираться на прошлые решения вождя. Если отношение плохое, может намекнуть на угрозу.
Ответь ТОЛЬКО JSON: {"title":"короткий заголовок","text":"прямая речь советника 2-3 предложения, живо, без пафоса",
"choices":[{"t":"согласиться (суть)","fx":{"food":0,"goods":0,"mood":0,"trust":0,"people":0},"rel":{"${who}":2},"mem":"до 8 слов"},
{"t":"отказать","fx":{...},"rel":{"${who}":-1},"mem":"..."}, {"t":"третий вариант-компромисс","fx":{...},"rel":{...},"mem":"..."}]}
Эффекты от -8 до +8, сумма плюсов у согласия не больше +10: выгода всегда с ценой (что-то падает).`);
    if(!j||!j.title||!Array.isArray(j.choices)||!j.choices.length){ if(!AUDIENCES[who]||BASE_NAMES[who]!==a.name) return null; return {...AUDIENCES[who], who, source:"offline"}; }
    const clamp=v=>Math.max(-10,Math.min(10,Math.round(+v||0)));
    return {who, title:String(j.title).slice(0,60), text:String(j.text||"").slice(0,400), source:"ai",
      choices:j.choices.slice(0,3).map(c=>({t:String(c.t).slice(0,90), mem:String(c.mem||c.t).slice(0,80),
        fx:Object.fromEntries(Object.keys(STATS).map(k=>[k,clamp(c.fx?.[k])])),
        rel:Object.fromEntries(Object.keys(ADVISORS).map(k=>[k,Math.max(-2,Math.min(2,Math.round(+c.rel?.[k]||0)))]))}))};
  },

  parse(raw){
    try{
      const m = raw.match(/\{[\s\S]*\}/); if(!m) return null;
      const j = JSON.parse(m[0]);
      const clamp = v => Math.max(-12, Math.min(12, Math.round(+v||0)));
      const fx={}, rel={};
      for(const k in STATS) fx[k]=clamp(j.fx?.[k]);
      for(const k in ADVISORS) rel[k]=Math.max(-2,Math.min(2,Math.round(+j.rel?.[k]||0)));
      const lines=(j.lines||[]).filter(l=>ADVISORS[l.who]).slice(0,3);
      return {fx, rel, lines, narration:String(j.narration||""), mem:String(j.mem||"принял своё решение").slice(0,80), removed:ADVISORS[j.removed]?j.removed:""};
    }catch(e){ return null; }
  },

  // Без ИИ: ищем ближайший готовый вариант по словам, иначе средний исход.
  offline(ev, text){
    const words = text.toLowerCase().split(/[^а-яёa-z]+/).filter(w=>w.length>3);
    let best=null, score=0;
    for(const c of ev.choices){
      const ct=c.t.toLowerCase();
      const s=words.filter(w=>ct.includes(w.slice(0,5))).length;
      if(s>score){score=s;best=c;}
    }
    if(best) return {fx:{...best.fx}, rel:{...(best.rel||{})}, flag:best.flag, later:best.later,
      lines:[{who:ev.who,text:"Понял тебя, вождь. Сделаем так."}],
      narration:"Племя исполнило волю вождя.", mem:best.mem, source:"offline"};
    return {fx:{trust:-1}, rel:{}, lines:[{who:ev.who,text:"Не очень понял, вождь. Сделали как смогли, люди в недоумении."}],
      narration:"Решение вышло туманным, каждый понял его по-своему.", mem:"принял туманное решение: "+text.slice(0,40), source:"offline"};
  }
};
