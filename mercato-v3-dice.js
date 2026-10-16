/* OPMercato 3.1 — cinematic and accessible initial 3-D die, shared by local and online. */
(function(){
'use strict';
const style=document.createElement('style');
style.textContent=`
.op-v3-dice-overlay{position:fixed;inset:0;z-index:5000;display:grid;place-items:center;overflow:hidden;background:radial-gradient(circle at 50% 35%,#31536ddf,#071627f5 72%);backdrop-filter:blur(12px);color:#ffebc0;text-align:center;padding:22px}
.op-v3-dice-box{display:grid;justify-items:center;gap:20px;max-width:360px;width:100%;animation:opV3Fade .24s ease-out}
.op-v3-dice-label{font-size:13px;letter-spacing:.18em;color:#d8eff3;text-transform:uppercase}
.op-v3-dice-name{font-weight:900;font-size:clamp(22px,7vw,34px);color:#ffdb8f}
.op-v3-dice-perspective{height:205px;width:205px;perspective:850px;display:grid;place-items:center;filter:drop-shadow(0 22px 26px #000a)}
.op-v3-die{position:relative;height:118px;width:118px;transform-style:preserve-3d;transform:rotateX(-22deg) rotateY(-30deg) rotateZ(12deg);transition:transform 1.4s cubic-bezier(.16,.78,.12,1)}
.op-v3-die.rolling{animation:opV3Shake .28s infinite alternate}
.op-v3-die-face{position:absolute;inset:0;display:grid;place-items:center;border-radius:19px;border:4px solid #d9b977;background:linear-gradient(145deg,#fffdf4,#e9d7ae);box-shadow:inset -8px -9px 13px #75604b38,inset 5px 6px 12px #fff;backface-visibility:hidden}
.op-v3-die-face span{display:grid;width:74px;height:74px;place-items:center;font-size:65px;line-height:1;color:#152a39;font-family:Georgia,serif}
.op-v3-die-face[data-n="1"]{transform:translateZ(59px)}
.op-v3-die-face[data-n="2"]{transform:rotateY(90deg) translateZ(59px)}
.op-v3-die-face[data-n="3"]{transform:rotateX(90deg) translateZ(59px)}
.op-v3-die-face[data-n="4"]{transform:rotateX(-90deg) translateZ(59px)}
.op-v3-die-face[data-n="5"]{transform:rotateY(-90deg) translateZ(59px)}
.op-v3-die-face[data-n="6"]{transform:rotateY(180deg) translateZ(59px)}
.op-v3-dice-result{font-size:clamp(22px,7vw,34px);font-weight:950;color:#fbd37a;min-height:45px;text-shadow:0 0 24px #f6b95670}
.op-v3-dice-hint{font-size:13px;color:#cee2e8}
@keyframes opV3Shake{from{translate:-4px 5px}to{translate:4px -5px}}
@keyframes opV3Fade{from{transform:scale(.9);opacity:0}to{transform:scale(1);opacity:1}}
@media(prefers-reduced-motion:reduce){.op-v3-die{transition-duration:.15s!important}.op-v3-die.rolling{animation:none}}
`;
document.head.appendChild(style);
let active=false;
function frame(title){
 const el=document.createElement('div');el.className='op-v3-dice-overlay';el.setAttribute('role','status');el.setAttribute('aria-live','polite');
 el.innerHTML='<div class="op-v3-dice-box"><small class="op-v3-dice-label">OPMERCATO · LANCER DE DÉ</small><div class="op-v3-dice-name"></div><div class="op-v3-dice-perspective"><div class="op-v3-die rolling">'+[1,2,3,4,5,6].map(i=>'<div class="op-v3-die-face" data-n="'+i+'"><span>'+['','⚀','⚁','⚂','⚃','⚄','⚅'][i]+'</span></div>').join('')+'</div></div><div class="op-v3-dice-result">Le dé roule…</div><small class="op-v3-dice-hint">Le résultat est tiré équitablement par le jeu</small></div>';
 el.querySelector('.op-v3-dice-name').textContent=title||'Le pirate lance son dé';
 document.body.appendChild(el);return el;
}
async function play(score,title){
 if(active)return;active=true;const el=frame(title);
 const die=el.querySelector('.op-v3-die'),result=el.querySelector('.op-v3-dice-result');
 const orientations={1:[0,0],2:[0,-90],3:[-90,0],4:[90,0],5:[0,90],6:[0,180]};
 await new Promise(resolve=>setTimeout(resolve,180));
 const [x,y]=orientations[Number(score)]||[0,0];
 die.classList.remove('rolling');
 die.style.transform='rotateX('+(1440+x)+'deg) rotateY('+(1440+y)+'deg) rotateZ(0deg)';
 await new Promise(resolve=>setTimeout(resolve,window.matchMedia('(prefers-reduced-motion: reduce)').matches?300:1530));
 result.textContent='🎲 '+score+' !';
 el.querySelector('.op-v3-dice-hint').textContent=score===6?'Six ! Quel lancer !':'Le sort en est jeté';
 await new Promise(resolve=>setTimeout(resolve,730));
 el.remove();active=false;
}
window.OPMERCATO_V3_DICE={play};
})();
