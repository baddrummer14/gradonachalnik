// Звук: музыка своей эпохи (Suno) и короткие эффекты. Включается после первого нажатия (так требуют браузеры).
const SND = {
  on: localStorage.getItem("grad_sound")!=="off",
  music: new Audio(), cur: -1, fx: {},
  play(name, vol=0.6){ if(!this.on) return; const src=this.fx[name]||(this.fx[name]=new Audio("snd/"+name+".mp3?v=1"));
    const a=src.cloneNode(); a.volume=vol; a.play().catch(()=>{}); },
  era(i){ if(this.cur===i && !this.music.paused) return; this.cur=i; if(!this.on) return;
    const m=this.music; m.loop=true; m.volume=0; m.src="snd/era"+(i+1)+".mp3?v=1"; m.play().catch(()=>{});
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
