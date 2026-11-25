// Звук: музыка своей эпохи (Suno) и короткие эффекты. Включается после первого нажатия (так требуют браузеры).
const SND = {
  on: localStorage.getItem("grad_sound")!=="off",
  music: new Audio(), cur: -1, fx: {}, gain:{good:0.3, milestone:0.4, law:0.45, guest:0.45, war:0.45, click:0.5, pebble:0.6},
  play(name, vol=0.6){ if(!this.on) return; const src=this.fx[name]||(this.fx[name]=new Audio("snd/"+name+".mp3?v=2"));
    const a=src.cloneNode(); a.volume=Math.min(1,vol*(this.gain[name]||0.55)); a.play().catch(()=>{}); },
  era(i){ if(this.cur===i && !this.music.paused) return; this.cur=i; if(!this.on) return;
    const m=this.music; m.loop=true; m.volume=0; m.src="snd/era"+(i+1)+".mp3?v=2"; m.play().catch(()=>{});
    let v=0; const t=setInterval(()=>{ v+=0.02; m.volume=Math.min(0.35,v); if(v>=0.35) clearInterval(t); },120); },
  toggle(){ this.on=!this.on; localStorage.setItem("grad_sound", this.on?"on":"off");
    if(this.on){ this.cur=-1; this.era(S.eraIdx); } else this.music.pause(); $("sndBtn").textContent=this.on?"🔊":"🔇"; }
};
// первое нажатие где угодно — запускаем музыку текущей эпохи
addEventListener("pointerdown", ()=>SND.era(S.eraIdx), {once:true});
// мягкий стук на любую кнопку
document.addEventListener("click", e=>{ const b=e.target.closest("button"); if(!b||b.id==="sndBtn") return;
  if(/setJob/.test(b.getAttribute("onclick")||"")) SND.play("pebble",0.5); else SND.play("click",0.4); }, true);

const _startEra=startEra; startEra=function(){ _startEra(); SND.era(S.eraIdx); };
const _nextTurnS=nextTurn; nextTurn=function(){ SND.play("turn",0.5); return _nextTurnS(); };

const sb=document.createElement("button"); sb.id="sndBtn"; sb.title="Звук вкл/выкл"; sb.textContent=SND.on?"🔊":"🔇";
sb.style.cssText="position:fixed;right:10px;bottom:10px;z-index:9999;width:40px;height:40px;border-radius:50%;border:0;background:#000a;color:#fff;font-size:18px;cursor:pointer";
sb.onclick=()=>SND.toggle(); document.body.appendChild(sb);
const _exile=exile; exile=function(k,b){ SND.play("exile",0.6); return _exile(k,b); };

// эффекты на события игры (файлы snd/*.mp3; если файла нет — просто тишина)
const _markMs=markMs; markMs=async function(id){ const had=S.ms[id]; const r=await _markMs(id); if(!had&&S.ms[id]) SND.play("milestone",0.7); return r; };
const _glow=glowScene; glowScene=function(k){ SND.play(k==="good"?"good":"bad",0.5); return _glow(k); };
const _build=build; build=function(id){ const n=S.built.length; const r=_build(id); if(S.built.length>n) SND.play("build",0.6); return r; };
const _joins=showJoins; showJoins=function(j){ if(j?.length) SND.play("join",0.6); return _joins(j); };
const _fight=fight; fight=function(res){ SND.play("war",0.7); return _fight(res); };
const _newLaw=newLaw; newLaw=async function(){ const n=S.laws.length; const r=await _newLaw(); if(S.laws.length>n) SND.play("law",0.7); return r; };
const _checkDeathS=checkDeath; checkDeath=function(){ const d=_checkDeathS(); if(d){ SND.play("lose",0.7); SND.music.pause(); } return d; };
const _showEventS=showEvent; showEvent=function(kind,aud){ const r=_showEventS(kind,aud); if(S.cur?.guest) SND.play("guest",0.7); return r; };
