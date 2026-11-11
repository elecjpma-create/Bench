'use strict';
/* =========================================================
   簡易 CAD － 介面與操作
   ========================================================= */

/* ---------- 狀態 ---------- */
let st={ents:[],view:null,ltscale:1,prec:3,snap:true,ortho:false,bg:'dark',lon0:121,textH:2,inkW:3,
  osm:Object.assign({},OSM_DEF),
  layers:[{name:'補繪',ci:1,lt:'CONTINUOUS',on:true}],cur:'補繪',penCi:1,penSlots:[1,7,5],penSlot:0};
let lts=[];
let imp=[],impLayers=[],hidLy=new Set(),offLy=new Set(),frzLy=new Set(),impName='',drawKey='(無底圖)';
let undoS=[],redoS=[];
let selE=null;           // 一般點選查看的物件
let selSet=new Set();    // 指令中選取的物件
let cmd=null;            // 目前指令
let cur=null;            // 游標 {raw,p,snap}
let tab=null;            // 底部展開的分類
let eraser=false;
const ptrs=new Map();let lastType='touch';
const NATIVE=!!window.CadNative;
const isApp=!!(window.Capacitor&&window.Capacitor.isNativePlatform&&window.Capacitor.isNativePlatform());
const _pl={};
function NP(){const C=window.Capacitor;if(!C)return{};const P=Object.assign({},C.Plugins||{});
  for(const n of['SupportFolder','Filesystem','Share']){
    if(P[n])continue;if(_pl[n]){P[n]=_pl[n];continue;}
    const avail=C.isPluginAvailable?C.isPluginAvailable(n):!!(C.PluginHeaders||[]).find(h=>h.name===n);if(!avail)continue;
    if(C.registerPlugin){try{_pl[n]=C.registerPlugin(n);}catch(_){}}
    if(!_pl[n]&&C.nativePromise)_pl[n]=new Proxy({},{get:(_,m)=>typeof m==='string'&&m!=='then'?(o=>C.nativePromise(n,m,o||{})):undefined});
    if(_pl[n])P[n]=_pl[n];}
  return P;}

/* ---------- 圖示 ---------- */
const IC={
  file:'<path d="M3 7h6l2 2h10v10H3z"/>',
  undo:'<path d="M9 7L4 12l5 5"/><path d="M4 12h10a6 6 0 0 1 0 12"/>',
  redo:'<path d="M15 7l5 5-5 5"/><path d="M20 12H10a6 6 0 0 0 0 12"/>',
  fit:'<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
  snap:'<rect x="8" y="8" width="8" height="8"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/>',
  ortho:'<path d="M5 19V5M5 19h14"/><path d="M5 12h5M12 19v-5" stroke-dasharray="2 2"/>',
  set:'<circle cx="12" cy="12" r="3.5"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  sel:'<path d="M5 3l14 8-6 2-2 6z"/>',
  draw:'<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M14 6l3 3"/>',
  edit:'<circle cx="6" cy="18" r="2.5"/><circle cx="6" cy="6" r="2.5"/><path d="M8 7.5L20 17M8 16.5L20 7"/>',
  meas:'<path d="M3 16L16 3l5 5L8 21z"/><path d="M7 12l2 2M10 9l2 2M13 6l2 2"/>',
  layers:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  pen:'<path d="M3 17c3-7 5 3 8-3s4-7 7-2"/><path d="M15 20l6-6"/>',
  pline:'<path d="M4 18l5-9 5 6 6-10"/><circle cx="4" cy="18" r="1.5"/><circle cx="9" cy="9" r="1.5"/><circle cx="14" cy="15" r="1.5"/><circle cx="20" cy="5" r="1.5"/>',
  line:'<path d="M5 19L19 5"/><circle cx="5" cy="19" r="1.6"/><circle cx="19" cy="5" r="1.6"/>',
  circle:'<circle cx="12" cy="12" r="8"/><path d="M12 12l5-3"/>',
  text:'<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
  arc:'<path d="M4 18A10 10 0 0 1 20 10"/><circle cx="4" cy="18" r="1.6"/><circle cx="11" cy="10.5" r="1.6"/><circle cx="20" cy="10" r="1.6"/>',
  spline:'<path d="M3 17c3-9 6-9 9-3s6 6 9-6"/><circle cx="3" cy="17" r="1.5"/><circle cx="12" cy="14" r="1.5"/><circle cx="21" cy="8" r="1.5"/>',
  polygon:'<path d="M12 3l8.5 6.2-3.3 10H6.8L3.5 9.2z"/><circle cx="12" cy="12" r="1.2"/>',
  move:'<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  copy:'<rect x="8" y="8" width="12" height="12" rx="1"/><path d="M4 16V4h12"/>',
  rot:'<path d="M20 12a8 8 0 1 1-2.5-5.8"/><path d="M20 4v5h-5"/>',
  offset:'<path d="M4 19c3-7 8-10 16-10"/><path d="M4 13c3-5 7-8 14-8" stroke-dasharray="3 2"/>',
  trim:'<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5l12 8M8 15.5l12-8"/><path d="M14 3v18" stroke-dasharray="2 2"/>',
  extend:'<path d="M3 12h10"/><path d="M13 12h5" stroke-dasharray="2 2"/><path d="M20 5v14"/><path d="M11 9l3 3-3 3"/>',
  del:'<path d="M5 7h14M9 7V4h6v3M7 7l1 13h8l1-13"/>',
  chly:'<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/><path d="M17 17h5M20 15l2 2-2 2"/>',
  len:'<path d="M3 12h18M3 8v8M21 8v8"/><path d="M7 10v4M11 10v4M15 10v4"/>',
  xy:'<circle cx="12" cy="12" r="4"/><path d="M12 2v6M12 16v6M2 12h6M16 12h6"/>',
  ll:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3.5 3 3.5 15 0 18M12 3c-3.5 3-3.5 15 0 18"/>',
  eraser:'<path d="M4 16l9-9 6 6-7 7H8z"/><path d="M10 20h10"/>',
  done:'<path d="M5 12l5 5 9-10"/>',
  join:'<path d="M3 17l6-6"/><path d="M15 11l6-6"/><circle cx="12" cy="11" r="2.2"/>',
  brk:'<path d="M3 18L9 12"/><path d="M15 12l6-6"/><path d="M10 7l4 10" stroke-dasharray="2 2"/>',
  dim:'<path d="M4 7v10M20 7v10M4 12h16"/><path d="M6 10l-2 2 2 2M18 10l2 2-2 2"/>',
  cclip:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1h-2"/>',
  pclip:'<rect x="8" y="3" width="8" height="4" rx="1"/><path d="M8 5H6a1 1 0 00-1 1v14a1 1 0 001 1h12a1 1 0 001-1V6a1 1 0 00-1-1h-2"/><path d="M12 10v7M9 14l3 3 3-3"/>'
};
const svg=(k)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${IC[k]||''}</svg>`;

/* ---------- 共用小工具 ---------- */
function toast(t,ms=2200){const e=$('toast');e.textContent=t;e.style.display='block';clearTimeout(toast._t);toast._t=setTimeout(()=>e.style.display='none',ms);}
function busy(on,msg){$('busy').classList.toggle('show',on);if(msg)$('busyMsg').textContent=msg;}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
let sheetT=0;function openSheet(id){sheetT=Date.now();$(id).classList.add('show');}
function closeSheet(id){$(id).classList.remove('show');}
document.querySelectorAll('.sheet').forEach(s=>{s.addEventListener('click',e=>{if(e.target===s&&Date.now()-sheetT>500)s.classList.remove('show');});s.querySelectorAll('[data-close]').forEach(b=>b.onclick=()=>s.classList.remove('show'));});
const fmt=v=>(+v).toFixed(st.prec);
const deg=r=>r*180/Math.PI,rad=d=>d*Math.PI/180;
function normA(a){a%=360;if(a<0)a+=360;return a;}
function dmsLL(v,pos,neg){const s=v<0?neg:pos;v=Math.abs(v);let d=Math.floor(v),mf=(v-d)*60,m=Math.floor(mf),sec=(mf-m)*60;if(sec>=59.9995){sec=0;m++;}if(m>=60){m=0;d++;}return`${d}°${String(m).padStart(2,'0')}'${sec.toFixed(3).padStart(6,'0')}"${s}`;}

/* ---------- TWD97 二度分帶 → 經緯度（GRS80） ---------- */
function tm2ll(E,N,lon0){
  const a=6378137,f=1/298.257222101,k0=0.9999,E0=250000,e2=f*(2-f),ep2=e2/(1-e2);
  const mu=(N/k0)/(a*(1-e2/4-3*e2*e2/64-5*e2*e2*e2/256)),e1=(1-Math.sqrt(1-e2))/(1+Math.sqrt(1-e2));
  const p1=mu+(3*e1/2-27*e1**3/32)*Math.sin(2*mu)+(21*e1*e1/16-55*e1**4/32)*Math.sin(4*mu)+(151*e1**3/96)*Math.sin(6*mu)+(1097*e1**4/512)*Math.sin(8*mu);
  const sp=Math.sin(p1),cp=Math.cos(p1),C1=ep2*cp*cp,T1=Math.tan(p1)**2,N1=a/Math.sqrt(1-e2*sp*sp),R1=a*(1-e2)/Math.pow(1-e2*sp*sp,1.5),D=(E-E0)/(N1*k0);
  const lat=p1-(N1*Math.tan(p1)/R1)*(D*D/2-(5+3*T1+10*C1-4*C1*C1-9*ep2)*D**4/24+(61+90*T1+298*C1+45*T1*T1-252*ep2-3*C1*C1)*D**6/720);
  const lon=rad(lon0)+(D-(1+2*T1+C1)*D**3/6+(5-2*C1+28*T1-3*C1*C1+8*ep2+24*T1*T1)*D**5/120)/cp;
  return[deg(lat),deg(lon)];
}

/* ---------- 圖層 ---------- */
const layerOf=n=>st.layers.find(l=>l.name===n)||st.layers[0];
function curLayer(){return layerOf(st.cur);}
function ownColor(e){const L=layerOf(e.ly);return colorFor(aciHex(e.ci!=null?e.ci:L.ci));}
function ownLt(e){return e.lt||layerOf(e.ly).lt||'CONTINUOUS';}
const ownShown=e=>{const L=layerOf(e.ly);return!L||L.on!==false;};
const shown=e=>e.imp?!hidLy.has(e.ly):ownShown(e);

/* ---------- 視圖 ---------- */
const toS=p=>[p[0]*st.view.s+st.view.ox,-p[1]*st.view.s+st.view.oy];
const toW=q=>[(q[0]-st.view.ox)/st.view.s,-(q[1]-st.view.oy)/st.view.s];
const clampS=s=>Math.max(1e-4,Math.min(1e6,s));
function resize(){
  DPR=window.devicePixelRatio||1;const r=cv.getBoundingClientRect();
  const nW=r.width,nH=r.height;
  // 下方鍵盤／面板出現或收起時，畫面不動（上緣固定）；只有游標會被蓋住時才往上挪剛好看得到
  // 寬度改變（轉向）時維持中心
  if(st.view&&W&&H){st.view.ox+=(nW-W)/2;
    if(Math.abs(nW-W)>1)st.view.oy+=(nH-H)/2;
    else if(nH<H&&cur){const y=-cur.p[1]*st.view.s+st.view.oy,lim=nH-60;if(y>lim)st.view.oy-=y-lim;}}
  W=nW;H=nH;cv.width=Math.round(W*DPR);cv.height=Math.round(H*DPR);
  if(!st.view)st.view={s:20,ox:W/2,oy:H/2};
  schedule();
}
function zoomFit(){
  if(nativeOn&&nFit){const b=nFit,bw=Math.max(b[2]-b[0],1e-6),bh=Math.max(b[3]-b[1],1e-6),s=clampS(Math.min(W/bw,H/bh)*0.9);st.view={s,ox:W/2-(b[0]+b[2])/2*s,oy:H/2+(b[1]+b[3])/2*s};schedule();saveSettings();return;}
  const all=st.ents.concat(imp.filter(shown));
  if(!all.length){st.view={s:20,ox:W/2,oy:H/2};schedule();return;}
  const bx=all.map(e=>e.bb||entBox(e)).filter(q=>q.every(isFinite));
  let use=bx;
  if(bx.length>=20){
    const qs=(arr,f)=>{const a=arr.slice().sort((x,y)=>x-y);return a[Math.floor(f*(a.length-1))];};
    const cx=bx.map(q=>(q[0]+q[2])/2),cy=bx.map(q=>(q[1]+q[3])/2);
    const x0=qs(cx,.1),x1=qs(cx,.9),y0=qs(cy,.1),y1=qs(cy,.9),sp=Math.max(x1-x0,y1-y0,1e-6)*2;
    use=bx.filter((q,i)=>cx[i]>=x0-sp&&cx[i]<=x1+sp&&cy[i]>=y0-sp&&cy[i]<=y1+sp);
  }
  let b=[Infinity,Infinity,-Infinity,-Infinity];
  for(const q of use)b=[Math.min(b[0],q[0]),Math.min(b[1],q[1]),Math.max(b[2],q[2]),Math.max(b[3],q[3])];
  if(!isFinite(b[0])){st.view={s:20,ox:W/2,oy:H/2};schedule();return;}
  const bw=Math.max(b[2]-b[0],1e-6),bh=Math.max(b[3]-b[1],1e-6),s=clampS(Math.min(W/bw,H/bh)*0.9);
  st.view={s,ox:W/2-(b[0]+b[2])/2*s,oy:H/2+(b[1]+b[3])/2*s};schedule();saveSettings();
}

/* ---------- 鎖點與游標 ---------- */
// 鎖點、點選只看游標附近的物件（大圖時用格網索引，不用逐一檢查全部）
function* snapEnts(w,tol){for(const e of st.ents)if(ownShown(e))yield e;const L=w?queryImp(w[0]-tol,w[1]-tol,w[0]+tol,w[1]+tol):imp;for(const e of L)if(shown(e))yield e;
  if(w)for(const e of nativeNear(w[0]-tol,w[1]-tol,w[0]+tol,w[1]+tol,600))if(shown(e))yield e;}
function snapAt(w,base){
  if(st.snap){const s=findSnap(w,22/st.view.s,base);if(s)return{p:s.p.slice(),snap:s};}
  if(st.ortho&&base){const dx=w[0]-base[0],dy=w[1]-base[1];return{p:Math.abs(dx)>=Math.abs(dy)?[w[0],base[1]]:[base[0],w[1]],snap:null};}
  return{p:w.slice(),snap:null};
}
function cmdBase(){return cmd&&cmd.base?cmd.base():null;}
function setCursorRaw(w){const r=snapAt(w,cmdBase());cur={raw:w.slice(),p:r.p,snap:r.snap};kp.unlockAll();refreshCmd();}
function pickEnt(w,filter){
  const tol=18/st.view.s;let bi=null,bd=tol;
  // 文字框內不算 0：點到框裡時，8 像素內有線就選線（大字如圖號才不會擋住下面的線）
  for(const e of snapEnts(w,tol)){if(filter&&!filter(e))continue;if(!near(e,w,tol))continue;let d=hitDist(e,w);if(e.t==='text')d=Math.max(d,8/st.view.s);if(d<bd||(d===bd&&!e.imp)){bd=d;bi=e;}}
  return bi;
}

/* ---------- 復原與儲存 ---------- */
function snapshot(){undoS.push(JSON.stringify(st.ents));if(undoS.length>200)undoS.shift();redoS=[];}
function doUndo(){if(cmd&&cmd.pts&&cmd.pts.length){cmdUndoPt();return;}if(!undoS.length)return;redoS.push(JSON.stringify(st.ents));st.ents=JSON.parse(undoS.pop());selE=null;selSet.clear();saveDraw();updateUI();schedule();}
function doRedo(){if(!redoS.length)return;undoS.push(JSON.stringify(st.ents));st.ents=JSON.parse(redoS.pop());selE=null;selSet.clear();saveDraw();updateUI();schedule();}
function addEnt(e){e.ly=e.ly||st.cur;st.ents.push(e);}
let saveT=0,saveDT=0;
function saveSettings(){clearTimeout(saveT);saveT=setTimeout(()=>{try{const o=Object.assign({},st);delete o.ents;localStorage.setItem('simplecad.v2',JSON.stringify(o));localStorage.setItem('simplecad.lts',JSON.stringify(lts.filter(l=>l.src)));}catch(_){}},250);}
function saveDraw(){clearTimeout(saveDT);saveDT=setTimeout(saveDrawNow,200);}
function loadDraw(key){drawKey=key;try{st.ents=JSON.parse(localStorage.getItem('simplecad.draw:'+key)||'[]');}catch(_){st.ents=[];}undoS=[];redoS=[];selE=null;selSet.clear();}

/* ---------- 數字鍵盤 ---------- */
const kp={
  mode:'la',act:null,vals:{},lock:{},shown:false,hidden:false,
  fields(){return this.mode==='la'?[['L','長度'],['A','角度']]:this.mode==='xy'?[['X','X 坐標'],['Y','Y 坐標']]:this.mode==='d'?[['D','距離']]:[['A','角度']];},
  unlockAll(){this.lock={};this.vals={};this.ref=null;},
  setMode(m){this.mode=m;this.unlockAll();this.act=this.fields()[0][0];this.render();},
  show(m){this.shown=true;if(m)this.setMode(m);$('keypad').style.display=this.hidden?'none':'block';this.render();},
  hide(){this.shown=false;$('keypad').style.display='none';},
  cur(k){
    if(this.lock[k])return this.vals[k];
    const b=cmdBase(),p=cur&&cur.p;
    if(k==='X')return p?fmt(p[0]):'';if(k==='Y')return p?fmt(p[1]):'';
    if(k==='D')return this.vals.D||'';
    if(!p||!b)return'';
    if(k==='L')return fmt(dist(b,p));
    if(k==='A'&&this.ref!=null)return normA(deg(this.ref)).toFixed(4).replace(/\.?0+$/,'');
    if(k==='A')return dist(b,p)>1e-12?normA(deg(Math.atan2(p[1]-b[1],p[0]-b[0]))).toFixed(4).replace(/\.?0+$/,''):'0';
  },
  render(){
    if(!this.shown)return;
    $('kfields').innerHTML='';
    for(const[k,n]of this.fields()){
      const d=document.createElement('div');d.className='kf';
      d.innerHTML=`<label>${n}</label><div class="${this.act===k?'act':''} ${this.lock[k]?'lock':''}">${this.cur(k)||''}</div>`;
      d.onclick=()=>{this.act=k;this.render();};$('kfields').appendChild(d);
    }
    if(this.mode==='la'||this.mode==='xy'){const b=document.createElement('button');b.id='kswap';b.textContent='⇄';b.title='切換長度角度／坐標';b.onclick=()=>{this.setMode(this.mode==='la'?'xy':(cmdBase()?'la':'xy'));};$('kfields').appendChild(b);}
    const hb=document.createElement('button');hb.id='kswap';hb.textContent='⌄';hb.title='收起鍵盤';hb.onclick=()=>{this.hidden=true;$('keypad').style.display='none';updateCmdBar();};$('kfields').appendChild(hb);
  },
  key(c){
    const k=this.act;if(!k)return;
    let v=this.lock[k]?this.vals[k]:'';
    if(c==='⌫'){v=(this.lock[k]?this.vals[k]:'').slice(0,-1);if(!v){delete this.lock[k];delete this.vals[k];this.apply();return;}}
    else if(c==='-'){v=v.startsWith('-')?v.slice(1):'-'+v;}
    else if(c==='.'){if(!v.includes('.'))v=(v===''||v==='-'?v+'0':v)+'.';}
    else v+=c;
    if(this.ref==null){const b=cmdBase();this.ref=(b&&cur&&dist(b,cur.p)>1e-12)?Math.atan2(cur.p[1]-b[1],cur.p[0]-b[0]):0;}
    this.vals[k]=v;this.lock[k]=true;this.apply();
  },
  num(k){const v=parseFloat(this.vals[k]);return this.lock[k]&&isFinite(v)?v:null;},
  apply(){
    if(this.mode==='d'){this.render();refreshCmd();return;}
    const b=cmdBase();let p=cur?cur.p.slice():(b?b.slice():null);
    if(this.mode==='xy'){const x=this.num('X'),y=this.num('Y');if(!p)p=[x||0,y||0];if(x!=null)p[0]=x;if(y!=null)p[1]=y;}
    else if(b){const L=this.num('L'),A=this.num('A');let ang=A!=null?rad(A):(this.ref!=null?this.ref:(p&&dist(b,p)>1e-12?Math.atan2(p[1]-b[1],p[0]-b[0]):0));
      let len=L!=null?L:(p?dist(b,p):0);if(L==null&&A!=null&&p){len=(p[0]-b[0])*Math.cos(ang)+(p[1]-b[1])*Math.sin(ang);}
      p=[b[0]+len*Math.cos(ang),b[1]+len*Math.sin(ang)];}
    else if(this.mode==='a'){this.render();refreshCmd();return;}
    if(p){cur={raw:p.slice(),p,snap:null,typed:true};}
    this.render();refreshCmd();schedule();
  }
};
(function buildKeys(){
  const keys=['7','8','9','⌫','4','5','6','✗','1','2','3','+','0','-','.','✓'];
  for(const k of keys){const b=document.createElement('button');b.textContent=k;if(k==='✗')b.className='x';if(k==='+')b.className='p';if(k==='✓')b.className='ok';
    b.onclick=()=>{if(k==='✗')cancelCmd();else if(k==='+')cmdPlus();else if(k==='✓')cmdOk();else kp.key(k);};$('kkeys').appendChild(b);}
})();

/* ---------- 指令系統 ---------- */
function setHint(t,info,btn){$('hintT').textContent=t||'';$('hintT').className=info==='big'?'info big':info?'info':'';const b=$('hintBtn');if(btn){b.style.display='block';b.textContent=btn.t;b.onclick=btn.f;}else b.style.display='none';}
function refreshCmd(){if(cmd&&cmd.hint)setHint(...[].concat(cmd.hint()));kp.render();updateCmdBar();schedule();}
function startCmd(c){
  if(cmd&&cmd.cleanup)cmd.cleanup();
  cmd=c;cur=null;selE=null;kp.unlockAll();kp.hidden=false;kp.keepXY=false;eraser=false;
  if(c.keypad)kp.show(c.keypad);else kp.hide();
  closePanel();if(c.init)c.init();
  $('penbar').style.display=c.kind==='pen'?'flex':'none';if(c.kind==='pen')buildPenBar();
  refreshCmd();updateUI();
}
function endCmd(){if(cmd&&cmd.cleanup)cmd.cleanup();cmd=null;cur=null;selSet.clear();kp.hide();$('penbar').style.display='none';$('penW').style.display='none';$('cmdbar').style.display='none';setHint(baseHintText());updateUI();schedule();}
function cancelCmd(){if(cmd&&cmd.cancel&&cmd.cancel()===false){refreshCmd();return;}endCmd();}
function cmdPlus(){if(!cmd)return;if(cmd.kind==='points'){if(cur)commitPoint();}else if(cmd.plus)cmd.plus();}
function cmdOk(){if(!cmd)return;if(cmd.kind==='points'&&cur&&!cmd.live){const last=cmdBase();if(!last||dist(last,cur.p)>1e-9)commitPoint();}if(cmd&&cmd.ok)cmd.ok();refreshCmd();}
function commitPoint(){if(!cmd||!cur)return;const p=cur.p.slice();kp.unlockAll();
  cmd.onPoint(p);if(cmd&&cmd.kind==='points'&&cmd.keypad==='la'&&cmdBase()&&kp.mode==='xy'&&!kp.keepXY)kp.setMode('la');kp.keepXY=false;refreshCmd();}
function cmdUndoPt(){if(cmd&&cmd.pts&&cmd.pts.length){cmd.pts.pop();if(cmd.onUndoPt)cmd.onUndoPt();refreshCmd();}}
function baseHintText(){return selE?entInfo(selE):'單指拖曳平移、雙指縮放；點物件看資訊。下方選工具開始畫。';}
function updateCmdBar(){
  const bar=$('cmdbar');bar.innerHTML='';
  if(!cmd||cmd.kind==='pen'){bar.style.display='none';return;}
  const add=(t,f,cls)=>{const b=document.createElement('button');b.textContent=t;if(cls)b.className=cls;b.onclick=f;bar.appendChild(b);};
  if(kp.shown===false&&cmd.keypad||kp.hidden&&cmd.keypad)add('⌨',()=>{kp.hidden=false;kp.show();updateCmdBar();});
  if(cmd.pts&&cmd.pts.length)add('↶',cmdUndoPt);
  if(cmd.extraBtns)for(const x of cmd.extraBtns())add(x.t,x.f,x.c);
  add('✗',cancelCmd);add('✓',cmdOk,'ok');
  bar.style.display='flex';
}

/* --- 點選類指令的共同骨架 --- */
function pointsCmd(o){return Object.assign({kind:'points',keypad:'la',pts:[],base(){return this.pts.length?this.pts[this.pts.length-1]:null;}},o);}

/* 多段線 */
function cmdPline(){return pointsCmd({name:'pline',
  init(){kp.setMode('xy');},
  hint(){return this.pts.length?[`多段線：已 ${this.pts.length} 點。點下一點（拖曳微調），或輸入長度、角度（負值＝反方向）。✓ 完成`,!!cur]:[cur?'拖曳游標微調，再點下一點或按 ＋ 確定':'多段線：點擊第一點',!!cur];},
  onPoint(p){this.pts.push(p);},
  extraBtns(){return this.pts.length>=2?[{t:'閉合',f:()=>{this.closed=true;this.finish();}}]:[];},
  ok(){this.finish();},
  finish(){if(this.pts.length>=2){snapshot();addEnt({t:'pline',pts:this.pts.map(p=>p.slice()),closed:!!this.closed});saveDraw();toast('已畫好多段線');}
    startCmd(cmdPline());},
  preview(){previewPath(this.pts,cur&&cur.p,this.closed);}
});}
/* 直線（連續） */
function cmdLine(){return pointsCmd({name:'line',
  init(){kp.setMode('xy');},
  hint(){return[this.pts.length?'直線：點下一點（可輸入長度、角度），✓ 結束':(cur?'拖曳微調，再點下一點':'直線：點擊第一點'),!!cur];},
  onPoint(p){if(this.pts.length){const a=this.pts[this.pts.length-1];if(dist(a,p)>1e-9){snapshot();addEnt({t:'line',a:a.slice(),b:p.slice()});saveDraw();}}this.pts.push(p);},
  ok(){startCmd(cmdLine());},
  preview(){if(this.pts.length&&cur)previewPath([this.pts[this.pts.length-1]],cur.p);}
});}
/* ---------- 標註（對齊標註）：點兩點，再點標註線位置；字高用「文字高度」設定 ---------- */
function dimOff(a,b,p){const L=dist(a,b);if(!L)return 0;const ux=(b[0]-a[0])/L,uy=(b[1]-a[1])/L;return ux*(p[1]-a[1])-uy*(p[0]-a[0]);}
function cmdDim(){return pointsCmd({name:'dim',
  init(){kp.setMode('xy');},
  hint(){const n=this.pts.length;return[n===0?(cur?'拖曳微調，再點一下確定第一點':'標註：點第一點（可鎖點）'):n===1?'標註：點第二點（可鎖點）':'標註：點標註線要放的位置（拉離兩點連線）',!!cur];},
  onPoint(p){if(this.pts.length<2){if(this.pts.length===1&&dist(this.pts[0],p)<1e-9)return;this.pts.push(p);return;}
    const[a,b]=this.pts;snapshot();addEnt({t:'dim',a:a.slice(),b:b.slice(),off:dimOff(a,b,p),h:st.textH||2});saveDraw();startCmd(cmdDim());},
  ok(){endCmd();},
  preview(){const P=this.pts;if(P.length===1&&cur)previewPath([P[0]],cur.p);
    if(P.length===2){const off=cur?dimOff(P[0],P[1],cur.p):0;drawTemp({t:'dim',a:P[0],b:P[1],off,h:st.textH||2});}}
});}
/* ---------- 幾何：三點圓、雲形線、多邊形 ---------- */
function circ3(a,b,c){const d=2*(a[0]*(b[1]-c[1])+b[0]*(c[1]-a[1])+c[0]*(a[1]-b[1]));if(Math.abs(d)<1e-12)return null;
  const A=a[0]*a[0]+a[1]*a[1],B=b[0]*b[0]+b[1]*b[1],C=c[0]*c[0]+c[1]*c[1];
  const o=[(A*(b[1]-c[1])+B*(c[1]-a[1])+C*(a[1]-b[1]))/d,(A*(c[0]-b[0])+B*(a[0]-c[0])+C*(b[0]-a[0]))/d];return{o,r:dist(o,a)};}
const angOf=(o,p)=>Math.atan2(p[1]-o[1],p[0]-o[0]);
function arc3(a,m,b){const c=circ3(a,m,b);if(!c)return null;const t0=angOf(c.o,a),tm=angOf(c.o,m),t1=angOf(c.o,b);
  return inRange(tm,t0,t1)?{t:'arc',o:c.o,r:c.r,a0:t0,a1:t1}:{t:'arc',o:c.o,r:c.r,a0:t1,a1:t0};}
// 向心 Catmull-Rom：曲線通過每個擬合點（跟 AutoCAD 雲形線「擬合」一樣經過點擊的點）
function splinePts(F,closed){
  const n=F.length;if(n<2)return{pts:F.map(p=>p.slice()),kv:F.map((_,i)=>i)};if(n===2&&!closed)return{pts:F.map(p=>p.slice()),kv:[0,1]};
  const P=i=>{if(closed)return F[((i%n)+n)%n];if(i<0)return[2*F[0][0]-F[1][0],2*F[0][1]-F[1][1]];if(i>=n)return[2*F[n-1][0]-F[n-2][0],2*F[n-1][1]-F[n-2][1]];return F[i];};
  const out=[],kv=[];const segs=closed?n:n-1;
  for(let i=0;i<segs;i++){const p0=P(i-1),p1=P(i),p2=P(i+1),p3=P(i+2);
    const tj=(a,b)=>Math.pow(Math.max(dist(a,b),1e-9),0.5);const t0=0,t1=t0+tj(p0,p1),t2=t1+tj(p1,p2),t3=t2+tj(p2,p3);
    const N=Math.max(8,Math.min(48,Math.ceil(dist(p1,p2)*2)));kv.push(out.length);
    for(let k=0;k<N;k++){const t=t1+(t2-t1)*k/N;
      const L=(pa,pb,ta,tb)=>[(tb-t)/(tb-ta)*pa[0]+(t-ta)/(tb-ta)*pb[0],(tb-t)/(tb-ta)*pa[1]+(t-ta)/(tb-ta)*pb[1]];
      const A1=L(p0,p1,t0,t1),A2=L(p1,p2,t1,t2),A3=L(p2,p3,t2,t3),B1=L(A1,A2,t0,t2),B2=L(A2,A3,t1,t3);out.push(L(B1,B2,t1,t2));}}
  if(!closed){kv.push(out.length);out.push(F[n-1].slice());}
  return{pts:out,kv};
}
function polyVerts(o,p,n,mode){const R0=dist(o,p);if(R0<1e-12)return null;let a=angOf(o,p),R=R0;
  if(mode==='c'){R=R0/Math.cos(Math.PI/n);a+=Math.PI/n;}
  const v=[];for(let i=0;i<n;i++){const t=a+i*TAU/n;v.push([o[0]+R*Math.cos(t),o[1]+R*Math.sin(t)]);}return v;}
function polyEdge(a,b,n){const L=dist(a,b);if(L<1e-12)return null;const ext=TAU/n;let d=angOf(a,b);const v=[a.slice()];let q=a.slice();
  for(let i=1;i<n;i++){q=[q[0]+L*Math.cos(d),q[1]+L*Math.sin(d)];v.push(q);d+=ext;}return v;}
function modeBtns(list,curv,set){return list.map(([k,t])=>({t,c:'mode'+(k===curv?' on':''),f:()=>{if(k!==curv)set(k);}}));}
function askNum(msg,v,min,max){const r=window.prompt(msg,String(v));if(r==null)return null;const n=parseInt(r);return n>=min&&n<=max?n:null;}

/* 圓：中心、2P、3P */
function cmdCircle(){const M=st.circM||'cen';return pointsCmd({name:'circle',
  init(){kp.setMode('xy');},
  extraBtns(){return modeBtns([['cen','中心'],['2p','2P'],['3p','3P']],M,k=>{st.circM=k;saveSettings();startCmd(cmdCircle());});},
  hint(){const n=this.pts.length;
    if(M==='cen')return n?[`圓：點半徑上的一點，或輸入長度＝半徑。${cur?'半徑 '+fmt(dist(this.pts[0],cur.p)):''}`,true]:['圓（中心）：點圓心',!!cur];
    if(M==='2p')return n?[`圓：點直徑的另一端，或輸入長度＝直徑。${cur?'直徑 '+fmt(dist(this.pts[0],cur.p)):''}`,true]:['圓（2P）：點直徑的第一端',!!cur];
    return[['圓（3P）：點圓上第一點','圓（3P）：點圓上第二點','圓（3P）：點圓上第三點'][n]+(n===2&&cur&&this.tmp()?`　半徑 ${fmt(this.tmp().r)}`:''),!!cur];},
  tmp(){const P=this.pts,c=cur&&cur.p;if(!c)return null;
    if(M==='cen'&&P.length===1){const r=dist(P[0],c);return r>1e-9?{t:'circle',o:P[0],r}:null;}
    if(M==='2p'&&P.length===1){const r=dist(P[0],c)/2;return r>1e-9?{t:'circle',o:midp(P[0],c),r}:null;}
    if(M==='3p'&&P.length===2){const k=circ3(P[0],P[1],c);return k?{t:'circle',o:k.o,r:k.r}:null;}return null;},
  onPoint(p){const need=M==='3p'?3:2;
    if(this.pts.length+1<need){this.pts.push(p);return;}
    const P=this.pts.concat([p]);let e=null;
    if(M==='cen'){const r=dist(P[0],P[1]);if(r>1e-9)e={t:'circle',o:P[0].slice(),r};}
    else if(M==='2p'){const r=dist(P[0],P[1])/2;if(r>1e-9)e={t:'circle',o:midp(P[0],P[1]),r};}
    else{const k=circ3(P[0],P[1],P[2]);if(k)e={t:'circle',o:k.o,r:k.r};else{toast('三點在同一直線上，畫不出圓');return;}}
    if(e){snapshot();addEnt(e);saveDraw();}startCmd(cmdCircle());},
  ok(){},
  preview(){const t=this.tmp();if(t)drawTemp(t);if(this.pts.length&&cur)previewPath(this.pts,cur.p,false,true);}
});}
/* 弧：3P、中心-起點-終點 */
function cmdArc(){const M=st.arcM||'3p';return pointsCmd({name:'arc',
  init(){kp.setMode('xy');},
  extraBtns(){return modeBtns([['3p','3P'],['cse','中心']],M,k=>{st.arcM=k;saveSettings();startCmd(cmdArc());});},
  hint(){const n=this.pts.length,t=this.tmp();const info=t?`　半徑 ${fmt(t.r)}　弧長 ${fmt(t.r*sweepOf(t.a0,t.a1))}`:'';
    if(M==='3p')return[['弧（3P）：點起點','弧（3P）：點弧上經過的一點','弧（3P）：點終點'][n]+info,!!cur];
    return[['弧（中心）：點圓心','弧（中心）：點起點（決定半徑）','弧（中心）：點終點方向（逆時針）'][n]+info,!!cur];},
  tmp(){const P=this.pts,c=cur&&cur.p;if(!c||P.length<2)return null;
    if(M==='3p')return arc3(P[0],P[1],c);const r=dist(P[0],P[1]);if(r<1e-9||dist(P[0],c)<1e-9)return null;return{t:'arc',o:P[0],r,a0:angOf(P[0],P[1]),a1:angOf(P[0],c)};},
  onPoint(p){if(this.pts.length<2){this.pts.push(p);return;}const keep=cur;cur={p};const e=this.tmp();cur=keep;
    if(!e){toast(M==='3p'?'三點在同一直線上，畫不出弧':'終點不能跟圓心重合');return;}
    snapshot();addEnt({t:'arc',o:e.o.slice(),r:e.r,a0:e.a0,a1:e.a1});saveDraw();startCmd(cmdArc());},
  ok(){},
  preview(){const t=this.tmp();if(t)drawTemp(t);if(cur)previewPath(this.pts,cur.p,false,true);}
});}
/* 雲形線（擬合） */
function cmdSpline(){return pointsCmd({name:'spline',
  init(){kp.setMode('xy');},
  hint(){const n=this.pts.length;return[n?`雲形線：已 ${n} 個擬合點，點下一點。✓ 完成`:(cur?'拖曳微調，再點下一點':'雲形線（擬合）：點第一個擬合點'),!!cur];},
  onPoint(p){const P=this.pts;if(!P.length||dist(P[P.length-1],p)>1e-9)P.push(p);},
  extraBtns(){return this.pts.length>=3?[{t:'閉合',f:()=>{this.closed=true;this.finish();}}]:[];},
  ok(){this.finish();},
  finish(){const F=this.pts;if(F.length>=2){const s=splinePts(F,!!this.closed&&F.length>=3);snapshot();
      addEnt({t:'pline',pts:s.pts,kv:s.kv,closed:!!this.closed&&F.length>=3,spl:{fit:F.map(p=>p.slice())}});saveDraw();toast('已畫好雲形線');}
    startCmd(cmdSpline());},
  preview(){const F=this.pts.concat(cur?[cur.p]:[]);if(F.length>=2){const s=splinePts(F,false);drawTemp({t:'pline',pts:s.pts,closed:false});}
    for(const p of this.pts){const q=toS(p);ctx.fillStyle='#4fb3c8';ctx.fillRect(q[0]-2.5,q[1]-2.5,5,5);}}
});}
/* 多邊形 */
function cmdPolygon(){const M=st.polyM||'i',N=st.polyN||4;return pointsCmd({name:'polygon',
  init(){kp.setMode('xy');},
  extraBtns(){return[{t:`${N}邊`,c:'mode',f:()=>{const v=askNum('邊數（3–1024）',N,3,1024);if(v){st.polyN=v;saveSettings();startCmd(cmdPolygon());}}},
    ...modeBtns([['i','內接'],['c','外切'],['e','邊']],M,k=>{st.polyM=k;saveSettings();startCmd(cmdPolygon());})];},
  hint(){const n=this.pts.length;
    if(M==='e')return[n?`多邊形（邊）：點這條邊的第二點（多邊形在左側）${cur?'　邊長 '+fmt(dist(this.pts[0],cur.p)):''}`:'多邊形（邊）：點一條邊的第一點',!!cur];
    return[n?`多邊形（${M==='i'?'內接於圓：點頂點':'外切於圓：點邊的中點'}），或輸入半徑${cur?'　半徑 '+fmt(dist(this.pts[0],cur.p)):''}`:`多邊形 ${N} 邊：點中心`,!!cur];},
  verts(c){const P=this.pts;if(!P.length||!c)return null;return M==='e'?polyEdge(P[0],c,N):polyVerts(P[0],c,N,M);},
  onPoint(p){if(!this.pts.length){this.pts.push(p);return;}const v=this.verts(p);
    if(v){snapshot();addEnt({t:'pline',pts:v,closed:true});saveDraw();}startCmd(cmdPolygon());},
  ok(){},
  preview(){const v=this.verts(cur&&cur.p);if(v)drawTemp({t:'pline',pts:v,closed:true});if(this.pts.length&&cur)previewPath(this.pts,cur.p,false,true);}
});}
/* 文字 */
let textCtx=null;
function cmdText(){return pointsCmd({name:'text',keypad:'xy',
  hint(){return[cur?'拖曳微調位置，再點一下或按 ✓ 放文字':'文字：點文字的位置（左下角）',!!cur];},
  onPoint(p){openTextDlg(p);},
  ok(){}
});}
function openTextDlg(p,keep){
  if(!keep){textCtx={p:p.slice()};$('txtVal').value='';$('txtH').value=st.textH;$('txtA').value=textCtx.ang!=null?textCtx.ang:0;}
  openSheet('textSheet');setTimeout(()=>{try{$('txtVal').focus();}catch(_){}},150);
}
$('txtOk').onclick=()=>{
  const v=$('txtVal').value.trim();if(!v||!textCtx){closeSheet('textSheet');return;}
  const h=parseFloat($('txtH').value)||st.textH,a=parseFloat($('txtA').value)||0;st.textH=h;saveSettings();
  snapshot();addEnt({t:'text',p:textCtx.p,h,rot:rad(a),lines:v.split('\n'),ha:0,y0:0,ls:h*1.667,wf:1,font:'txt',big:'chineset'});saveDraw();
  closeSheet('textSheet');textCtx=null;startCmd(cmdText());
};
$('txtAlign').onclick=()=>{
  closeSheet('textSheet');const saved=textCtx;
  startCmd({kind:'pickObj',name:'textalign',hint:()=>['點一條線，文字會順著它的方向',false],
    onPick(e,w){const a=lineAngleAt(e,w);if(a==null){toast('這個物件取不到方向');return;}
      let d=normA(deg(a));if(d>90&&d<=270)d=normA(d-180);textCtx=saved;cmd=null;$('txtA').value=d.toFixed(2);openTextDlg(null,true);startCmdQuiet(cmdText());}});
};
function startCmdQuiet(c){cmd=c;cur=null;kp.unlockAll();if(c.keypad)kp.show(c.keypad);refreshCmd();updateUI();}
function lineAngleAt(e,w){
  if(e.t==='line')return Math.atan2(e.b[1]-e.a[1],e.b[0]-e.a[0]);
  if(e.t==='pline'||e.t==='ink'){const P=e.pts;let bi=-1,bd=Infinity;for(let i=1;i<P.length;i++){const d=dist(closestOnSeg(w,P[i-1],P[i]),w);if(d<bd){bd=d;bi=i;}}if(bi<0)return null;return Math.atan2(P[bi][1]-P[bi-1][1],P[bi][0]-P[bi-1][0]);}
  if(e.t==='arc'||e.t==='circle'){const a=Math.atan2(w[1]-e.o[1],w[0]-e.o[0]);return a+Math.PI/2;}
  if(e.t==='text')return e.rot;
  return null;
}

/* 量測 */
function cmdMeasure(){return pointsCmd({name:'mlen',
  init(){kp.setMode('xy');},
  hint(){const P=this.pts.concat(cur?[cur.p]:[]);if(P.length<2)return[cur?'拖曳微調，再點下一點':'量長度：點第一點',!!cur];
    const a=P[P.length-2],b=P[P.length-1];let tot=0;for(let i=1;i<P.length;i++)tot+=dist(P[i-1],P[i]);
    return[`本段 ${fmt(dist(a,b))}　方位角 ${dms(azimuth(a,b))}`+(P.length>2?`　總長 ${fmt(tot)}`:'')+'　（✓ 結束）',true];},
  onPoint(p){this.pts.push(p);},
  ok(){const P=this.pts;let tot=0;for(let i=1;i<P.length;i++)tot+=dist(P[i-1],P[i]);const t=P.length>=2?`量測結果：${P.length-1} 段，總長 ${fmt(tot)}`:'';startCmd(cmdMeasure());if(t)setHint(t,true);},
  preview(){previewPath(this.pts,cur&&cur.p,false,true,'#4fe0ff');}
});}
// 把經緯度丟給 Google 地圖導航（不用金鑰）；App 裡交給手機開 Google 地圖，網頁版開新分頁
function openNav(la,lo){const u=`https://www.google.com/maps/dir/?api=1&destination=${la.toFixed(7)},${lo.toFixed(7)}&travelmode=driving`;
  if(NATIVE||isApp){location.href=u;return;}const w=window.open(u,'_blank');if(!w)location.href=u;}
function cmdCoord(ll){return pointsCmd({name:ll?'ll':'xy',live:true,keypad:'xy',
  base(){return null;},
  hint(){if(!cur)return[ll?'經緯度：點圖上任一點（可拖曳、可鎖點，或輸入坐標）':'點坐標：點圖上任一點（可拖曳、可鎖點）',false];
    const p=cur.p;if(!ll)return[`X ${fmt(p[0])}\nY ${fmt(p[1])}`,'big'];
    const[la,lo]=tm2ll(p[0],p[1],st.lon0);return[`${dmsLL(la,'N','S')}\n${dmsLL(lo,'E','W')}`,'big'];},
  extraBtns(){return cur?[{t:'複製',f:()=>{const p=cur.p;let t;if(ll){const[la,lo]=tm2ll(p[0],p[1],st.lon0);t=`${dmsLL(la,'N','S')} ${dmsLL(lo,'E','W')}`;}else t=`${fmt(p[0])},${fmt(p[1])}`;
      (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('已複製：'+t)).catch(()=>toast(t,4000));}},
    ...(ll?[{t:'導航',f:()=>{const[la,lo]=tm2ll(cur.p[0],cur.p[1],st.lon0);openNav(la,lo);}}]:[])]:[];},
  onPoint(){},ok(){endCmd();}
});}

/* ---- 選取物件的共用步驟 ---- */
function selectStage(o){const x=o.extra||{};boxArm=false;return{kind:'select',name:x.name||o.name,filter:x.filter||o.filter,group:!!x.group,
  extraBtns(){return[{t:boxArm?'框選：拖曳畫框':'框選',c:'mode'+(boxArm?' on':''),f:()=>{boxArm=!boxArm;refreshCmd();}}];},
  hint:o.hint||function(){return[`${o.title}：點選要${o.verb}的物件${x.group?'（底圖也可以，圖塊會整個選起來）':''}（再點一次取消；按「框選」再拖曳可一次選一片：往右拉選框內的、往左拉碰到就選），選好按 ✓　已選 ${selSet.size}`,selSet.size>0];},
  ok:o.ok||function(){if(!selSet.size){toast('還沒選物件');return;}o.next();}};}
const ownOnly=e=>!e.imp;
let grpIdx=null;
function groupOf(e){if(nativeOn&&e.g){const a=imp.filter(x=>x.g===e.g);return a.concat(nativeGroup(e.g));}if(!grpIdx){grpIdx=new Map();for(const x of imp)if(x.g){let a=grpIdx.get(x.g);if(!a)grpIdx.set(x.g,a=[]);a.push(x);}}return grpIdx.get(e.g)||[e];}
// 底圖物件複製成自己的：放到目前圖層、顏色隨圖層，保留線型
function ownCopy(e){const c=JSON.parse(JSON.stringify(e));if(c.imp){delete c.imp;delete c.g;delete c.c;delete c._sg;delete c.rc;c.ly=st.cur;if(c.lt==='BYLAYER'||c.lt==='BYBLOCK')delete c.lt;}return c;}

/* ---------- 框選：往右拉＝框內的（window），往左拉＝碰到就選（crossing） ---------- */
let boxArm=false,boxNow=null;
function entPolys(e){
  switch(e.t){
    case'line':case'dim':return[[e.a,e.b]];
    case'pline':return[e.closed?e.pts.concat([e.pts[0]]):e.pts];
    case'ink':return[e.pts];
    case'circle':case'arc':{const a0=e.t==='arc'?e.a0:0,sw=e.t==='arc'?sweepOf(e.a0,e.a1):TAU,n=Math.max(8,Math.ceil(sw/TAU*64)),P=[];
      for(let i=0;i<=n;i++){const a=a0+sw*i/n;P.push([e.o[0]+e.r*Math.cos(a),e.o[1]+e.r*Math.sin(a)]);}return[P];}
    default:{const b=e.bb||entBox(e);return[[[b[0],b[1]],[b[2],b[1]],[b[2],b[3]],[b[0],b[3]],[b[0],b[1]]]];}
  }
}
function segHitsRect(a,b,R){// Liang–Barsky
  let t0=0,t1=1;const dx=b[0]-a[0],dy=b[1]-a[1];
  for(const[pp,q]of[[-dx,a[0]-R[0]],[dx,R[2]-a[0]],[-dy,a[1]-R[1]],[dy,R[3]-a[1]]]){
    if(pp===0){if(q<0)return false;continue;}const t=q/pp;if(pp<0){if(t>t1)return false;if(t>t0)t0=t;}else{if(t<t0)return false;if(t<t1)t1=t;}}
  return true;
}
function boxHit(e,R,cross){
  const b=e.bb||entBox(e);if(!b.every(isFinite))return false;
  if(!cross)return b[0]>=R[0]&&b[2]<=R[2]&&b[1]>=R[1]&&b[3]<=R[3];
  if(b[2]<R[0]||b[0]>R[2]||b[3]<R[1]||b[1]>R[3])return false;
  if(b[0]>=R[0]&&b[2]<=R[2]&&b[1]>=R[1]&&b[3]<=R[3])return true;
  if(e.t==='text'||e.t==='point')return true;
  for(const P of entPolys(e))for(let i=0;i+1<P.length;i++)if(segHitsRect(P[i],P[i+1],R))return true;
  return false;
}
function boxSelect(s0,s1){
  const a=toW(s0),b=toW(s1),R=[Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.max(a[0],b[0]),Math.max(a[1],b[1])],cross=s1[0]<s0[0];
  const f=cmd&&cmd.filter;let n=0;const ok=e=>(!f||f(e))&&boxHit(e,R,cross);
  for(const e of st.ents)if(ownShown(e)&&ok(e)&&!selSet.has(e)){selSet.add(e);n++;}
  if(!f||f({imp:1,t:'line',a:[0,0],b:[0,0]})){
    const L=grid?queryImp(R[0],R[1],R[2],R[3]):imp;for(const e of L)if(shown(e)&&ok(e)&&!selSet.has(e)){selSet.add(e);n++;}
    if(nativeOn)for(const e of nativeNear(R[0],R[1],R[2],R[3],200000))if(shown(e)&&ok(e)&&!selSet.has(e)){selSet.add(e);n++;}
  }
  toast(`${cross?'碰到框':'框內'}選到 ${n} 個`,1200);
}

/* ---------- 剪貼簿：複製到剪貼簿（含底圖，保留圖層、顏色、線型）、原座標貼上 ---------- */
let clip=null;const _aciC=new Map();
function hexAci(h){if(h==null)return 7;h=String(h);if(_aciC.has(h))return _aciC.get(h);
  const v=parseInt(h.replace('#',''),16);if(!isFinite(v))return 7;const r=v>>16&255,g=v>>8&255,b=v&255;let bi=7,bd=1e9;
  for(let i=1;i<=255;i++){const w=parseInt(aciHex(i).slice(1),16),d=((w>>16&255)-r)**2+((w>>8&255)-g)**2+((w&255)-b)**2;if(d<bd){bd=d;bi=i;}if(!d)break;}
  _aciC.set(h,bi);return bi;}
function clipCopy(e){const c=JSON.parse(JSON.stringify(e));
  if(c.imp){for(const k of['imp','g','c','_sg','rc','nid','bb','nt','ti'])delete c[k];c.ci=hexAci(e.c);if(c.lt==='BYLAYER'||c.lt==='BYBLOCK')delete c.lt;if(!c.ly)c.ly='0';}
  else{delete c._sg;delete c.rc;}
  return c;}
function cmdCopyClip(){return selectStage({title:'複製到剪貼簿',verb:'複製',next(){
  const ents=[...selSet].map(clipCopy),lys=new Map();
  for(const e of ents)if(!lys.has(e.ly)){const L=st.layers.find(l=>l.name===e.ly),I=impLayers.find(l=>l.name===e.ly);lys.set(e.ly,L?{name:L.name,ci:L.ci,lt:L.lt}:{name:e.ly,ci:I?hexAci(I.c):(e.ci||7),lt:'CONTINUOUS'});}
  clip={ents,layers:[...lys.values()]};try{localStorage.setItem('simplecad.clip',JSON.stringify(clip));}catch(_){}
  toast(`已複製 ${ents.length} 個到剪貼簿（換到別張圖用「原座標貼上」）`,3000);endCmd();
},extra:{name:'copyclip',group:true,filter:e=>!0}});}
function cmdPasteOrig(){
  if(!clip){try{clip=JSON.parse(localStorage.getItem('simplecad.clip')||'null');}catch(_){}}
  if(!clip||!clip.ents||!clip.ents.length){toast('剪貼簿是空的，先用「複製到剪貼簿」');return null;}
  if(cmd)endCmd();snapshot();const was=st.ents.length;
  for(const L of clip.layers||[])if(!st.layers.some(l=>l.name===L.name))st.layers.push({name:L.name,ci:L.ci||7,lt:L.lt||'CONTINUOUS',on:true});
  const add=JSON.parse(JSON.stringify(clip.ents));st.ents.push(...add);saveSettings();saveDraw();
  if(!was&&!imp.length&&!nativeOn)zoomFit();
  toast(`已在原座標貼上 ${add.length} 個`,2000);schedule();return null;
}

/* ---------- 空白圖：不載底圖、自己命名，畫的東西另外存 ---------- */
let blankName='';
function dropBase(){if(NATIVE){nativeOn=false;nFit=null;nCache.clear();try{CadNative.clearBase();}catch(_){}}imp=[];grpIdx=null;grid=null;impLayers=[];hidLy.clear();offLy.clear();frzLy.clear();impName='';syncHid();invalidateBase();}
function openBlank(name){
  saveDrawNow();dropBase();blankName=name;const key='blank:'+name;loadDraw(key);endCmd();
  let L=recentList().filter(x=>x.key!==key);L=[{key,name,blank:true,size:0,t:Date.now()},...L];
  for(const x of L.slice(RECENT_MAX))if(!x.native&&!x.blank)idbFile('f:'+x.key,null);
  recentSave(L.slice(0,RECENT_MAX));localStorage.setItem('simplecad.lastKey',key);
  if(st.ents.length)zoomFit();else schedule();
  if($('drawInfo'))$('drawInfo').textContent='空白圖：'+name;toast('已開空白圖「'+name+'」',1500);
}
function newBlank(){const d=new Date(),z=n=>String(n).padStart(2,'0');
  const v=window.prompt('空白圖名稱',`空白圖_${d.getMonth()+1}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`);
  if(v==null)return;const name=v.trim();if(!name){toast('名稱不能空白');return;}
  if(recentList().some(x=>x.key==='blank:'+name)&&!window.confirm('已經有「'+name+'」，要直接開它嗎？'))return;
  closeSheet('fileSheet');openBlank(name);}

/* 移動 / 複製 */
function cmdMove(copy){
  const title=copy?'複製':'移動';
  return selectStage({title,verb:title,next(){
    const sel=[...selSet];
    startCmdKeep(pointsCmd({name:copy?'copy':'move',init(){kp.setMode('xy');},
      hint(){return this.pts.length?[`${title}：點目的點，或輸入距離、角度`+(copy?'（可連續複製，✓ 結束）':''),true]:[`${title}：點基準點`,!!cur];},
      onPoint(p){if(!this.pts.length){this.pts.push(p);return;}const b=this.pts[0],dx=p[0]-b[0],dy=p[1]-b[1];
        snapshot();if(copy){for(const e of sel){const c=ownCopy(e);xform(c,q=>[q[0]+dx,q[1]+dy],0);st.ents.push(c);}}
        else for(const e of sel)xform(e,q=>[q[0]+dx,q[1]+dy],0);
        saveDraw();if(!copy){endCmd();toast('已移動');}},
      base(){return this.pts.length?this.pts[0]:null;},
      ok(){endCmd();},
      preview(){if(this.pts.length&&cur){const b=this.pts[0],dx=cur.p[0]-b[0],dy=cur.p[1]-b[1];ctx.globalAlpha=.6;for(const e of sel){const c=JSON.parse(JSON.stringify(e));xform(c,q=>[q[0]+dx,q[1]+dy],0);drawTemp(c);}ctx.globalAlpha=1;previewPath([b],cur.p,false,true);}}
    }));
  },extra:{name:copy?'copy':'move',filter:copy?null:ownOnly,group:copy}});
}
function startCmdKeep(c){const keep=new Set(selSet);startCmd(c);selSet=keep;schedule();}
/* 旋轉 */
function cmdRotate(){return selectStage({title:'旋轉',verb:'旋轉',next(){
  const sel=[...selSet],orig=sel.map(e=>JSON.stringify(e));
  startCmdKeep(pointsCmd({name:'rot',init(){kp.setMode('xy');},
    hint(){return this.pts.length?['旋轉：點一點決定角度，或在「角度」輸入旋轉度數（逆時針為正）',true]:['旋轉：點旋轉中心',!!cur];},
    onPoint(p){if(!this.pts.length){this.pts.push(p);kp.setMode('la');return;}const b=this.pts[0];const a=kp.num('A')!=null?rad(kp.num('A')):Math.atan2(p[1]-b[1],p[0]-b[0]);
      snapshot();for(const e of sel)rotEnt(e,b,a);saveDraw();endCmd();toast('已旋轉');},
    base(){return this.pts.length?this.pts[0]:null;},ok(){},
    preview(){if(this.pts.length&&cur){const b=this.pts[0];const a=kp.num('A')!=null?rad(kp.num('A')):Math.atan2(cur.p[1]-b[1],cur.p[0]-b[0]);ctx.globalAlpha=.6;sel.forEach(e=>{const c=JSON.parse(JSON.stringify(e));rotEnt(c,b,a);drawTemp(c);});ctx.globalAlpha=1;previewPath([b],cur.p,false,true);}}
  }));
},extra:{name:'rot',filter:ownOnly}});}
function rotEnt(e,b,a){const c=Math.cos(a),s=Math.sin(a);xform(e,q=>[b[0]+(q[0]-b[0])*c-(q[1]-b[1])*s,b[1]+(q[0]-b[0])*s+(q[1]-b[1])*c],a);}
function xform(e,f,da){
  switch(e.t){
    case'line':e.a=f(e.a);e.b=f(e.b);break;
    case'pline':case'ink':e.pts=e.pts.map(f);if(e.spl)e.spl.fit=e.spl.fit.map(f);break;
    case'circle':e.o=f(e.o);break;
    case'arc':e.o=f(e.o);e.a0+=da;e.a1+=da;break;
    case'text':e.p=f(e.p);e.rot=(e.rot||0)+da;delete e._sg;delete e.rc;break;
    case'dim':e.a=f(e.a);e.b=f(e.b);break;
    case'point':e.p=f(e.p);break;
    case'fill':e.rings=e.rings.map(r=>r.map(f));break;
  }
}
/* 刪除、改圖層 */
function cmdDelete(){return selectStage({title:'刪除',verb:'刪除',next(){snapshot();st.ents=st.ents.filter(e=>!selSet.has(e));saveDraw();toast(`已刪除 ${selSet.size} 個`);endCmd();},extra:{name:'del',filter:ownOnly}});}
function cmdChLayer(){return selectStage({title:'改圖層',verb:'改圖層',next(){
  const box=$('pickLyList');box.innerHTML='';
  for(const L of st.layers){const b=document.createElement('button');b.className='big';b.innerHTML=`<span style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${aciHex(L.ci)};margin-right:8px"></span>${L.name}`;
    b.onclick=()=>{snapshot();for(const e of selSet){e.ly=L.name;}saveDraw();closeSheet('pickLySheet');toast(`已改到「${L.name}」`);endCmd();};box.appendChild(b);}
  openSheet('pickLySheet');
},extra:{name:'chly',filter:ownOnly}});}

/* 偏移 */
function cmdOffset(){return{kind:'dist',name:'offset',keypad:'d',
  init(){kp.setMode('d');if(st.lastOff){kp.vals.D=String(st.lastOff);kp.lock.D=true;}kp.render();},
  hint(){return['偏移：輸入距離後按 ✓',false];},
  ok(){const d=kp.num('D');if(!(d>0)){toast('請輸入大於 0 的距離');return;}st.lastOff=d;saveSettings();startCmd(offsetPick(d));}
};}
function offsetPick(d){return{kind:'pickObj',name:'offset',
  hint(){return[`偏移 ${fmt(d)}：點要偏移的線（底圖的線也可以）`,true];},
  onPick(e){if(!['line','pline','circle','arc'].includes(e.t)){toast('這種物件不能偏移');return;}this.src=e;this.kind='side';selSet=new Set([e]);refreshCmd();},
  onSide(w){const r=offsetEnt(this.src,d,w);if(r){snapshot();r.ly=st.cur;delete r.imp;st.ents.push(r);saveDraw();}selSet.clear();this.kind='pickObj';this.src=null;this.hint=()=>[`偏移 ${fmt(d)}：再點下一條線，或按 ✓ 結束`,true];refreshCmd();},
  ok(){endCmd();}
};}
function cleanEnt(e){const o={t:e.t};for(const k of['a','b','o','r','a0','a1','pts','closed'])if(e[k]!==undefined)o[k]=JSON.parse(JSON.stringify(e[k]));return o;}
function offsetEnt(e,d,w){
  if(e.t==='line'){const dx=e.b[0]-e.a[0],dy=e.b[1]-e.a[1],L=Math.hypot(dx,dy);if(!L)return null;const nx=-dy/L,ny=dx/L,sg=((w[0]-e.a[0])*nx+(w[1]-e.a[1])*ny)>=0?1:-1;
    return{t:'line',a:[e.a[0]+nx*d*sg,e.a[1]+ny*d*sg],b:[e.b[0]+nx*d*sg,e.b[1]+ny*d*sg]};}
  if(e.t==='circle'||e.t==='arc'){const inside=dist(w,e.o)<e.r,r=e.r+(inside?-d:d);if(r<=0){toast('偏移後半徑小於 0');return null;}const o=cleanEnt(e);o.r=r;return o;}
  if(e.t==='pline'){
    const P=e.pts.filter((p,i,a)=>i===0||dist(p,a[i-1])>1e-9);const n=P.length;if(n<2)return null;const closed=!!e.closed;
    let bi=0,bd=Infinity;const segs=closed?n:n-1;for(let i=0;i<segs;i++){const a=P[i],b=P[(i+1)%n];const dd=dist(closestOnSeg(w,a,b),w);if(dd<bd){bd=dd;bi=i;}}
    const a=P[bi],b=P[(bi+1)%n],sg=((b[0]-a[0])*(w[1]-a[1])-(b[1]-a[1])*(w[0]-a[0]))>=0?1:-1;
    const off=[];for(let i=0;i<segs;i++){const p=P[i],q=P[(i+1)%n],dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy),nx=-dy/L*d*sg,ny=dx/L*d*sg;off.push([[p[0]+nx,p[1]+ny],[q[0]+nx,q[1]+ny]]);}
    const lineX=(s1,s2)=>{const r=[s1[1][0]-s1[0][0],s1[1][1]-s1[0][1]],s=[s2[1][0]-s2[0][0],s2[1][1]-s2[0][1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return s1[1];const t=((s2[0][0]-s1[0][0])*s[1]-(s2[0][1]-s1[0][1])*s[0])/den;return[s1[0][0]+t*r[0],s1[0][1]+t*r[1]];};
    const out=[];
    if(!closed){out.push(off[0][0]);for(let i=1;i<off.length;i++)out.push(lineX(off[i-1],off[i]));out.push(off[off.length-1][1]);}
    else for(let i=0;i<off.length;i++)out.push(lineX(off[(i-1+off.length)%off.length],off[i]));
    return{t:'pline',pts:out,closed};
  }
  return null;
}

/* ---------- 接合（JOIN）：端點相接的直線、多段線接成一條多段線 ---------- */
const JOIN_TOL=1e-4;
function cmdJoin(){return selectStage({title:'接合',verb:'接合',next(){
  const sel=[...selSet].filter(e=>e.t==='line'||(e.t==='pline'&&!e.closed));
  if(sel.length<2){toast('至少要選兩條直線或沒閉合的多段線');return;}
  const r=joinEnts(sel);
  if(!r.joined){toast('沒有可以接的：端點要碰在一起（用端點鎖點畫的線才會剛好接上）',3500);return;}
  snapshot();const first=st.ents.indexOf(sel[0]);
  st.ents=st.ents.filter(e=>!r.used.has(e));st.ents.splice(Math.min(first,st.ents.length),0,...r.out);
  saveDraw();endCmd();toast(`已接合 ${r.joined} 段成 ${r.out.length} 條`+(r.left?`，${r.left} 條沒接上`:''),3000);
},extra:{name:'join',filter:e=>!e.imp&&(e.t==='line'||(e.t==='pline'&&!e.closed))}});}
function joinEnts(sel){
  const ch=sel.map(e=>({e,pts:e.t==='line'?[e.a.slice(),e.b.slice()]:e.pts.map(p=>p.slice()),done:false}));
  const same=(a,b)=>dist(a,b)<=JOIN_TOL;const out=[],used=new Set();let joined=0,left=0;
  for(const c of ch){
    if(c.done)continue;c.done=true;let P=c.pts.slice(),grp=[c],closed=false,grew=true;
    while(grew&&!closed){grew=false;
      for(const d of ch){if(d.done)continue;const Q=d.pts,h=P[0],t=P[P.length-1];
        if(same(t,Q[0]))P=P.concat(Q.slice(1));else if(same(t,Q[Q.length-1]))P=P.concat(Q.slice(0,-1).reverse());
        else if(same(h,Q[Q.length-1]))P=Q.slice(0,-1).concat(P);else if(same(h,Q[0]))P=Q.slice(1).reverse().concat(P);else continue;
        d.done=true;grp.push(d);grew=true;
        if(P.length>3&&same(P[0],P[P.length-1])){P.pop();closed=true;break;}}}
    if(grp.length<2){left++;continue;}
    joined+=grp.length;for(const x of grp)used.add(x.e);
    const k=keepProps(c.e);delete k.kv;out.push(Object.assign({t:'pline',pts:P,closed},k));
  }
  return{out,used,joined,left};
}

/* ---------- 打斷（BREAK）：點物件上兩點，中間那段刪掉；兩點一樣＝從那點斷開 ---------- */
function cmdBreak(){return{kind:'pickObj',name:'brk',filter:e=>!e.imp&&['line','pline','circle','arc'].includes(e.t),
  hint(){return['打斷：點要打斷的線（自己畫的）',true];},
  onPick(e){const tgt=e;selSet=new Set([e]);
    startCmdKeep(pointsCmd({name:'brk',keypad:null,
      hint(){return this.pts.length?['打斷：點第二點（中間那段會刪掉），或按「在此斷開」只從第一點斷開',!!cur]:['打斷：點第一點（可鎖點）',!!cur];},
      extraBtns(){return this.pts.length?[{t:'在此斷開',f:()=>this.done(this.pts[0])}]:[];},
      onPoint(p){if(!this.pts.length){this.pts.push(p);return;}this.done(p);},
      done(p2){const r=breakEnt(tgt,this.pts[0],p2);if(!r){toast(tgt.t==='circle'?'圓要點兩個不同的點':'打斷不了');return;}
        snapshot();const i=st.ents.indexOf(tgt);st.ents.splice(i,1,...r);saveDraw();endCmd();toast(r.length>1?'已打斷成兩段':'已打斷');},
      ok(){if(this.pts.length)this.done(this.pts[0]);else endCmd();},
      preview(){for(const q of this.pts){const s=toS(q);ctx.strokeStyle='#ff5050';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(s[0]-7,s[1]-7);ctx.lineTo(s[0]+7,s[1]+7);ctx.moveTo(s[0]+7,s[1]-7);ctx.lineTo(s[0]-7,s[1]+7);ctx.stroke();}}
    }));},
  ok(){endCmd();}
};}
// 物件上的位置：直線 t(0..1)、多段線弧長、圓/弧角度
function plCum(P,closed){const n=P.length,segs=closed?n:n-1,cum=[0];for(let i=0;i<segs;i++)cum.push(cum[i]+dist(P[i],P[(i+1)%n]));return{cum,segs,T:cum[segs]};}
function plParam(P,closed,w){const{cum,segs}=plCum(P,closed),n=P.length;let bd=Infinity,s=0;for(let i=0;i<segs;i++){const a=P[i],b=P[(i+1)%n],q=closestOnSeg(w,a,b),d=dist(q,w);if(d<bd){bd=d;s=cum[i]+dist(a,q);}}return s;}
function plSub(P,closed,s0,s1){const n=P.length,{cum,segs}=plCum(P,closed),tol=1e-9;
  const at=s=>{let i=0;while(i<segs-1&&cum[i+1]<s)i++;const a=P[i],b=P[(i+1)%n],L=cum[i+1]-cum[i],t=L?(s-cum[i])/L:0;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
  const out=[at(s0)];for(let i=1;i<segs;i++){if(cum[i]>s0+tol&&cum[i]<s1-tol)out.push(P[i].slice());}out.push(at(s1));return out;}
function breakEnt(e,p1,p2){
  const kp_=keepProps(e),mk=o=>Object.assign(o,kp_),tiny=1e-9;
  if(e.t==='line'){const d=[e.b[0]-e.a[0],e.b[1]-e.a[1]],L2=d[0]*d[0]+d[1]*d[1];if(!L2)return null;
    const tp=p=>Math.max(0,Math.min(1,((p[0]-e.a[0])*d[0]+(p[1]-e.a[1])*d[1])/L2)),P=t=>[e.a[0]+d[0]*t,e.a[1]+d[1]*t];
    let t1=tp(p1),t2=tp(p2);if(t1>t2)[t1,t2]=[t2,t1];const r=[];
    if(t1>tiny)r.push(mk({t:'line',a:e.a.slice(),b:P(t1)}));if(t2<1-tiny)r.push(mk({t:'line',a:P(t2),b:e.b.slice()}));return r.length?r:null;}
  if(e.t==='pline'){const P=e.pts,closed=!!e.closed,{T}=plCum(P,closed);if(!(T>0))return null;
    let s1=plParam(P,closed,p1),s2=plParam(P,closed,p2);
    if(!closed){if(s1>s2)[s1,s2]=[s2,s1];const r=[];
      if(s1>tiny)r.push(mk({t:'pline',pts:plSub(P,false,0,s1),closed:false}));if(s2<T-tiny)r.push(mk({t:'pline',pts:plSub(P,false,s2,T),closed:false}));return r.length?r:null;}
    // 閉合：從第一點沿畫線方向到第二點那段刪掉；兩點一樣就在那點切開
    const P2=P.concat(P,[P[0].slice()]);
    if(Math.abs(s2-s1)<tiny)return[mk({t:'pline',pts:plSub(P2,false,s1,s1+T),closed:false})];
    if(s2<s1)s2+=T;return[mk({t:'pline',pts:plSub(P2,false,s2,s1+T),closed:false})];}
  if(e.t==='circle'||e.t==='arc'){const a1=angOf(e.o,p1),a2=angOf(e.o,p2);
    if(e.t==='circle'){if(Math.abs(((a2-a1)%TAU+TAU)%TAU)<1e-9)return null;return[mk({t:'arc',o:e.o.slice(),r:e.r,a0:a2,a1:a1})];}
    const sw=sweepOf(e.a0,e.a1),rel=a=>{const x=((a-e.a0)%TAU+TAU)%TAU;return x>sw+1e-9?(x-sw<TAU-x?sw:0):x;};
    let t1=rel(a1),t2=rel(a2);if(t1>t2)[t1,t2]=[t2,t1];const r=[];
    if(t1>tiny)r.push(mk({t:'arc',o:e.o.slice(),r:e.r,a0:e.a0,a1:e.a0+t1}));if(t2<sw-tiny)r.push(mk({t:'arc',o:e.o.slice(),r:e.r,a0:e.a0+t2,a1:e.a1}));return r.length?r:null;}
  return null;
}

/* ---------- 夾點：選到自己畫的物件，拖端點／頂點改形狀，拖中點／圓心整個移動 ---------- */
function gripsOf(e){
  if(!e||e.imp)return[];const G=[];
  switch(e.t){
    case'line':G.push({p:e.a,k:'a'},{p:e.b,k:'b'},{p:midp(e.a,e.b),k:'move'});break;
    case'dim':G.push({p:e.a,k:'a'},{p:e.b,k:'b'});break;
    case'pline':if(e.spl)e.spl.fit.forEach((p,i)=>G.push({p,k:'fit',i}));else e.pts.forEach((p,i)=>G.push({p,k:'v',i}));break;
    case'circle':G.push({p:e.o,k:'move'});for(const[a,b]of[[1,0],[0,1],[-1,0],[0,-1]])G.push({p:[e.o[0]+a*e.r,e.o[1]+b*e.r],k:'rad'});break;
    case'arc':{const[p0,p1]=arcEnds(e),m=e.a0+sweepOf(e.a0,e.a1)/2;G.push({p:p0,k:'a0'},{p:p1,k:'a1'},{p:[e.o[0]+e.r*Math.cos(m),e.o[1]+e.r*Math.sin(m)],k:'rad'},{p:e.o,k:'move'});break;}
    case'point':case'text':G.push({p:e.p,k:'move'});break;
  }
  return G;
}
function hitGrip(sp){if(!selE||selE.imp||!ownShown(selE))return null;let best=null,bd=22;for(const g of gripsOf(selE)){const q=toS(g.p),d=dist(q,sp);if(d<bd){bd=d;best=g;}}return best;}
function applyGrip(e,g,p){
  const c=JSON.parse(JSON.stringify(e)),b=g.p;
  switch(g.k){
    case'a':c.a=p.slice();break;case'b':c.b=p.slice();break;
    case'v':c.pts[g.i]=p.slice();break;
    case'fit':{c.spl.fit[g.i]=p.slice();const s=splinePts(c.spl.fit,!!c.closed);c.pts=s.pts;c.kv=s.kv;break;}
    case'rad':{const r=dist(c.o,p);if(r>1e-9)c.r=r;break;}
    case'a0':c.a0=angOf(c.o,p);break;case'a1':c.a1=angOf(c.o,p);break;
    case'move':{const dx=p[0]-b[0],dy=p[1]-b[1];xform(c,q=>[q[0]+dx,q[1]+dy],0);break;}
  }
  return c;
}
function drawGrips(e){for(const g of gripsOf(e)){const q=toS(g.p);ctx.fillStyle=g.k==='move'?'#22c55e':'#3b82f6';ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.fillRect(q[0]-5,q[1]-5,10,10);ctx.strokeRect(q[0]-5,q[1]-5,10,10);}}
function gripCmd(e,g){
  const ctr=(g.k==='rad'||g.k==='a0'||g.k==='a1')?e.o:null;
  return pointsCmd({name:'grip',
    hint(){return[cur?'拖曳微調位置（可鎖點、輸入長度角度），點一下或按 ✓ 確定':(g.k==='move'?'移動：點新位置':'夾點：點新位置'),!!cur];},
    base(){return ctr||g.p;},
    onPoint(p){const c=applyGrip(e,g,p);const i=st.ents.indexOf(e);
      if(i>=0&&dist(p,g.p)>1e-12){snapshot();st.ents[i]=c;saveDraw();}
      endCmd();selE=i>=0?st.ents[i]:null;setHint(baseHintText(),!!selE);schedule();},
    ok(){endCmd();selE=e;setHint(baseHintText(),true);},
    cancel(){endCmd();selE=e;setHint(baseHintText(),true);schedule();return false;},
    preview(){const p=cur?cur.p:g.p;const c=applyGrip(e,g,p);ctx.globalAlpha=.75;drawTemp(c);ctx.globalAlpha=1;
      const q=toS(g.p);ctx.fillStyle='#ef4444';ctx.fillRect(q[0]-5,q[1]-5,10,10);if(cur)previewPath([ctr||g.p],cur.p,false,true);}
  });
}

/* 修剪 / 延伸 */
function cmdTrimExt(ext){
  const title=ext?'延伸':'修剪';
  return selectStage({title,verb:'當邊界',hint(){return[`${title}：點選邊界線（底圖的線也可以），按 ✓。不選直接按 ✓＝畫面上全部都當邊界　已選 ${selSet.size}`,selSet.size>0];},
    ok(){const bounds=selSet.size?[...selSet]:st.ents.filter(e=>ownShown(e)&&visible(e)).concat(visibleImp().filter(shown),nativeView(30000));startCmd(trimPick(ext,bounds));},extra:{name:ext?'extend':'trim'}});
}
function trimPick(ext,bounds){
  const prims=[];for(const e of bounds)primsOf(e,prims);
  return{kind:'pickObj',name:ext?'extend':'trim',bounds:new Set(bounds),
    hint(){return[ext?'延伸：點要延伸的線，靠近要延伸的那一端（✓ 結束）':'修剪：點要剪掉的那一段（✓ 結束）',true];},
    filter:ownOnly,
    onPick(e,w){const r=ext?extendEnt(e,w,prims.filter(p=>p.src!==e)):trimEnt(e,w,prims.filter(p=>p.src!==e));
      if(!r){toast(ext?'找不到可以延伸到的邊界':'這段兩邊沒有交點，剪不了');return;}
      snapshot();const i=st.ents.indexOf(e);st.ents.splice(i,1,...r);saveDraw();schedule();},
    ok(){endCmd();}
  };
}
function primsOf(e,out){
  const add=(a,b)=>out.push({t:'line',a,b,src:e});
  switch(e.t){
    case'line':add(e.a,e.b);break;
    case'pline':case'ink':{const P=e.pts;for(let i=1;i<P.length;i++)add(P[i-1],P[i]);if(e.closed&&P.length>2)add(P[P.length-1],P[0]);break;}
    case'circle':out.push({t:'circle',o:e.o,r:e.r,src:e});break;
    case'arc':out.push({t:'circle',o:e.o,r:e.r,arc:[e.a0,e.a1],src:e});break;
    case'fill':for(const r of e.rings)for(let i=0;i<r.length;i++)add(r[i],r[(i+1)%r.length]);break;
  }
}
function hitsOnSeg(a,b,prims){
  const out=[];
  for(const p of prims){
    const pts=p.t==='line'?segSeg(a,b,p.a,p.b):segCirc(a,b,p.o,p.r).filter(q=>!p.arc||inRange(Math.atan2(q[1]-p.o[1],q[0]-p.o[0]),...p.arc));
    for(const q of pts){const L=dist(a,b);if(L)out.push(dist(a,q)/L);}
  }
  return out;
}
function trimEnt(e,w,prims){
  const tol=1e-7;
  if(e.t==='line'){const ts=hitsOnSeg(e.a,e.b,prims).filter(t=>t>tol&&t<1-tol).sort((x,y)=>x-y);const L=dist(e.a,e.b);
    const tp=L?((w[0]-e.a[0])*(e.b[0]-e.a[0])+(w[1]-e.a[1])*(e.b[1]-e.a[1]))/(L*L):0;
    const lo=Math.max(0,...ts.filter(t=>t<tp)),hi=Math.min(1,...ts.filter(t=>t>tp));if(lo===0&&hi===1)return null;
    const P=t=>[e.a[0]+(e.b[0]-e.a[0])*t,e.a[1]+(e.b[1]-e.a[1])*t],r=[];
    if(lo>0)r.push(Object.assign(cleanEnt(e),keepProps(e),{a:e.a.slice(),b:P(lo)}));if(hi<1)r.push(Object.assign(cleanEnt(e),keepProps(e),{a:P(hi),b:e.b.slice()}));return r;}
  if(e.t==='pline'||e.t==='ink'){
    const P=e.pts,n=P.length,closed=!!e.closed&&e.t==='pline',cum=[0];const segs=closed?n:n-1;
    for(let i=0;i<segs;i++)cum.push(cum[i]+dist(P[i],P[(i+1)%n]));const T=cum[segs];
    const cuts=[];for(let i=0;i<segs;i++){const a=P[i],b=P[(i+1)%n],L=cum[i+1]-cum[i];for(const t of hitsOnSeg(a,b,prims))cuts.push(cum[i]+t*L);}
    let bi=0,bd=Infinity,sp=0;for(let i=0;i<segs;i++){const a=P[i],b=P[(i+1)%n],q=closestOnSeg(w,a,b),d=dist(q,w);if(d<bd){bd=d;bi=i;sp=cum[i]+dist(a,q);}}
    const cs=[...new Set(cuts.map(c=>+c.toFixed(9)))].filter(c=>c>tol&&c<T-tol).sort((x,y)=>x-y);
    const at=s=>{let i=0;while(i<segs-1&&cum[i+1]<s)i++;const a=P[i],b=P[(i+1)%n],L=cum[i+1]-cum[i],t=L?(s-cum[i])/L:0;return[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];};
    const sub=(s0,s1)=>{const out=[at(s0)];for(let i=0;i<=segs;i++){const c=cum[i];if(c>s0+tol&&c<s1-tol)out.push(P[i%n].slice());}out.push(at(s1));return out;};
    if(!closed){const lo=Math.max(0,...cs.filter(c=>c<sp)),hi=Math.min(T,...cs.filter(c=>c>sp));if(lo===0&&hi===T)return null;const r=[];
      if(lo>tol)r.push(Object.assign({t:e.t,pts:sub(0,lo),closed:false},keepProps(e)));if(hi<T-tol)r.push(Object.assign({t:e.t,pts:sub(hi,T),closed:false},keepProps(e)));return r;}
    if(cs.length<2)return null;
    let lo=cs.filter(c=>c<sp).pop(),hi=cs.find(c=>c>sp);
    if(lo==null)lo=cs[cs.length-1]-T;if(hi==null)hi=cs[0]+T;
    const keep=[];const s0=hi,s1=lo+T;// 從 hi 繞一圈到 lo
    const N=40;for(let k=0;k<=N;k++){}
    const pts=[];const step=(s)=>at(((s%T)+T)%T);
    pts.push(step(s0));for(let i=0;i<=2*segs;i++){const c=cum[i%segs]+(i>=segs?T:0);if(c>s0+tol&&c<s1-tol)pts.push(P[i%n].slice());}pts.push(step(s1));
    void keep;return[Object.assign({t:'pline',pts,closed:false},keepProps(e))];
  }
  if(e.t==='circle'||e.t==='arc'){
    const ang=[];for(const p of prims){const pts=p.t==='line'?segCirc(p.a,p.b,e.o,e.r):circCirc(e.o,e.r,p.o,p.r).filter(q=>!p.arc||inRange(Math.atan2(q[1]-p.o[1],q[0]-p.o[0]),...p.arc));for(const q of pts)ang.push(Math.atan2(q[1]-e.o[1],q[0]-e.o[0]));}
    const pa=Math.atan2(w[1]-e.o[1],w[0]-e.o[0]);
    if(e.t==='circle'){if(ang.length<2)return null;const rel=a=>((a-pa)%TAU+TAU)%TAU;const sorted=ang.slice().sort((x,y)=>rel(x)-rel(y));const after=sorted[0],before=sorted[sorted.length-1];
      return[Object.assign({t:'arc',o:e.o.slice(),r:e.r,a0:after,a1:before},keepProps(e))];}
    const sw=sweepOf(e.a0,e.a1),rel=a=>((a-e.a0)%TAU+TAU)%TAU,rp=rel(pa);
    const ts=ang.map(rel).filter(t=>t>1e-9&&t<sw-1e-9).sort((x,y)=>x-y);
    const lo=Math.max(0,...ts.filter(t=>t<rp)),hi=Math.min(sw,...ts.filter(t=>t>rp));if(lo===0&&hi===sw)return null;
    const r=[];if(lo>1e-9)r.push(Object.assign({t:'arc',o:e.o.slice(),r:e.r,a0:e.a0,a1:e.a0+lo},keepProps(e)));if(hi<sw-1e-9)r.push(Object.assign({t:'arc',o:e.o.slice(),r:e.r,a0:e.a0+hi,a1:e.a1},keepProps(e)));return r;
  }
  return null;
}
function keepProps(e){const o={};for(const k of['ly','ci','lt','w'])if(e[k]!==undefined)o[k]=e[k];if(e.spl)o.kv=[];return o;}
function rayHit(o,d,prims){
  let best=Infinity;
  for(const p of prims){
    if(p.t==='line'){const s=[p.b[0]-p.a[0],p.b[1]-p.a[1]],den=d[0]*s[1]-d[1]*s[0];if(Math.abs(den)<1e-12)continue;
      const q=[p.a[0]-o[0],p.a[1]-o[1]],t=(q[0]*s[1]-q[1]*s[0])/den,u=(q[0]*d[1]-q[1]*d[0])/den;if(t>1e-7&&u>=-1e-9&&u<=1+1e-9&&t<best)best=t;}
    else{const f=[o[0]-p.o[0],o[1]-p.o[1]],B=2*(f[0]*d[0]+f[1]*d[1]),C=f[0]*f[0]+f[1]*f[1]-p.r*p.r,D=B*B-4*C;if(D<0)continue;const sq=Math.sqrt(D);
      for(const t of[(-B-sq)/2,(-B+sq)/2]){if(t<=1e-7||t>=best)continue;const q=[o[0]+d[0]*t,o[1]+d[1]*t];if(p.arc&&!inRange(Math.atan2(q[1]-p.o[1],q[0]-p.o[0]),...p.arc))continue;best=t;}}
  }
  return isFinite(best)?best:null;
}
function extendEnt(e,w,prims){
  if(e.t==='line'){const atB=dist(w,e.b)<dist(w,e.a);const from=atB?e.b:e.a,to=atB?e.a:e.b,L=dist(from,to);if(!L)return null;const d=[(from[0]-to[0])/L,(from[1]-to[1])/L];
    const t=rayHit(from,d,prims);if(t==null)return null;const np=[from[0]+d[0]*t,from[1]+d[1]*t];const r=Object.assign(cleanEnt(e),keepProps(e));if(atB)r.b=np;else r.a=np;return[r];}
  if(e.t==='pline'&&!e.closed){const P=e.pts,n=P.length;if(n<2)return null;const atEnd=dist(w,P[n-1])<dist(w,P[0]);
    const from=atEnd?P[n-1]:P[0],to=atEnd?P[n-2]:P[1],L=dist(from,to);if(!L)return null;const d=[(from[0]-to[0])/L,(from[1]-to[1])/L];
    const t=rayHit(from,d,prims);if(t==null)return null;const np=[from[0]+d[0]*t,from[1]+d[1]*t];const pts=P.map(p=>p.slice());if(atEnd)pts[n-1]=np;else pts[0]=np;
    return[Object.assign({t:'pline',pts,closed:false},keepProps(e))];}
  if(e.t==='arc'){const[p0,p1]=arcEnds(e);const atEnd=dist(w,p1)<dist(w,p0);
    const angs=[];for(const p of prims){const pts=p.t==='line'?segCirc(p.a,p.b,e.o,e.r):circCirc(e.o,e.r,p.o,p.r);for(const q of pts)angs.push(Math.atan2(q[1]-e.o[1],q[0]-e.o[0]));}
    const sw=sweepOf(e.a0,e.a1);let best=null,bd=Infinity;
    for(const a of angs){if(atEnd){const g=((a-e.a1)%TAU+TAU)%TAU;if(g>1e-9&&g<TAU-sw&&g<bd){bd=g;best=a;}}else{const g=((e.a0-a)%TAU+TAU)%TAU;if(g>1e-9&&g<TAU-sw&&g<bd){bd=g;best=a;}}}
    if(best==null)return null;const r=Object.assign(cleanEnt(e),keepProps(e));if(atEnd)r.a1=best;else r.a0=best;return[r];}
  return null;
}

/* 手寫 */
function cmdPen(){return{kind:'pen',name:'pen',hint(){return[eraser?'橡皮擦：在筆跡上劃過就整筆刪掉':'手寫：手指或觸控筆直接寫，雙指平移縮放',false];}};}
function buildPenBar(){
  const bar=$('penbar');bar.innerHTML='';
  if(!Array.isArray(st.penSlots)||st.penSlots.length!==3)st.penSlots=[1,7,5];
  if(st.penSlot==null)st.penSlot=Math.max(0,st.penSlots.indexOf(st.penCi));
  st.penSlots.forEach((ci,i)=>{const b=document.createElement('button');const on=!eraser&&st.penSlot===i;b.className=on?'on':'';
    b.title=on?'再點一次改顏色':'換這個顏色';b.innerHTML=`<span class="dot" style="background:${colorFor(aciHex(ci))}"></span>`;
    const pickColor=()=>openAci(ci,v=>{st.penSlots[i]=v;st.penSlot=i;st.penCi=v;saveSettings();buildPenBar();refreshCmd();});
    let lp=0;b.onpointerdown=()=>{lp=setTimeout(()=>{lp=-1;pickColor();},550);};b.onpointerup=b.onpointerleave=()=>{if(lp>0)clearTimeout(lp);};
    b.onclick=()=>{if(lp===-1){lp=0;return;}if(on){pickColor();return;}st.penSlot=i;st.penCi=ci;eraser=false;saveSettings();buildPenBar();refreshCmd();
      if(!localStorage.getItem('simplecad.penTip')){localStorage.setItem('simplecad.penTip','1');toast('再點一次已選的顏色（或長按）可以改顏色',2500);}};
    bar.appendChild(b);});
  const wb=document.createElement('button');wb.title='粗細';wb.className=$('penW').style.display==='flex'?'on':'';
  wb.innerHTML=`<span style="display:block;margin:auto;width:26px;height:${Math.max(2,Math.min(12,st.inkW*1.2))}px;border-radius:6px;background:${colorFor(aciHex(st.penCi))}"></span><span style="font-size:10px">${st.inkW}</span>`;
  wb.onclick=()=>{const p=$('penW');p.style.display=p.style.display==='flex'?'none':'flex';fillPenW();buildPenBar();};bar.appendChild(wb);
  const e=document.createElement('button');e.className=eraser?'on':'';e.innerHTML=svg('eraser');e.onclick=()=>{eraser=!eraser;buildPenBar();refreshCmd();};bar.appendChild(e);
  const d=document.createElement('button');d.innerHTML=svg('done');d.onclick=()=>{$('penW').style.display='none';endCmd();};bar.appendChild(d);
}
function fillPenW(){$('penWr').value=st.inkW;$('penWv').textContent=st.inkW;const pv=$('penWp');pv.style.height=Math.max(1,st.inkW)+'px';pv.style.background=colorFor(aciHex(st.penCi));}
$('penWr').oninput=()=>{st.inkW=+$('penWr').value;fillPenW();saveSettings();buildPenBar();};

/* ---------- 預覽繪圖 ---------- */
function drawTemp(e,col){drawEnt(e,col||colorFor(aciHex(curLayer().ci)),1.5,false,e.lt||curLayer().lt);}
function previewPath(pts,cp,closed,thin,col){
  const P=pts.concat(cp?[cp]:[]);if(P.length<2)return;
  ctx.strokeStyle=col||colorFor(aciHex(curLayer().ci));ctx.lineWidth=thin?1.2:1.8;ctx.setLineDash(cp?[]:[]);ctx.beginPath();
  P.forEach((p,i)=>{const q=toS(p);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});if(closed){const q=toS(P[0]);ctx.lineTo(q[0],q[1]);}ctx.stroke();
  if(cp&&pts.length){const a=toS(pts[pts.length-1]),b=toS(cp);ctx.setLineDash([5,4]);ctx.strokeStyle='#4fb3c8';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();ctx.setLineDash([]);
    const L=dist(pts[pts.length-1],cp);if(L>0){const m=[(a[0]+b[0])/2,(a[1]+b[1])/2];let an=Math.atan2(b[1]-a[1],b[0]-a[0]);if(Math.cos(an)<0)an+=Math.PI;ctx.save();ctx.translate(m[0],m[1]);ctx.rotate(an);ctx.font='bold 14px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillStyle='#4fb3c8';ctx.fillText(fmt(L),0,-6);ctx.restore();}}
  for(const p of pts){const q=toS(p);ctx.fillStyle='#4fb3c8';ctx.fillRect(q[0]-2.5,q[1]-2.5,5,5);}
}

/* ---------- 主繪圖 ---------- */
let raf=0;function schedule(){if(!raf)raf=requestAnimationFrame(render);}
let bubble=null;
/* ---------- 大圖加速：格網索引 + 底圖快取 ---------- */
// 格網：把底圖物件依範圍分到格子裡，畫面放大時只取看得到的格子
let grid=null;
function buildGrid(ents){
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const e of ents){const b=e.bb;if(!isFinite(b[0]))continue;
    // 離群值（解析錯位的圖塊）不撐大格網範圍
    if(b[0]<x0)x0=b[0];if(b[1]<y0)y0=b[1];if(b[2]>x1)x1=b[2];if(b[3]>y1)y1=b[3];}
  if(!isFinite(x0)){grid=null;return;}
  const N=Math.max(8,Math.min(256,Math.ceil(Math.sqrt(ents.length/8)))),cw=Math.max((x1-x0)/N,1e-9),ch=Math.max((y1-y0)/N,1e-9);
  const cells=new Array(N*N),big=[];
  ents.forEach((e,idx)=>{const b=e.bb;if(!isFinite(b[0]))return;
    const i0=Math.max(0,Math.floor((b[0]-x0)/cw)),i1=Math.min(N-1,Math.floor((b[2]-x0)/cw)),j0=Math.max(0,Math.floor((b[1]-y0)/ch)),j1=Math.min(N-1,Math.floor((b[3]-y0)/ch));
    if((i1-i0+1)*(j1-j0+1)>64){big.push(idx);return;}
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const c=j*N+i;(cells[c]||(cells[c]=[])).push(idx);}});
  grid={x0,y0,cw,ch,N,cells,big,mark:new Uint32Array(ents.length),stamp:0};
}
// 回傳畫面範圍內的底圖物件（保持原本的繪製順序）
function visibleImp(){
  if(!grid)return imp.filter(e=>visible(e));
  const m=60/st.view.s,a=toW([0,H]),b=toW([W,0]);return queryImp(a[0]-m,a[1]-m,b[0]+m,b[1]+m);
}
function queryImp(X0,Y0,X1,Y1){
  if(!grid)return imp;const G=grid;
  const i0=Math.max(0,Math.floor((X0-G.x0)/G.cw)),i1=Math.min(G.N-1,Math.floor((X1-G.x0)/G.cw)),j0=Math.max(0,Math.floor((Y0-G.y0)/G.ch)),j1=Math.min(G.N-1,Math.floor((Y1-G.y0)/G.ch));
  const ids=[];G.stamp++;if(G.stamp>4e9){G.mark.fill(0);G.stamp=1;}const S=G.stamp;
  const take=k=>{if(G.mark[k]!==S){G.mark[k]=S;const e=imp[k],bb=e.bb;if(bb[2]>=X0&&bb[0]<=X1&&bb[3]>=Y0&&bb[1]<=Y1)ids.push(k);}};
  if(i0<=i1&&j0<=j1)for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const c=G.cells[j*G.N+i];if(c)for(const k of c)take(k);}
  for(const k of G.big)take(k);
  ids.sort((x,y)=>x-y);return ids.map(k=>imp[k]);
}
// 底圖快取：底圖先畫到離屏畫布（比螢幕多畫一圈邊），平移縮放時直接搬移這張圖；
// 縮放太多或快拖出邊界時，邊動邊在背景重畫；停下來後再畫成目前的樣子
let baseFront=null,baseBack=null,baseJob=null,lastViewKey='',viewChangedAt=0;
const BM=0.18;// 每邊多畫的比例
function baseMargin(){return[Math.round(W*BM),Math.round(H*BM)];}
function newBaseCanvas(){const[mx,my]=baseMargin();const c=document.createElement('canvas');c.width=Math.round((W+2*mx)*DPR);c.height=Math.round((H+2*my)*DPR);return{c,ctx:c.getContext('2d'),view:null,key:'',mx,my};}
function baseKey(){return[cv.width,cv.height,st.bg,st.ltscale,hidSig,imp.length,Object.keys(shxFiles).length,lts.length,impEpoch].join(';');}
let impEpoch=0;function invalidateBase(){impEpoch++;schedule();}
function startBaseJob(){
  const[mx,my]=baseMargin();
  if(!baseBack||baseBack.mx!==mx||baseBack.my!==my||baseBack.c.width!==Math.round((W+2*mx)*DPR))baseBack=newBaseCanvas();
  const B=baseBack;B.ctx.setTransform(1,0,0,1,0,0);B.ctx.clearRect(0,0,B.c.width,B.c.height);
  const a=toW([-mx,H+my]),b=toW([W+mx,-my]),m=40/st.view.s;
  const list=(grid?queryImp(a[0]-m,a[1]-m,b[0]+m,b[1]+m):imp).filter(e=>shown(e)&&!e.nt);
  baseJob={list,i:0,view:{...st.view},key:baseKey()};
}
function runBaseJob(budget){
  const J=baseJob,B=baseBack,t0=performance.now();
  const keep=st.view;st.view=J.view;ctx=B.ctx;// 用工作開始時的視圖畫，畫到一半手指還在動也不會錯位
  try{ctx.setTransform(DPR,0,0,DPR,DPR*B.mx,DPR*B.my);const L=J.list;let i=J.i;
    while(i<L.length){const e=L[i++];drawEnt(e,colorFor(e.c));if((i&31)===0&&performance.now()-t0>budget)break;}J.i=i;}
  finally{ctx=mainCtx;st.view=keep;}
  if(J.i>=J.list.length){B.view=J.view;B.key=J.key;const t=baseFront;baseFront=B;baseBack=t;baseJob=null;return true;}
  return false;
}
const sameView=(a,b)=>a&&b&&a.s===b.s&&a.ox===b.ox&&a.oy===b.oy;
// 目前視圖相對快取圖：縮放倍率是否超過、是否快露出沒畫到的邊
function needRefresh(F){const r=st.view.s/F.view.s;if(r>1.5||r<0.7)return true;
  const tx=st.view.ox-r*F.view.ox,ty=st.view.oy-r*F.view.oy;// 快取圖左上角在螢幕上的位置 = (tx-r*mx, ty-r*my)
  const L=tx-r*F.mx,T=ty-r*F.my,Rr=L+r*(W+2*F.mx),B=T+r*(H+2*F.my),gx=W*0.06,gy=H*0.06;
  return L>-gx||T>-gy||Rr<W+gx||B<H+gy;}
function drawBase(){
  if(!imp.length){baseJob=null;return;}
  const key=baseKey(),vk=st.view.s+','+st.view.ox+','+st.view.oy;
  if(vk!==lastViewKey){lastViewKey=vk;viewChangedAt=performance.now();}
  let F=baseFront&&baseFront.key===key?baseFront:null;
  const exact=F&&sameView(F.view,st.view);
  const busy=ptrs.size>0||performance.now()-viewChangedAt<90;
  if(exact)baseJob=null;
  else if(busy){
    // 手指還在動：快取不夠用了才在背景重畫，畫完就換上
    if(baseJob&&baseJob.key!==key)baseJob=null;
    if(!baseJob&&(!F||needRefresh(F)))startBaseJob();
    if(baseJob)runBaseJob(F?6:30);
  }else{
    if(baseJob&&(!sameView(baseJob.view,st.view)||baseJob.key!==key))baseJob=null;
    if(!baseJob)startBaseJob();
    if(!F&&baseJob.list.length<4000)runBaseJob(1e9);else runBaseJob(F?14:40);
  }
  F=baseFront&&baseFront.key===key?baseFront:null;
  if(F){const r=st.view.s/F.view.s,tx=st.view.ox-r*F.view.ox,ty=st.view.oy-r*F.view.oy;
    ctx.save();ctx.setTransform(DPR*r,0,0,DPR*r,DPR*tx,DPR*ty);ctx.imageSmoothingEnabled=r<1;ctx.drawImage(F.c,-F.mx,-F.my,W+2*F.mx,H+2*F.my);ctx.restore();}
  if(baseJob||!F||!sameView(F.view,st.view))schedule();
}
/* ---------- 原生引擎（Cadpyard）：底圖線由原生解析、GPU 畫，這裡只負責查詢 ---------- */
let nativeOn=false,nFit=null;const nCache=new Map();
let _nv='';
function nativeSync(){if(!NATIVE)return;nativeLtSync();nativeTxSync();const r=cv.getBoundingClientRect(),ox=st.view.ox+r.left,oy=st.view.oy+r.top,k=st.view.s+','+ox+','+oy+st.bg;if(k===_nv)return;_nv=k;try{CadNative.setView(st.view.s,ox,oy,st.bg==='white');}catch(_){}}
// 線型：把用到的線型（虛線長度＋SHX 符號折線）打包給原生端展開
let nLtNames=[],nLtSig='',nLtBusy=false,nLtTimer=0;
function ltFont(){const f=fontFile('txt')||fontFile('simplex')||Object.values(shxFiles).find(x=>x.isFont&&x.type!=='bigfont');return f?f.name:'';}
// 線型符號在畫面上很小，折線點數簡化（Douglas-Peucker，容許誤差為符號大小的 2%）
function ltSimplify(polys){
  let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(const p of polys)for(const[x,y]of p){if(x<a)a=x;if(x>c)c=x;if(y<b)b=y;if(y>d)d=y;}
  const tol=Math.max(c-a,d-b)*0.02;if(!(tol>0))return polys;
  const dp=(p,i,j,keep)=>{let m=-1,k=-1;const[ax,ay]=p[i],[bx,by]=p[j],dx=bx-ax,dy=by-ay,L=Math.hypot(dx,dy);
    for(let q=i+1;q<j;q++){const e=L?Math.abs((p[q][0]-ax)*dy-(p[q][1]-ay)*dx)/L:Math.hypot(p[q][0]-ax,p[q][1]-ay);if(e>m){m=e;k=q;}}
    if(m>tol){keep[k]=1;dp(p,i,k,keep);dp(p,k,j,keep);}};
  return polys.map(p=>{if(p.length<4)return p;const keep=new Uint8Array(p.length);keep[0]=keep[p.length-1]=1;
    // 封閉的圈：先從離起點最遠的點切開
    let f=0,fm=-1;for(let q=1;q<p.length;q++){const e=Math.hypot(p[q][0]-p[0][0],p[q][1]-p[0][1]);if(e>fm){fm=e;f=q;}}
    if(f>0&&f<p.length-1){keep[f]=1;dp(p,0,f,keep);dp(p,f,p.length-1,keep);}else dp(p,0,p.length-1,keep);
    return p.filter((_,q)=>keep[q]);});
}
function nativeLtPack(){
  const o=['S '+st.ltscale],tf=ltFont(),n4=v=>(+v||0).toFixed(4).replace(/\.?0+$/,'')||'0';
  nLtNames.forEach((name,i)=>{
    if(!i)return;const lt=getLT(name);if(!lt||!lt.total||lt.name!==String(name).toUpperCase())return;
    o.push('T '+i);
    for(const el of lt.els){
      if(el.k==='len'){o.push('L '+el.v);continue;}
      let polys=null;
      if(el.k==='shape'){const h=findShape(el);if(h)polys=shxPolys(h[0],h[1]);}
      else if(el.k==='text'&&tf){const g=textGlyphs({font:tf,big:''},String(el.str||''));
        if(g)polys=[].concat(...g.glyphs.map(q=>q.polys.map(pl=>pl.map(([x,y])=>[q.x+x*q.k,q.y+y*q.k]))));}
      if(!polys||!polys.length)continue;
      polys=ltSimplify(polys);
      o.push(`H ${n4(el.x)} ${n4(el.y)} ${n4(el.s||1)} ${n4(el.r)} ${el.abs?1:0} ${el.up?1:0} ${polys.length}`);
      for(const p of polys)o.push('P '+p.length+' '+p.map(q=>n4(q[0])+' '+n4(q[1])).join(' '));
    }
    o.push('E');
  });
  return o.join('\n');
}
function nativeLtSync(force){
  if(!nativeOn||!nLtNames.length)return;
  const sig=impName+'|'+st.ltscale+'|'+lts.length+'|'+Object.keys(shxFiles).length;
  if(sig===nLtSig&&!force)return;
  clearTimeout(nLtTimer);nLtTimer=setTimeout(async()=>{
    if(nLtBusy){nLtTimer=setTimeout(()=>nativeLtSync(),300);return;}
    nLtBusy=true;nLtSig=sig;
    try{await CadCall('Cad','linetypes',{pack:nativeLtPack()});}catch(err){toast('線型處理失敗：'+(err.message||err),4000);}
    nLtBusy=false;
  },250);
}
// 文字：SHX 字形和每個字的排法交給原生端，跟底圖線一起用 GPU 畫（平移縮放不會跟不上）
let nTxSig='',nTxBusy=false,nTxTimer=0;
function txGlyphOf(main,big,V,ch){// 跟 textGlyphs 同一套找字規則
  const u=ch.codePointAt(0);let g=null,f=null,code=u;
  if(u<0x80||!big){f=main||big;g=f&&glyph(f,u,V);}
  if(!g&&big){const b=big5Code(ch);if(b!=null){g=glyph(big,b,V);f=big;code=b;}}
  if(!g&&main&&main.type==='unifont'){g=glyph(main,u,V);f=main;code=u;}
  return g?{g,f,code}:null;
}
function nativeTextPack(){
  const n4=v=>(+v||0).toFixed(4).replace(/\.?0+$/,'')||'0',o=[],gid=new Map(),combos=new Map();let ng=0;
  for(const e of imp){
    if(e.t!=='text'||e.ti==null)continue;
    const main=fontFile(e.font),big=fontFile(e.big);if(!main&&!big)continue;
    const V=!!e.vert,ck=(main?main.name:'')+'|'+(big?big.name:'')+'|'+(V?1:0);
    let C=combos.get(ck);if(!C){C={main,big,V,chars:new Map(),ids:[]};combos.set(ck,C);}
    C.ids.push(e.ti);
    for(const L of e.lines)for(const ch of L){
      if(C.chars.has(ch))continue;
      const r=txGlyphOf(main,big,V,ch);let id=-1;
      if(r){const k=r.f.name+'|'+r.code+'|'+(V?1:0);id=gid.get(k);
        if(id==null){id=ng++;gid.set(k,id);const polys=(r.g.polys||[]).filter(p=>p.length>1);
          o.push(`G ${id} ${n4(r.g.adv)} ${n4(r.g.advY)} ${1/(r.f.above||1)} ${polys.length}`);
          for(const p of polys)o.push('P '+p.length+' '+p.map(q=>n4(q[0])+' '+n4(q[1])).join(' '));}}
      C.chars.set(ch,id);
    }
  }
  let ci=0;
  for(const C of combos.values()){
    o.push('C '+ci+' '+(C.V?1:0));
    for(const[ch,id]of C.chars)o.push('M '+ch.codePointAt(0)+' '+id);
    for(let i=0;i<C.ids.length;i+=500)o.push('X '+C.ids.slice(i,i+500).join(' '));
    ci++;
  }
  return o.join('\n');
}
function nativeTxSync(){
  if(!nativeOn)return;
  const sig=impName+'|'+imp.length+'|'+Object.keys(shxFiles).length;
  if(sig===nTxSig)return;
  clearTimeout(nTxTimer);nTxTimer=setTimeout(async()=>{
    if(nTxBusy){nTxTimer=setTimeout(()=>nativeTxSync(),300);return;}
    nTxBusy=true;nTxSig=sig;const name=impName,list=imp;
    try{const r=await CadCall('Cad','texts',{pack:nativeTextPack()});
      // 有 SHX 字型的文字都交給原生畫；沒字型的照舊用手機字型畫在網頁上
      if(impName===name&&imp===list){for(const e of imp)if(e.t==='text')e.nt=e.ti!=null&&!!(fontFile(e.font)||fontFile(e.big));invalidateBase();}
    }catch(err){for(const e of list)e.nt=false;invalidateBase();toast('文字改用網頁畫：'+(err.message||err),3000);}
    nTxBusy=false;
  },250);
}
function nEnt(o){let e=nCache.get(o.i);if(e)return e;
  if(o.k===2&&o.o)e={t:'circle',o:o.o,r:o.r};
  else if(o.k===3&&o.o)e={t:'arc',o:o.o,r:o.r,a0:o.a[0],a1:o.a[1]};
  else{const P=[];for(let k=0;k<o.p.length;k+=2)P.push([o.p[k],o.p[k+1]]);e={t:'pline',pts:P,closed:false,kv:o.k===0?(o.kv||null):[]};}
  e.imp=1;e.c=o.c;e.ly=o.l;e.nid=o.i;if(o.g)e.g=o.g;if(o.lt){e.lt=o.lt;if(o.lts&&o.lts!==1)e.lts=o.lts;}e.bb=entBox(e);
  if(nCache.size>30000)nCache.clear();nCache.set(o.i,e);return e;}
function nativeNear(x0,y0,x1,y1,max){if(!nativeOn)return[];try{return JSON.parse(CadNative.query(x0,y0,x1,y1,max)).map(nEnt);}catch(_){return[];}}
function nativeView(max){if(!nativeOn)return[];const a=toW([0,H]),b=toW([W,0]);return nativeNear(a[0],a[1],b[0],b[1],max);}
function nativeGroup(g){if(!nativeOn)return[];try{return JSON.parse(CadNative.group(g)).map(nEnt);}catch(_){return[];}}
async function nativeOpen(){try{const m=await CadCall('Cad','open',{});await nativeLoaded(m);}catch(err){busy(false);if(!/cancel/i.test(err.message||''))toast('開檔失敗：'+(err.message||err),5000);}}
async function nativeLoaded(m){
  if(m.dxf){busy(false);await openDrawing(m.name,unb64(m.data),true);return;}
  busy(true,'載入文字…');
  const T=await (await fetch('/__native/texts.json?t='+Date.now())).json();
  const ents=T.map((t,ti)=>{const e={t:'text',imp:1,ti,p:t.p,h:t.h,rot:t.r,lines:String(t.t).split('\n'),ha:t.ha,y0:t.y0,ls:t.ls,wf:t.wf,vert:!!t.v,c:t.c,ly:t.l,font:t.f||'',big:t.b||''};if(t.g)e.g=t.g;e.bb=entBox(e);return e;});
  buildGrid(ents);saveDrawNow();
  imp=ents;grpIdx=null;nCache.clear();nativeOn=true;nFit=m.fit;_nv='';
  impLayers=m.layers.filter(l=>l.n>0).map(l=>({name:l.name,c:l.c,off:l.off,frozen:l.frozen,hidden:l.off||l.frozen,n:l.n}));
  offLy=new Set(impLayers.filter(l=>l.off&&!l.frozen).map(l=>l.name));frzLy=new Set(impLayers.filter(l=>l.frozen).map(l=>l.name));syncHid();
  if(Array.isArray(m.lts)&&m.lts.length){const usable=x=>x.els.filter(e=>e.k==='shape').every(e=>e.file&&findShape(e));
    mergeLT(m.lts.filter(x=>x.els.some(e=>e.k==='len'&&e.v)).map(finishLT).filter(x=>{const o=lts.find(y=>y.name===x.name);return!(o&&o.src==='support')||usable(x);}));}
  nLtNames=m.ltn||[];nLtSig='';nTxSig='';st.ltscale=m.ltscale||st.ltscale||1;
  impName=m.name;blankName='';loadDraw(m.key);endCmd();
  let L=recentList();L=[{key:m.key,name:m.name,size:m.size,t:Date.now(),native:1},...L.filter(x=>x.key!==m.key)];
  for(const x of L.slice(RECENT_MAX))if(!x.native)await idbFile('f:'+x.key,null);
  recentSave(L.slice(0,RECENT_MAX));localStorage.setItem('simplecad.lastKey',m.key);
  busy(false);zoomFit();
  toast(`已開啟「${m.name}」：${m.strips} 條線、${m.texts} 個文字（${m.how}）`+(st.ents.length?`，載回你畫的 ${st.ents.length} 個`:''),4000);
}
window.cadBack=()=>{const s=[...document.querySelectorAll('.sheet.show')];if(s.length){s[s.length-1].classList.remove('show');return true;}if(cmd){endCmd();return true;}return false;};

function render(){
  raf=0;ctx.setTransform(DPR,0,0,DPR,0,0);if(NATIVE){ctx.clearRect(0,0,W,H);nativeSync();}else{ctx.fillStyle=st.bg==='white'?'#ffffff':'#15181c';ctx.fillRect(0,0,W,H);}
  const hl=st.bg==='white'?'rgba(0,140,200,.35)':'rgba(79,179,200,.45)';
  if(selE&&shown(selE))drawEnt(selE,hl,6,true);
  if(!cmd&&selE&&!selE.imp)drawGrips(selE);
  {let n=0;for(const e of selSet){if(selSet.size>500&&!visible(e))continue;drawEnt(e,'rgba(255,170,40,.6)',6,true);if(++n>4000)break;}}
  if(boxNow){const[a,b]=boxNow,cr=b[0]<a[0];ctx.save();ctx.fillStyle=cr?'rgba(60,200,90,.12)':'rgba(70,130,255,.12)';ctx.strokeStyle=cr?'#3cc85a':'#4682ff';ctx.lineWidth=1.5;if(cr)ctx.setLineDash([6,4]);
    ctx.fillRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));ctx.strokeRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));ctx.restore();}
  drawBase();
  for(const e of st.ents)if(ownShown(e)&&visible(e))drawEnt(e,ownColor(e),undefined,false,ownLt(e));
  drawSmall();
  if(cmd&&cmd.preview)cmd.preview();
  if(ink&&ink.pts.length>1)drawInk({pts:ink.pts,w:st.inkW/st.view.s},colorFor(aciHex(st.penCi)));
  bubble=null;
  if(cur&&cmd&&cmd.kind==='points'){
    const[x,y]=toS(cur.p);const c=st.bg==='white'?'#0a7d92':'#7fe3f5';
    ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,13,0,TAU);ctx.moveTo(x-26,y);ctx.lineTo(x-7,y);ctx.moveTo(x+7,y);ctx.lineTo(x+26,y);ctx.moveTo(x,y-26);ctx.lineTo(x,y-7);ctx.moveTo(x,y+7);ctx.lineTo(x,y+26);ctx.stroke();
    ctx.fillStyle=c;ctx.fillRect(x-1.5,y-1.5,3,3);
    if(cur.snap)drawSnapMark(cur.snap);
    // x,y 小方塊
    const bx=x+30,by=y-48,bw=64,bh=34;bubble=[bx,by,bw,bh];
    ctx.fillStyle='rgba(30,36,44,.92)';ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.beginPath();ctx.roundRect?ctx.roundRect(bx,by,bw,bh,8):ctx.rect(bx,by,bw,bh);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='bold 17px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('x, y',bx+bw/2,by+bh/2+1);
  }
  const p=cur?cur.p:null;$('hintC').textContent=p?`X ${fmt(p[0])}\nY ${fmt(p[1])}`:'';
}

/* ---------- 指標事件 ---------- */
let g=null,ink=null;
function evPt(e){const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];}
cv.addEventListener('pointerdown',e=>{
  e.preventDefault();try{cv.setPointerCapture(e.pointerId);}catch(_){}
  const sp=evPt(e);lastType=e.pointerType;ptrs.set(e.pointerId,sp);
  if(ptrs.size===2){const[a,b]=[...ptrs.values()],m=midp(a,b);if(ink){ink=null;}boxNow=null;g={type:'pinch',d0:dist(a,b)||1,s0:st.view.s,w0:toW(m)};schedule();return;}
  if(ptrs.size>2)return;
  if(e.pointerType==='mouse'&&e.button!==0){g={type:'pan',last:sp};return;}
  if(cmd&&cmd.kind==='pen'){
    if(eraser){g={type:'erase',last:sp,snap:false};eraseAt(toW(sp),g);}
    else{ink={pts:[toW(sp)],last:sp};g={type:'ink'};}
    schedule();return;
  }
  if(!cmd){const gr=hitGrip(sp);if(gr){const e0=selE;startCmd(gripCmd(e0,gr));cur={raw:gr.p.slice(),p:gr.p.slice(),snap:null};refreshCmd();g={type:'pending',start:sp,last:sp,moved:false,grip:true};return;}}
  if(cmd&&cmd.kind==='select'&&boxArm){g={type:'box',start:sp};boxNow=[sp,sp];return;}
  g={type:'pending',start:sp,last:sp,moved:false};
});
cv.addEventListener('pointermove',e=>{
  const sp=evPt(e);if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,sp);
  if(!g)return;
  if(g.type==='pinch'){if(ptrs.size<2)return;const[a,b]=[...ptrs.values()],m=midp(a,b),s=clampS(g.s0*dist(a,b)/g.d0);st.view={s,ox:m[0]-g.w0[0]*s,oy:m[1]+g.w0[1]*s};schedule();return;}
  if(g.type==='ink'){if(dist(sp,ink.last)>=1.5){ink.pts.push(toW(sp));ink.last=sp;schedule();}return;}
  if(g.type==='erase'){eraseAt(toW(sp),g);return;}
  if(g.type==='box'){boxNow=[g.start,sp];schedule();return;}
  if(g.type==='pending'&&dist(sp,g.start)>8){g.moved=true;g.type=(cmd&&cmd.kind==='points'&&cur)?'cursor':'pan';}
  if(g.type==='pan'){st.view.ox+=sp[0]-g.last[0];st.view.oy+=sp[1]-g.last[1];g.last=sp;schedule();return;}
  if(g.type==='cursor'){const s=st.view.s,raw=[cur.raw[0]+(sp[0]-g.last[0])/s,cur.raw[1]-(sp[1]-g.last[1])/s];g.last=sp;setCursorRaw(raw);return;}
});
function endPtr(e,cancel){
  ptrs.delete(e.pointerId);if(!g)return;
  if(g.type==='pinch'){if(ptrs.size<2)g=ptrs.size?{type:'dead'}:null;saveSettings();return;}
  if(g.type==='dead'){if(!ptrs.size)g=null;return;}
  const G=g;g=null;if(cancel){ink=null;boxNow=null;schedule();return;}
  if(G.type==='box'){const B=boxNow;boxNow=null;if(B&&dist(B[0],B[1])>8){boxSelect(B[0],B[1]);boxArm=false;}refreshCmd();schedule();return;}
  if(G.type==='ink'){const P=ink.pts;ink=null;if(P.length===1)P.push([P[0][0]+0.3/st.view.s,P[0][1]]);snapshot();addEnt({t:'ink',pts:P,w:st.inkW/st.view.s,ci:st.penCi});saveDraw();schedule();return;}
  if(G.type==='erase'){if(G.did)saveDraw();return;}
  if(G.type==='pan'){saveSettings();return;}
  if(G.type==='pending'&&!G.moved){if(G.grip){cur=null;refreshCmd();return;}onTap(G.start);}
}
cv.addEventListener('pointerup',e=>endPtr(e,false));
cv.addEventListener('pointercancel',e=>endPtr(e,true));
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('wheel',e=>{e.preventDefault();const sp=evPt(e),w=toW(sp),s=clampS(st.view.s*Math.exp(-e.deltaY*0.0015));st.view={s,ox:sp[0]-w[0]*s,oy:sp[1]+w[1]*s};schedule();clearTimeout(wheelT);wheelT=setTimeout(saveSettings,300);},{passive:false});
let wheelT=0;
function eraseAt(w,G){
  const tol=14/st.view.s;let hit=false;
  for(let i=st.ents.length-1;i>=0;i--){const e=st.ents[i];if(e.t!=='ink'||!ownShown(e))continue;if(!near(e,w,tol))continue;if(hitDist(e,w)<tol){if(!G.did){snapshot();G.did=true;}st.ents.splice(i,1);hit=true;}}
  if(hit)schedule();
}
function onTap(sp){
  const w=toW(sp);
  if(bubble&&cmd&&cmd.kind==='points'&&sp[0]>=bubble[0]&&sp[0]<=bubble[0]+bubble[2]&&sp[1]>=bubble[1]&&sp[1]<=bubble[1]+bubble[3]){
    kp.hidden=false;kp.show('xy');kp.keepXY=true;updateCmdBar();return;}
  if(!cmd&&smallMarks){const V=smallVis();let bi=-1,bd=30;for(const m of V){const q=toS(m.p);const d=Math.hypot(q[0]-sp[0],q[1]-sp[1]);if(d<bd){bd=d;bi=smallMarks.indexOf(m);}}
    if(bi>=0){smallIdx=bi;updSmallBar();const m=smallMarks[bi];setHint(m.msg||`${m.len.toFixed(2)}m　${m.l}`,true);schedule();return;}}
  if(!cmd){selE=pickEnt(w);setHint(baseHintText(),!!selE);schedule();return;}
  switch(cmd.kind){
    case'points':
      if(cmd.live){setCursorRaw(w);return;}
      if(cur){commitPoint();if(!cmd||cmd.kind!=='points')return;}
      setCursorRaw(w);return;
    case'select':{const e=pickEnt(w,cmd.filter);if(e){const grp=(cmd.group&&e.g)?groupOf(e):[e];const on=!selSet.has(e);for(const x of grp)on?selSet.add(x):selSet.delete(x);}refreshCmd();return;}
    case'pickObj':{const e=pickEnt(w,cmd.filter);if(e)cmd.onPick(e,w);else toast('那裡沒有物件');refreshCmd();return;}
    case'side':cmd.onSide(w);return;
    default:selE=pickEnt(w);setHint(baseHintText(),!!selE);schedule();
  }
}

/* ---------- 底部工具列 ---------- */
const TABS=[
  ['sel','選取',()=>{endCmd();closePanel();}],
  ['draw','繪製',[['pline','多段線',cmdPline],['line','直線',cmdLine],['circle','圓',cmdCircle],['arc','弧',cmdArc],['spline','雲形線',cmdSpline],['polygon','多邊形',cmdPolygon],['text','文字',cmdText],['dim','標註',cmdDim]]],
  ['edit','編輯',[['move','移動',()=>cmdMove(false)],['copy','複製',()=>cmdMove(true)],['rot','旋轉',cmdRotate],['offset','偏移',cmdOffset],['trim','修剪',()=>cmdTrimExt(false)],['extend','延伸',()=>cmdTrimExt(true)],['join','接合',cmdJoin],['brk','打斷',cmdBreak],['del','刪除',cmdDelete],['chly','改圖層',cmdChLayer],['cclip','複製到剪貼簿',cmdCopyClip],['pclip','原座標貼上',cmdPasteOrig]]],
  ['meas','測量',[['len','量長度',cmdMeasure],['xy','點坐標',()=>cmdCoord(false)],['ll','經緯度',()=>cmdCoord(true)]]],
  ['layers','圖層',()=>{closePanel();fillLayerSheet();openSheet('layerSheet');}],
  ['pen','手寫',()=>{closePanel();startCmd(cmdPen());}]
];
function buildTabs(){
  const t=$('tabs');t.innerHTML='';
  for(const[k,n,act]of TABS){const b=document.createElement('button');b.dataset.k=k;b.innerHTML=svg(k)+`<span>${n}</span>`;
    b.onclick=()=>{if(Array.isArray(act)){if(tab===k){closePanel();return;}openPanel(k,act);}else act();updateUI();};t.appendChild(b);}
}
function openPanel(k,items){
  tab=k;const p=$('panel');p.innerHTML='';
  for(const[ik,n,f]of items){const b=document.createElement('button');b.innerHTML=svg(ik)+`<span>${n}</span>`;b.onclick=()=>{closePanel();const c=f();if(c)startCmd(c);};p.appendChild(b);}
  p.style.display='grid';kp.hide();updateUI();
}
function closePanel(){tab=null;$('panel').style.display='none';if(cmd&&cmd.keypad&&!kp.hidden)kp.show();updateUI();}
function updateUI(){
  const active=cmd?{pline:'draw',line:'draw',circle:'draw',arc:'draw',spline:'draw',polygon:'draw',text:'draw',textalign:'draw',move:'edit',copy:'edit',rot:'edit',offset:'edit',dim:'draw',trim:'edit',extend:'edit',join:'edit',brk:'edit',copyclip:'edit',grip:'sel',del:'edit',chly:'edit',mlen:'meas',xy:'meas',ll:'meas',pen:'pen'}[cmd.name]:'sel';
  document.querySelectorAll('#tabs button').forEach(b=>b.classList.toggle('on',(tab||active)===b.dataset.k));
  $('tSnap').classList.toggle('on',st.snap);$('tOrtho').classList.toggle('on',st.ortho);
  $('tUndo').disabled=!undoS.length&&!(cmd&&cmd.pts&&cmd.pts.length);$('tRedo').disabled=!redoS.length;
  updateCmdBar();
}
for(const[id,k]of[['tFile','file'],['tUndo','undo'],['tRedo','redo'],['tFit','fit'],['tSnap','snap'],['tOrtho','ortho'],['tSet','set']])$(id).innerHTML=svg(k);
$('tUndo').onclick=()=>{doUndo();updateUI();};$('tRedo').onclick=()=>{doRedo();updateUI();};$('tFit').onclick=zoomFit;
// 點一下：鎖點開關；長按：選要用哪幾種鎖點
{let lp=0;const b=$('tSnap');b.onpointerdown=()=>{lp=setTimeout(()=>{lp=-1;fillOsnaps($('osnapsQ'));openSheet('snapSheet');},500);};b.onpointerup=b.onpointerleave=()=>{if(lp>0)clearTimeout(lp);};
  b.oncontextmenu=e=>e.preventDefault();
  b.onclick=()=>{if(lp===-1){lp=0;return;}st.snap=!st.snap;saveSettings();updateUI();
    if(st.snap&&!localStorage.getItem('simplecad.snapTip')){localStorage.setItem('simplecad.snapTip','1');toast('長按鎖點按鈕可以選要用哪幾種鎖點',2500);}else toast(st.snap?'鎖點：開':'鎖點：關',1000);};}
$('osqMine').onclick=()=>setOsnaps(OSN_MINE);$('osqAll').onclick=()=>setOsnaps(OSN.map(x=>x[0]));$('osqNone').onclick=()=>setOsnaps([]);
$('tOrtho').onclick=()=>{st.ortho=!st.ortho;saveSettings();updateUI();toast(st.ortho?'正交：開':'正交：關',1000);};
$('tSet').onclick=()=>{fillSettings();openSheet('setSheet');};
$('tFile').onclick=()=>{fillRecent();$('drawInfo').textContent=impName?`目前底圖：${impName}（${imp.length} 個物件）　我畫的：${st.ents.length} 個`:`尚未開啟底圖　我畫的：${st.ents.length} 個`;openSheet('fileSheet');};
window.addEventListener('keydown',e=>{if(e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')return;
  if(e.key==='Escape')cancelCmd();else if(e.key==='Enter')cmdOk();else if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();doUndo();}
  else if(cmd&&kp.shown&&/^[0-9.\-]$/.test(e.key))kp.key(e.key);else if(cmd&&kp.shown&&e.key==='Backspace')kp.key('⌫');});

/* ---------- 圖層面板 ---------- */
function fillLayerSheet(){
  try{updOldBtn();updSmallBar();}catch(_){}
  const box=$('myLayers');box.innerHTML='';
  for(const L of st.layers){
    const r=document.createElement('div');r.className='lyr';r.dataset.ly=L.name;
    const rb=document.createElement('input');rb.type='radio';rb.name='curly';rb.checked=st.cur===L.name;rb.onchange=()=>{st.cur=L.name;saveSettings();};
    const chip=document.createElement('div');chip.className='chip';chip.style.background=aciHex(L.ci);
    const nm=document.createElement('input');nm.type='text';nm.value=L.name;nm.onchange=()=>{const v=nm.value.trim();if(!v||st.layers.some(x=>x!==L&&x.name===v)){nm.value=L.name;toast('名稱空白或重複');return;}
      for(const e of st.ents)if(e.ly===L.name)e.ly=v;if(st.cur===L.name)st.cur=v;L.name=v;saveSettings();saveDraw();};
    const ci=document.createElement('button');ci.className='cibtn';ci.textContent=aciName(L.ci);ci.title='選顏色';
    const pickC=()=>openAci(L.ci,v=>{L.ci=v;chip.style.background=aciHex(v);ci.textContent=aciName(v);saveSettings();schedule();});ci.onclick=pickC;chip.onclick=pickC;
    const eye=document.createElement('button');eye.className='lyb';eye.innerHTML=lyIcon('bulb',L.on!==false);eye.onclick=()=>{L.on=L.on===false;eye.innerHTML=lyIcon('bulb',L.on!==false);saveSettings();schedule();};
    const del=document.createElement('button');del.textContent='✕';del.onclick=()=>{if(st.layers.length<=1){toast('至少要留一個圖層');return;}if(st.ents.some(e=>e.ly===L.name)){toast('這層還有東西，先刪掉或改圖層');return;}st.layers=st.layers.filter(x=>x!==L);if(st.cur===L.name)st.cur=st.layers[0].name;saveSettings();fillLayerSheet();};
    r.append(rb,chip,nm,ci,eye,del);box.appendChild(r);
    const lr=document.createElement('div');lr.style.cssText='margin:-2px 0 8px 56px';const sel=document.createElement('select');
    const names=['CONTINUOUS',...lts.map(l=>l.name).filter(n=>n!=='CONTINUOUS')];for(const n of names){const o=document.createElement('option');o.value=n;o.textContent=n+(n===L.lt?'':'');sel.appendChild(o);}
    sel.value=L.lt||'CONTINUOUS';sel.onchange=()=>{L.lt=sel.value;saveSettings();schedule();};lr.appendChild(sel);box.appendChild(lr);
  }
  $('baseSec').style.display=imp.length?'block':'none';
  const bb=$('baseLayers');bb.innerHTML='';
  impLayers.slice().sort((a,b)=>a.name.localeCompare(b.name,'zh-Hant')).forEach(L=>{
    const r=document.createElement('div');r.className='blyr';r.dataset.ly=L.name;r.dataset.base='1';
    const on=document.createElement('button');on.className='lyb';const fz=document.createElement('button');fz.className='lyb';
    const paint=()=>{on.innerHTML=lyIcon('bulb',!offLy.has(L.name));on.title=offLy.has(L.name)?'關閉中（點一下打開）':'打開';
      fz.innerHTML=lyIcon('sun',!frzLy.has(L.name));fz.title=frzLy.has(L.name)?'凍結中（點一下解凍）':'解凍';t.style.opacity=hidLy.has(L.name)?.45:1;};
    on.onclick=()=>{offLy.has(L.name)?offLy.delete(L.name):offLy.add(L.name);syncHid();paint();schedule();};
    fz.onclick=()=>{frzLy.has(L.name)?frzLy.delete(L.name):frzLy.add(L.name);syncHid();paint();schedule();};
    const d=document.createElement('span');d.style.cssText=`width:14px;height:14px;border-radius:3px;background:${colorFor(L.c)};flex:none;border:1px solid #fff4`;
    const t=document.createElement('span');t.className='lyn';t.textContent=`${L.name}（${L.n}）`;
    paint();r.append(on,fz,d,t);bb.appendChild(r);});
}
function syncHid(){hidLy=new Set([...offLy,...frzLy]);hidSig=[...hidLy].sort().join('|');if(nativeOn)try{CadNative.setHidden(JSON.stringify([...hidLy]));}catch(_){}}
let hidSig='';
function lyIcon(k,act){
  if(k==='bulb')return act?'<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" fill="#ffd54a" stroke="#c9a227"/><rect x="9" y="17" width="6" height="3" rx="1" fill="#9aa1ab"/></svg>'
    :'<svg viewBox="0 0 24 24" width="22" height="22"><path d="M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" fill="#3d4ea0" stroke="#5b6bc0"/><rect x="9" y="17" width="6" height="3" rx="1" fill="#6b7280"/></svg>';
  return act?'<svg viewBox="0 0 24 24" width="22" height="22"><circle cx="12" cy="12" r="4.2" fill="#ffb84a"/><g stroke="#ffb84a" stroke-width="2" stroke-linecap="round"><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1M16.6 16.6l2.1 2.1M5.3 18.7l2.1-2.1M16.6 7.4l2.1-2.1"/></g></svg>'
    :'<svg viewBox="0 0 24 24" width="22" height="22"><g stroke="#7fd3ff" stroke-width="1.8" stroke-linecap="round"><path d="M12 2.5v19M3.8 7.2l16.4 9.6M3.8 16.8l16.4-9.6M9.5 4l2.5 2.5L14.5 4M9.5 20l2.5-2.5 2.5 2.5"/></g></svg>';
}
$('addLy').onclick=()=>{const v=$('newLy').value.trim();if(!v)return;if(st.layers.some(l=>l.name===v)){toast('已經有這個圖層');return;}st.layers.push({name:v,ci:7,lt:'CONTINUOUS',on:true});st.cur=v;$('newLy').value='';saveSettings();fillLayerSheet();};
$('lyAll').onclick=()=>{offLy.clear();frzLy.clear();syncHid();fillLayerSheet();schedule();};
$('lyNone').onclick=()=>{impLayers.forEach(l=>offLy.add(l.name));syncHid();fillLayerSheet();schedule();};

/* ---------- 點到物件時：關閉這個圖層／到圖層列表找它 ---------- */
function updSelBar(){const b=$('selBar');if(!b)return;const show=!cmd&&selE&&!smallMarks;b.style.display=show?'flex':'none';}
function closeSelLayer(){if(!selE)return;const n=selE.ly||'0';
  if(selE.imp){offLy.add(n);syncHid();}else{const L=st.layers.find(l=>l.name===n);if(L){L.on=false;saveSettings();}}
  selE=null;setHint(baseHintText(),false);toast('已關閉圖層「'+n+'」（到圖層裡可再打開）',2500);schedule();}
function showSelLayer(){if(!selE)return;const n=selE.ly||'0';fillLayerSheet();openSheet('layerSheet');
  setTimeout(()=>{const r=[...document.querySelectorAll('#layerSheet [data-ly]')].find(x=>x.dataset.ly===n&&(x.dataset.base==='1')===!!selE.imp);
    if(!r)return;r.scrollIntoView({block:'start',behavior:'smooth'});r.classList.add('lyhl');setTimeout(()=>r.classList.remove('lyhl'),2500);},120);}
$('selOff').onclick=closeSelLayer;$('selList').onclick=showSelLayer;

/* ---------- 舊圖（a 開頭圖層）一鍵開關、小線段標記 ---------- */
// 舊圖 a 開頭、新圖數字開頭、Q 不確定線；等高線（98111 計曲線、98112 首曲線…）不抓小線段
const OLD_RE=/^a/i,NEW_RE=/^\d/,Q_RE=/^q/i,CONTOUR_RE=/^a?9811|曲線/i;
const smallMaxV=()=>{const v=+st.smallMax;return v>0?v:1;};const areaTolV=()=>{const v=+st.areaTol;return v>0?v:0.05;};// 舊圖：a 開頭；新圖：數字開頭（不含 0 圖層）
const oldLayers=()=>impLayers.filter(l=>OLD_RE.test(l.name)).map(l=>l.name);
const newLayers=()=>impLayers.filter(l=>NEW_RE.test(l.name)&&l.name!=='0'&&!CONTOUR_RE.test(l.name)).map(l=>l.name);
const qLayers=()=>impLayers.filter(l=>Q_RE.test(l.name)).map(l=>l.name);
function oldOff(){const o=oldLayers();return o.length&&o.every(n=>offLy.has(n));}
function updOldBtn(){const b=$('lyOld');if(!b)return;if(document.activeElement!==$('smallMax'))$('smallMax').value=smallMaxV();const o=oldLayers();b.disabled=!o.length;b.textContent=o.length?(oldOff()?'開啟舊圖（a 開頭）':'關閉舊圖（a 開頭）'):'沒有 a 開頭的舊圖層';
  $('lySmall').textContent=smallMarks&&smallMode==='small'?'取消小線段標記':`標出新圖層／Q 小線段（<${smallMaxV()}m）`;
  if(document.activeElement!==$('areaTol'))$('areaTol').value=areaTolV();
  $('lyArea').textContent=smallMarks&&smallMode==='area'?'取消區域檢查標記':'檢查區域：相通／房屋未封閉／空白區';}
$('lyOld').onclick=()=>{const o=oldLayers();if(!o.length)return;if(oldOff())o.forEach(n=>offLy.delete(n));else o.forEach(n=>offLy.add(n));syncHid();fillLayerSheet();schedule();};
let smallMarks=null,smallIdx=-1,smallKey='',smallMode='small';
// 網頁版（DXF）找孤立小線段：規則同原生端
function findSmallJS(S,max,NW,QS){
  const link=(a,b)=>a===b;// 只看同一個圖層（Q 也一樣）
  const tol=0.02,polyLen=P=>{let l=0;for(let i=1;i<P.length;i++)l+=dist(P[i-1],P[i]);return l;};
  const C=imp.filter(e=>!e.g&&S.has(e.ly)&&(e.t==='line'||e.t==='pline'||e.t==='arc'));
  const info=new Map();for(const e of C){const P=entPolys(e)[0];const l=polyLen(P);info.set(e,{P,l,small:l<max&&l>1e-9});}
  const dPl=(p,P)=>{let b=Infinity;for(let i=1;i<P.length;i++)b=Math.min(b,dist(p,closestOnSeg(p,P[i-1],P[i])));return b;};
  const touch=(A,B)=>dPl(A[0],B)<tol||dPl(A[A.length-1],B)<tol||dPl(B[0],A)<tol||dPl(B[B.length-1],A)<tol;
  const near=e=>{const b=e.bb||entBox(e);return grid?queryImp(b[0]-tol,b[1]-tol,b[2]+tol,b[3]+tol):imp;};
  const done=new Set(),out=[];
  for(const e of C){const I=info.get(e);if(!I.small||done.has(e))continue;
    const Q=[e];done.add(e);let total=0,iso=true,bb=[Infinity,Infinity,-Infinity,-Infinity];
    while(Q.length){const j=Q.shift(),J=info.get(j);total+=J.l;const b=j.bb||entBox(j);bb=[Math.min(bb[0],b[0]),Math.min(bb[1],b[1]),Math.max(bb[2],b[2]),Math.max(bb[3],b[3])];
      if(total>=max){iso=false;continue;}
      for(const k of near(j)){if(k===j||!link(j.ly,k.ly))continue;const K=info.get(k),KP=K?K.P:entPolys(k)[0];if(!KP||!touch(J.P,KP))continue;
        if(K&&K.small){if(!done.has(k)){done.add(k);Q.push(k);}}else iso=false;}}
    if(iso&&total<max)out.push({x:(bb[0]+bb[2])/2,y:(bb[1]+bb[3])/2,len:total,l:e.ly});}
  return out;
}
async function findSmall(){
  const nw=newLayers(),q=qLayers(),only=nw.concat(q);let L=[];
  if(!only.length){toast('沒有數字開頭的新圖層或 Q 圖層');return;}
  if(nativeOn){try{L=await CadCall('Cad','small',{max:smallMaxV(),only,q});}catch(err){toast('找小線段失敗：'+(err.message||err));return;}}
  else L=findSmallJS(new Set(only),smallMaxV(),new Set(nw),new Set(q));
  smallKey=impName;smallMode='small';smallMarks=L.map(m=>({p:[m.x,m.y],len:m.len,l:m.l}));smallIdx=-1;
  toast(smallMarks.length?`找到 ${smallMarks.length} 段小於 ${smallMaxV()}m 的線（新圖層和 Q 圖層、不含等高線、沒跟同圖層線相接的）`:'沒有找到小線段',3000);
  if(!smallMarks.length)smallMarks=null;updSmallBar();schedule();
}
const smallVis=()=>smallMarks?smallMarks.filter(m=>!hidLy.has(m.l)):[];
function updSmallBar(){const b=$('smallBar');if(!smallMarks){b.style.display='none';return;}b.style.display='flex';
  const V=smallVis(),m=smallMarks[smallIdx];$('smallTxt').textContent=m&&!hidLy.has(m.l)?(m.msg?`${V.indexOf(m)+1}/${V.length}　${m.msg}`:`${V.indexOf(m)+1}/${V.length}　${m.len.toFixed(2)}m　${m.l}`):(smallMode==='area'?`區域問題 ${V.length} 處`:`小線段 ${V.length} 段`);}
function smallGo(d){const V=smallVis();if(!V.length){toast('目前開著的圖層沒有小線段');return;}
  let k=V.indexOf(smallMarks[smallIdx]);k=k<0?(d>0?0:V.length-1):(k+d+V.length)%V.length;const m=V[k];smallIdx=smallMarks.indexOf(m);
  const v=st.view;v.s=Math.max(v.s,40);v.ox=W/2-m.p[0]*v.s;v.oy=H/2+m.p[1]*v.s;updSmallBar();schedule();}
function drawSmall(){updSelBar();if(smallMarks&&smallKey!==impName){smallMarks=null;updSmallBar();}if(!smallMarks)return;const cm=smallMarks[smallIdx];ctx.save();
  for(const m of smallMarks){if(hidLy.has(m.l))continue;const q=toS(m.p);if(q[0]<-30||q[1]<-30||q[0]>W+30||q[1]>H+30)continue;const on=m===cm;
    ctx.strokeStyle=on?'#ffea00':(AREA_COL[m.type]||'#ff2bd6');ctx.lineWidth=on?3.5:2.2;ctx.beginPath();ctx.arc(q[0],q[1],on?24:17,0,TAU);ctx.stroke();}
  if(cm&&cm.path){const o=cm.o,P=cm.path;ctx.strokeStyle='#2f6bff';ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    for(let i=0;i<P.length;i+=2){const q=toS([o[0]+P[i],o[1]+P[i+1]]);if(i)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1]);}ctx.stroke();
    const a=toS([o[0]+P[P.length-4],o[1]+P[P.length-3]]),b=toS([o[0]+P[P.length-2],o[1]+P[P.length-1]]),an=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.fillStyle='#2f6bff';ctx.beginPath();ctx.moveTo(b[0],b[1]);ctx.lineTo(b[0]-14*Math.cos(an-0.45),b[1]-14*Math.sin(an-0.45));ctx.lineTo(b[0]-14*Math.cos(an+0.45),b[1]-14*Math.sin(an+0.45));ctx.closePath();ctx.fill();}
  if(cm&&cm.gap){const o=cm.o,G=cm.gap;ctx.strokeStyle='#ff2020';ctx.fillStyle='#ff2020';ctx.lineWidth=4;
    for(let i=0;i+3<G.length;i+=4){const a=toS([o[0]+G[i],o[1]+G[i+1]]),b=toS([o[0]+G[i+2],o[1]+G[i+3]]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();for(const q of[a,b]){ctx.beginPath();ctx.arc(q[0],q[1],4,0,TAU);ctx.fill();}}}
  if(cm&&cm.ring){const r=cm.ring,o=cm.o;ctx.strokeStyle='#ffea00';ctx.lineWidth=2.5;ctx.setLineDash([8,5]);ctx.beginPath();
    for(let i=0;i<r.length;i+=2){const q=toS([o[0]+r[i],o[1]+r[i+1]]);if(i)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1]);}ctx.closePath();ctx.stroke();ctx.setLineDash([]);}
  ctx.restore();}
$('areaTol').onchange=()=>{const v=parseFloat($('areaTol').value);if(v>0&&v<=1){st.areaTol=v;saveSettings();}else $('areaTol').value=areaTolV();};
$('smallMax').onchange=()=>{const v=parseFloat($('smallMax').value);if(v>0){st.smallMax=v;saveSettings();updOldBtn();}else $('smallMax').value=smallMaxV();};
$('lySmall').onclick=()=>{if(smallMarks&&smallMode==='small'){smallMarks=null;updSmallBar();fillLayerSheet();schedule();return;}closeSheet('layerSheet');toast('找小線段中…',800);
  findSmall().catch(err=>{console.error(err);toast('找小線段出錯：'+(err&&err.message||err),5000);});};
/* ---------- 區域檢查：一區兩種屬性、房屋未封閉、增建註記位置、空白區（規則在 js/area.js） ---------- */
const AREA_COL={road:'#b46bff',mix:'#ff2bd6',open:'#ff5a1f',addout:'#ffa31a',empty:'#2bd9ff'};
function areaCollect(){
  // 只寫編號的圖層（97321）借同編號、有名稱的那層（97321_旱作地）來判斷
  const full=new Map();for(const l of impLayers){const m=/^(a?\d+[A-Za-z]*)[_\s]*(\S.*)$/.exec(l.name);if(m&&/[^\x00-\x7f]/.test(m[2]))full.set(m[1].toUpperCase(),l.name);}
  const fullName=n=>/^a?\d+[A-Za-z]*$/.test(n)?(full.get(n.toUpperCase())||n):n;
  const roles=new Map(),kindOf=new Map();
  for(const l of impLayers){const fn=fullName(l.name),r=areaRole(fn);if(r){roles.set(l.name,r);kindOf.set(l.name,areaKindName(fn));}}
  if(!roles.size)return null;
  // 作業範圍線候選：沒有編碼的圖層上的封閉線（例如 bon）
  const rangeLy=new Set(impLayers.map(l=>l.name).filter(n=>!roles.has(n)&&!/^a?\d/.test(n)&&!/^Q/i.test(n)&&!/圖框|圖號/.test(n)));
  const lines=[],points=[],ranges=[],gates=[];let ox=0,oy=0;
  const pushLine=(a,r,ly)=>{if(r.wing&&a.length<=6){const n=a.length/2;let L=0;for(let i=2;i<a.length;i+=2)L+=Math.hypot(a[i]-a[i-2],a[i+1]-a[i-1]);if(L<3&&Math.hypot(a[0]-a[a.length-2],a[1]-a[a.length-1])>0.01)return;}lines.push({p:a,r:r.b,ly});};// 橋、涵的小翅膀不算
  const grpPt=(x,y,r,ly,w,h)=>{if(r.gate)gates.push([x,y]);else if(r.t&&!r.a)points.push(r.t==='temp'?{x,y,k:'H'}:{x,y,add:true});else if(r.a)points.push({x,y,k:kind(ly),w,h});};
  const kind=ly=>kindOf.get(ly)||ly;
  const textPt=(e,r)=>{const s=e.lines.join('').replace(/\s/g,'');if(!s)return;const b=e.bb||entBox(e);const x=(b[0]+b[2])/2-ox,y=(b[1]+b[3])/2-oy;
    if(r.t==='temp')points.push({x,y,k:'H'});
    else if(r.t==='house'){if(/^\d/.test(s))points.push({x,y,k:'H'});else if(/^[A-Za-z]/.test(s))points.push({x,y,add:true});}
    else if(r.t==='add')points.push({x,y,add:true});
    else if(r.a)points.push({x,y,k:kind(e.ly)});};
  if(nativeOn){
    const req={b:[...rangeLy],p:[],l:[],g:[]};for(const[n,r]of roles){if(r.b)req.b.push(n);if(r.gb&&!r.gate)req.g.push(n);if(r.a||r.gate||(r.t&&r.b))req.p.push(n);if(r.land)req.l.push(n);}
    const D=JSON.parse(CadNative.areaData(JSON.stringify(req))||'null');if(!D)return null;if(D.err)throw new Error(D.err);
    ox=D.ox;oy=D.oy;
    for(const a of D.s){const ly=D.L[a[0]],r=roles.get(ly);if(r&&r.b)pushLine(a.slice(1),r,ly);else if(r&&r.land)lines.push({p:a.slice(1),r:AR_OTHER,ly});else if(rangeLy.has(ly))ranges.push(a.slice(1));}
    for(const a of D.p){const n=D.L[a[0]],r=roles.get(n);if(r)grpPt(a[1],a[2],r,n,a[5]?a[3]:0,a[5]?a[4]:0);}
  }else{
    const f=imp.find(e=>e.bb&&isFinite(e.bb[0]));if(f){ox=Math.floor(f.bb[0]);oy=Math.floor(f.bb[1]);}
    const grp=new Map();
    for(const e of imp){if(e.t==='text')continue;
      if(rangeLy.has(e.ly)&&!e.g){for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);ranges.push(a);}continue;}
      const r=roles.get(e.ly);if(!r)continue;const b=e.bb||entBox(e);
      if(e.g&&r.gb&&!r.gate){for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);pushLine(a,r,e.ly);}continue;}
      if(e.g){if(!r.a&&!r.t&&!r.gate)continue;const k=e.g+'|'+e.ly;const g=grp.get(k);if(!g)grp.set(k,{b:b.slice(),ly:e.ly});else{g.b[0]=Math.min(g.b[0],b[0]);g.b[1]=Math.min(g.b[1],b[1]);g.b[2]=Math.max(g.b[2],b[2]);g.b[3]=Math.max(g.b[3],b[3]);}continue;}
      if(r.land&&Math.hypot(b[2]-b[0],b[3]-b[1])<=4){points.push({x:(b[0]+b[2])/2-ox,y:(b[1]+b[3])/2-oy,k:kind(e.ly)});continue;}
      if(r.land){for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);lines.push({p:a,r:AR_OTHER,ly:e.ly});}continue;}// 地物圖層上的長線是範圍線
      if(!r.b||e.t==='point'||e.t==='fill')continue;
      for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);pushLine(a,r,e.ly);}}
    for(const g of grp.values())grpPt((g.b[0]+g.b[2])/2-ox,(g.b[1]+g.b[3])/2-oy,roles.get(g.ly),g.ly,(g.b[2]-g.b[0])/2,(g.b[3]-g.b[1])/2);
  }
  for(const e of imp){if(e.t!=='text')continue;const r=roles.get(e.ly);if(r)textPt(e,r);}
  return{lines,points,gates,ox,oy,range:areaPickRange(ranges,lines)};
}
/** 作業範圍：沒有編碼的圖層上最能框住新畫線的封閉線；回傳 {ring, inside:新畫的在裡面還是外面} */
function areaPickRange(ranges,lines){
  const newPts=[];for(const L of lines)if(!/^a/.test(L.ly)&&L.p.length>=2)newPts.push(L.p[0],L.p[1]);
  if(!newPts.length)return null;const step=Math.max(1,Math.floor(newPts.length/2/20000));
  let best=null;
  for(const r of ranges){const n=r.length/2;if(n<4)continue;if(Math.hypot(r[0]-r[r.length-2],r[1]-r[r.length-1])>0.01)continue;
    let A=0;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2)A+=r[j]*r[i+1]-r[i]*r[j+1];if(Math.abs(A)/2<1000)continue;
    let inn=0,tot=0;for(let k=0;k<newPts.length;k+=2*step){tot++;if(areaInRing(r,newPts[k],newPts[k+1]))inn++;}
    const sc=Math.max(inn,tot-inn);if(!best||sc>best.sc||(sc===best.sc&&Math.abs(A)<best.A))best={ring:r,inside:inn>=tot-inn,sc,A:Math.abs(A),inn,tot};}
  return best&&best.inn>0?best:null;
}
function areaInRing(r,x,y){let c=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const yi=r[i+1],yj=r[j+1];if((yi>y)!==(yj>y)&&x<(r[j]-r[i])*(y-yi)/(yj-yi)+r[i])c=!c;}return c;}
async function findArea(){
  const D=areaCollect();
  if(!D||!D.lines.length){toast('這張圖沒有認得的房屋、圍牆、道路、地類界圖層（5 碼或 7 碼編碼）',4000);return;}
  const R=areaCheck(D.lines,D.points,{tol:areaTolV(),gates:D.gates});
  if(D.range){const n0=R.marks.length;R.marks=R.marks.filter(m=>areaInRing(D.range.ring,m.x,m.y)===D.range.inside);R.st.outRange=n0-R.marks.length;
    const c={mix:0,road:0,open:0,addout:0,empty:0};for(const m of R.marks)c[m.type]++;Object.assign(R.st,c);}
  const ord={mix:0,road:1,open:2,addout:3,empty:4};
  R.marks.sort((a,b)=>ord[a.type]-ord[b.type]||b.y-a.y||a.x-b.x);
  smallKey=impName;smallMode='area';
  smallMarks=R.marks.map(m=>({p:[m.x+D.ox,m.y+D.oy],msg:m.msg,type:m.type,ring:m.ring,gap:m.gap,path:m.path,o:[D.ox,D.oy]}));smallIdx=-1;
  const c=R.st,parts=[];if(c.mix)parts.push(`一區兩種屬性 ${c.mix}`);if(c.road)parts.push(`和道路相通 ${c.road}`);if(c.open)parts.push(`房屋未封閉 ${c.open}`);if(c.addout)parts.push(`增建註記位置 ${c.addout}`);if(c.empty)parts.push(`空白區 ${c.empty}`);
  toast(smallMarks.length?`找到 ${smallMarks.length} 處：${parts.join('、')}${D.range?'（只看作業範圍內）':''}（${(c.ms/1000).toFixed(1)} 秒）`:`沒有找到問題（${c.face} 個區域，${(c.ms/1000).toFixed(1)} 秒）`,4500);
  if(!smallMarks.length)smallMarks=null;updSmallBar();updOldBtn();schedule();
}
$('lyArea').onclick=()=>{if(smallMarks&&smallMode==='area'){smallMarks=null;updSmallBar();fillLayerSheet();schedule();return;}closeSheet('layerSheet');busy(true,'檢查區域中…');
  setTimeout(()=>{findArea().catch(err=>{console.error(err);toast('區域檢查出錯：'+(err&&err.message||err),5000);}).finally(()=>busy(false));},60);};
$('smPrev').onclick=()=>smallGo(-1);$('smNext').onclick=()=>smallGo(1);$('smOff').onclick=()=>{smallMarks=null;updSmallBar();schedule();};

/* ---------- AutoCAD 索引色色盤 ---------- */
const ACI_NAMES={1:'紅',2:'黃',3:'綠',4:'青',5:'藍',6:'洋紅',7:'白'};
function aciName(i){return ACI_NAMES[i]||String(i);}
let aciCb=null,aciSel=7;
function openAci(cur,cb){aciCb=cb;aciSel=cur||7;buildAci();openSheet('aciSheet');}
function aciCell(i){const b=document.createElement('button');b.className='ac'+(i===aciSel?' on':'');b.style.background=aciHex(i);b.title=String(i);b.onclick=()=>{aciSel=i;buildAci();};return b;}
function buildAci(){
  const g1=$('aciTop'),g2=$('aciBot'),g3=$('aciStd'),g4=$('aciGray');[g1,g2,g3,g4].forEach(g=>g.innerHTML='');
  for(const off of[8,6,4,2,0])for(let c=0;c<24;c++)g1.appendChild(aciCell(10+c*10+off));
  for(const off of[1,3,5,7,9])for(let c=0;c<24;c++)g2.appendChild(aciCell(10+c*10+off));
  for(let i=1;i<=9;i++)g3.appendChild(aciCell(i));
  for(let i=250;i<=255;i++)g4.appendChild(aciCell(i));
  $('aciNum').value=aciSel;$('aciPrev').style.background=aciHex(aciSel);
  const h=aciHex(aciSel);$('aciInfo').textContent=`索引顏色：${aciName(aciSel)}　紅,綠,藍：${parseInt(h.slice(1,3),16)},${parseInt(h.slice(3,5),16)},${parseInt(h.slice(5,7),16)}`;
}
$('aciNum').onchange=()=>{const v=parseInt($('aciNum').value);if(v>=1&&v<=255){aciSel=v;buildAci();}else $('aciNum').value=aciSel;};
$('aciOk').onclick=()=>{closeSheet('aciSheet');if(aciCb)aciCb(aciSel);aciCb=null;};

/* ---------- 設定 ---------- */
function fillOsnaps(os){os.innerHTML='';for(const[k,n]of OSN){const l=document.createElement('label'),c=document.createElement('input');c.type='checkbox';c.checked=!!st.osm[k];c.onchange=()=>{st.osm[k]=c.checked;saveSettings();};l.append(c,n);os.appendChild(l);}}
const OSN_MINE=['end','app','ins','int','per','nea'];
function setOsnaps(keys){for(const[k]of OSN)st.osm[k]=keys.includes(k);if(!st.snap)st.snap=true;saveSettings();updateUI();fillOsnaps($('osnapsQ'));}
function fillSettings(){
  $('sLt').value=st.ltscale;$('sLon').value=st.lon0;$('sPrec').value=st.prec;$('sTh').value=st.textH;$('sInk').value=st.inkW;
  $('bgDark').style.outline=st.bg!=='white'?'2px solid var(--acc)':'';$('bgWhite').style.outline=st.bg==='white'?'2px solid var(--acc)':'';
  fillOsnaps($('osnaps'));
  const sf=NP().SupportFolder;$('supPick').style.display=sf?'block':'none';$('supScan').style.display=sf&&localStorage.getItem('simplecad.supUri')?'block':'none';
  $('supMsg').textContent=supportStatus();
}
const numSet=(id,k,min)=>$(id).onchange=e=>{const v=parseFloat(e.target.value);if(isFinite(v)&&v>(min??-Infinity)){st[k]=v;saveSettings();for(const x of imp)if(x._sg)delete x._sg;schedule();}else e.target.value=st[k];};
numSet('sLt','ltscale',0);numSet('sLon','lon0');numSet('sTh','textH',0);numSet('sInk','inkW',0);
$('sPrec').onchange=e=>{st.prec=Math.max(0,Math.min(6,parseInt(e.target.value)||0));e.target.value=st.prec;saveSettings();refreshCmd();};
$('bgDark').onclick=()=>{st.bg='dark';saveSettings();fillSettings();schedule();};
$('bgWhite').onclick=()=>{st.bg='white';saveSettings();fillSettings();schedule();};
let clearArm=0;
$('clearMine').onclick=()=>{const b=$('clearMine');if(Date.now()-clearArm>3000){clearArm=Date.now();b.textContent='再按一次確認清除';setTimeout(()=>b.textContent='清除這張圖上我畫的東西',3000);return;}
  snapshot();st.ents=[];saveDraw();schedule();b.textContent='清除這張圖上我畫的東西';clearArm=0;closeSheet('setSheet');};

/* ---------- Support 檔案 ---------- */
function supportStatus(){const n=Object.keys(shxFiles),uri=localStorage.getItem('simplecad.supUri');const ln=lts.filter(l=>l.src==='support').length;
  return(uri?`Support 資料夾：${localStorage.getItem('simplecad.supName')||'已選擇'}\n`:'')+`已載入線型 ${ln} 種、SHX ${n.length} 個`+(n.length?`（${n.slice(0,30).join('、')}${n.length>30?'…':''}）`:'');}
function processSupport(name,bytes){
  const ext=(name.split('.').pop()||'').toLowerCase();
  if(ext==='shx'){const r=addShx(bytes,name);return`${name}：`+(r.type==='bigfont'?`大字體 ${r.idx.size} 字`:r.type==='unifont'?`Unicode 字型 ${Object.keys(r.byNum).length} 字`:r.isFont?`字型 ${Object.keys(r.byNum).length} 字`:`${Object.keys(r.byNum).length} 個形狀`);}
  if(ext!=='lin')return`${name}：略過（只吃 .lin、.shx`+(/^(rar|zip|7z)$/.test(ext)?'，壓縮檔請先解壓縮':'')+'）';
  let txt;try{txt=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(_){txt=new TextDecoder('big5').decode(bytes);}
  const list=parseLin(txt);if(!list.length)return`${name}：找不到線型定義`;
  list.forEach(x=>x.src='support');mergeLT(list);return`${name}：${list.length} 種線型`;
}
function afterSupport(){invalidateBase();nLtSig='';for(const x of imp)if(x._sg)delete x._sg;for(const x of st.ents)if(x._sg)delete x._sg;saveSettings();schedule();}
$('supFiles').onchange=async e=>{const files=[...e.target.files];e.target.value='';busy(true,'載入 Support 檔案…');const msgs=[];
  for(const f of files){try{msgs.push(processSupport(f.name,new Uint8Array(await f.arrayBuffer())));}catch(err){msgs.push(`${f.name}：${err.message}`);}}
  busy(false);afterSupport();$('supMsg').textContent=msgs.join('；')+'\n'+supportStatus();};
$('supPick').onclick=async()=>{const SF=NP().SupportFolder;if(!SF)return;try{const r=await SF.pick();localStorage.setItem('simplecad.supUri',r.uri);localStorage.setItem('simplecad.supName',r.name||'');localStorage.removeItem('simplecad.supMan');await scanSupport(true);fillSettings();}catch(err){if(!/cancel/i.test(err.message||''))toast('選資料夾失敗：'+(err.message||err));}};
$('supScan').onclick=async()=>{localStorage.removeItem('simplecad.supMan');await scanSupport(true);fillSettings();};
async function scanSupport(show){
  const SF=NP().SupportFolder,uri=localStorage.getItem('simplecad.supUri');if(!SF||!uri)return;
  let man={};try{man=JSON.parse(localStorage.getItem('simplecad.supMan')||'{}');}catch(_){}
  try{
    const{files}=await SF.list({uri});const todo=files.filter(f=>{const k=f.size+':'+f.modified;return man[f.name]!==k;});
    if(!todo.length){if(show)toast('Support 資料夾沒有變動');return;}
    if(show)busy(true,`載入 Support：${todo.length} 個檔案…`);else toast(`更新 Support：${todo.length} 個檔案…`);
    let i=0;for(const f of todo){i++;if(show)busy(true,`載入 Support（${i}/${todo.length}）：${f.name}`);
      try{const{data}=await SF.read({uri:f.uri});processSupport(f.name,unb64(data));man[f.name]=f.size+':'+f.modified;}catch(err){console.warn(f.name,err);}}
    localStorage.setItem('simplecad.supMan',JSON.stringify(man));afterSupport();toast(`Support 已更新 ${todo.length} 個檔案`);
  }catch(err){toast('讀取 Support 資料夾失敗：'+(err.message||err));}
  finally{busy(false);}
}

/* ---------- 開啟底圖 ---------- */
let libLoaded=false;
$('cadFile').addEventListener('click',e=>{if(!NATIVE)return;e.preventDefault();closeSheet('fileSheet');nativeOpen();});
$('cadFile').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;closeSheet('fileSheet');await openDrawing(f.name,new Uint8Array(await f.arrayBuffer()),true);};
async function openDrawing(name,bytes,store){
  if(NATIVE){nativeOn=false;nFit=null;nCache.clear();try{CadNative.clearBase();}catch(_){}}
  const ext=(name.split('.').pop()||'').toLowerCase();
  if(ext!=='dwg'&&ext!=='dxf'){toast('請選 .dwg 或 .dxf 檔');return;}
  busy(true,(libLoaded||ext==='dxf')?`讀取「${name}」中…`:'第一次開檔要先載入解析器（約 11 MB），請稍候…');await sleep(60);
  try{
    const mod=await import('../dwg.js');
    busy(true,`解析「${name}」中…`);await sleep(30);
    const r=await mod.readCad(bytes.slice().buffer,ext);if(ext==='dwg')libLoaded=true;
    for(const x of r.ents)x.bb=entBox(x);
    buildGrid(r.ents);
    saveDrawNow();
    imp=r.ents;grpIdx=null;impLayers=r.layers;offLy=new Set(r.layers.filter(l=>l.off||(l.hidden&&!l.frozen)).map(l=>l.name));frzLy=new Set(r.layers.filter(l=>l.frozen).map(l=>l.name));syncHid();
    if(r.lts.length){const usable=x=>x.els.filter(e=>e.k==='shape').every(e=>e.file&&findShape(e));
      mergeLT(r.lts.map(finishLT).filter(x=>{const o=lts.find(y=>y.name===x.name);return!(o&&o.src==='support')||usable(x);}));}
    st.ltscale=r.ltscale||1;impName=name;blankName='';loadDraw(name+'|'+bytes.length);endCmd();
    await addRecent(name,bytes);
    const sk=Object.entries(r.skipped);busy(false);zoomFit();
    toast(`已開啟「${name}」：${imp.length} 個物件`+(st.ents.length?`，載回你畫的 ${st.ents.length} 個`:'')+(sk.length?`（未顯示：${sk.map(([k,v])=>k+' '+v).join('、')}）`:''),4000);
  }catch(err){busy(false);toast('開檔失敗：'+(err&&err.message||err),5000);console.error(err);}
}
/* ---------- 最近開過的檔案 ---------- */
const RECENT_MAX=6;
function recentList(){try{return JSON.parse(localStorage.getItem('simplecad.recent')||'[]');}catch(_){return[];}}
function recentSave(L){try{localStorage.setItem('simplecad.recent',JSON.stringify(L));}catch(_){}}
async function addRecent(name,bytes){
  const key=name+'|'+bytes.length;let L=recentList();const had=L.find(x=>x.key===key);
  if(!had)await idbFile('f:'+key,bytes.slice().buffer);
  L=[{key,name,size:bytes.length,t:Date.now()},...L.filter(x=>x.key!==key)];
  for(const x of L.slice(RECENT_MAX))if(!x.native)await idbFile('f:'+x.key,null);
  recentSave(L.slice(0,RECENT_MAX));localStorage.setItem('simplecad.lastKey',key);
}
async function openRecent(key,quiet){
  {const x=recentList().find(r=>r.key===key);if(x&&x.blank){openBlank(x.name);return;}}
  {const x=recentList().find(r=>r.key===key);if(x&&x.native){if(!NATIVE)return;try{busy(true,`開啟「${x.name}」…`);const m=await CadCall('Cad','openCache',{name:x.name,size:x.size});await nativeLoaded(m);}catch(err){busy(false);if(!quiet)toast('這張圖的暫存不見了，請重新從手機選檔');recentSave(recentList().filter(r=>r.key!==key));fillRecent();}return;}}
  const x=recentList().find(r=>r.key===key);const v=x&&await idbFileGet('f:'+key);
  if(!v){if(!quiet)toast('這個檔案的暫存不見了，請重新從手機選檔');recentSave(recentList().filter(r=>r.key!==key));fillRecent();return;}
  await openDrawing(x.name,new Uint8Array(v),true);
}
function fillRecent(){
  const box=$('recentList');if(!box)return;box.innerHTML='';const L=recentList();
  $('recentSec').style.display=L.length?'block':'none';
  const z=n=>String(n).padStart(2,'0');
  for(const x of L){
    const d=new Date(x.t),cur=(impName||x.blank)&&drawKey===x.key;let n=0;try{n=JSON.parse(localStorage.getItem('simplecad.draw:'+x.key)||'[]').length;}catch(_){}
    const r=document.createElement('div');r.className='rct';
    const b=document.createElement('button');b.className='rcb'+(cur?' cur':'');
    b.innerHTML=`<div class="rcn"></div><div class="rcm">${d.getMonth()+1}/${d.getDate()} ${z(d.getHours())}:${z(d.getMinutes())}　${x.blank?'空白圖':(x.size/1048576).toFixed(1)+' MB'}${n?`　我畫的 ${n} 個`:''}${cur?'　（目前開著）':''}</div>`;
    b.querySelector('.rcn').textContent=x.name;
    b.onclick=()=>{closeSheet('fileSheet');if(!cur)openRecent(x.key);};
    const del=document.createElement('button');del.className='rcx';del.textContent='✕';del.title='從清單移除（你畫的東西會保留）';
    if(x.blank)del.title='刪除這張空白圖（裡面畫的東西也會刪掉）';
    del.onclick=async()=>{if(x.blank){if(!window.confirm('刪除空白圖「'+x.name+'」和裡面畫的東西？'))return;if(drawKey===x.key){blankName='';loadDraw('(無底圖)');schedule();}localStorage.removeItem('simplecad.draw:'+x.key);}else await idbFile('f:'+x.key,null);recentSave(recentList().filter(r=>r.key!==x.key));fillRecent();};
    r.append(b,del);box.appendChild(r);
  }
}
function saveDrawNow(){clearTimeout(saveDT);try{localStorage.setItem('simplecad.draw:'+drawKey,JSON.stringify(st.ents));}catch(_){toast('手機空間存不下這麼多東西，請先匯出 DXF 備份',5000);}}
$('newBlank').onclick=newBlank;
$('impClear').onclick=()=>{blankName='';if(NATIVE){nativeOn=false;nFit=null;nCache.clear();try{CadNative.clearBase();}catch(_){}}saveDrawNow();imp=[];grpIdx=null;grid=null;impLayers=[];hidLy.clear();offLy.clear();frzLy.clear();impName='';localStorage.removeItem('simplecad.lastKey');loadDraw('(無底圖)');closeSheet('fileSheet');schedule();};

/* ---------- IndexedDB（最後開的圖） ---------- */
function idb2(){return new Promise((res,rej)=>{try{const r=indexedDB.open('simplecad',2);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('shx'))d.createObjectStore('shx');if(!d.objectStoreNames.contains('files'))d.createObjectStore('files');};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});}
async function idbFile(k,v){try{const d=await idb2();await new Promise(r=>{const t=d.transaction('files','readwrite');const s=t.objectStore('files');v==null?s.delete(k):s.put(v,k);t.oncomplete=t.onerror=()=>r();});}catch(_){}}
async function idbFileGet(k){try{const d=await idb2();return await new Promise(r=>{const t=d.transaction('files','readonly'),q=t.objectStore('files').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null);});}catch(_){return null;}}

/* ---------- 匯出 DXF（R12，中文用 \U+ 表示） ---------- */
function encDxf(s){let o='';for(const ch of String(s)){const c=ch.codePointAt(0);if(c<128&&c>=32)o+=ch;else if(c>0xffff)o+='?';else o+='\\U+'+c.toString(16).toUpperCase().padStart(4,'0');}return o;}
const nf=v=>{const s=(+v).toFixed(6);return s.replace(/\.?0+$/,'')||'0';};
function buildDXF(){
  const o=[];const w=(c,v)=>{o.push(String(c).padStart(3,' '));o.push(String(v));};
  const ents=st.ents.filter(e=>['line','pline','ink','circle','arc','text','dim','point','fill'].includes(e.t));
  const used=new Set(['CONTINUOUS']);for(const L of st.layers)used.add((L.lt||'CONTINUOUS').toUpperCase());for(const e of ents)if(e.lt)used.add(e.lt.toUpperCase());
  w(0,'SECTION');w(2,'HEADER');w(9,'$ACADVER');w(1,'AC1009');w(9,'$DWGCODEPAGE');w(3,'ANSI_950');w(9,'$LTSCALE');w(40,nf(st.ltscale));w(0,'ENDSEC');
  w(0,'SECTION');w(2,'TABLES');
  w(0,'TABLE');w(2,'LTYPE');w(70,used.size);
  for(const n of used){const lt=getLT(n);const els=(lt&&lt.name===n&&lt.els||[]).filter(e=>e.k==='len');const tot=els.reduce((a,e)=>a+Math.abs(e.v),0);
    w(0,'LTYPE');w(2,encDxf(n));w(70,0);w(3,encDxf((lt&&lt.desc)||''));w(72,65);w(73,tot>0?els.length:0);w(40,nf(tot));if(tot>0)for(const e of els)w(49,nf(e.v));}
  w(0,'ENDTAB');
  const lys=[{name:'0',ci:7,lt:'CONTINUOUS',on:true},...st.layers.filter(l=>l.name!=='0')];
  w(0,'TABLE');w(2,'LAYER');w(70,lys.length);for(const L of lys){w(0,'LAYER');w(2,encDxf(L.name));w(70,0);w(62,L.on===false?-L.ci:L.ci);w(6,encDxf((L.lt||'CONTINUOUS').toUpperCase()));}w(0,'ENDTAB');
  w(0,'TABLE');w(2,'STYLE');w(70,1);w(0,'STYLE');w(2,'STANDARD');w(70,0);w(40,0);w(41,1);w(50,0);w(71,0);w(42,2.5);w(3,'txt');w(4,'chineset.shx');w(0,'ENDTAB');
  w(0,'ENDSEC');
  w(0,'SECTION');w(2,'ENTITIES');
  const head=(t,e)=>{w(0,t);w(8,encDxf(e.ly||st.cur));if(e.ci!=null)w(62,e.ci);if(e.lt)w(6,encDxf(e.lt.toUpperCase()));};
  const pt=(c,p)=>{w(c,nf(p[0]));w(c+10,nf(p[1]));w(c+20,0);};
  for(const e of ents){
    switch(e.t){
      case'line':head('LINE',e);pt(10,e.a);pt(11,e.b);break;
      case'dim':{const L=dist(e.a,e.b);if(!L)break;const h=e.h||st.textH||2,ux=(e.b[0]-e.a[0])/L,uy=(e.b[1]-e.a[1])/L,nx=-uy,ny=ux,off=e.off||0,sg=Math.sign(off)||1;
        const A2=[e.a[0]+nx*off,e.a[1]+ny*off],B2=[e.b[0]+nx*off,e.b[1]+ny*off],ln=(p,q)=>{head('LINE',e);pt(10,p);pt(11,q);};
        if(Math.abs(off)>h*0.3)for(const[P,Q]of[[e.a,A2],[e.b,B2]])ln([P[0]+nx*sg*h*0.25,P[1]+ny*sg*h*0.25],[Q[0]+nx*sg*h*0.5,Q[1]+ny*sg*h*0.5]);
        ln(A2,B2);const tx=(ux+nx)/Math.SQRT2*h*0.5,ty=(uy+ny)/Math.SQRT2*h*0.5;for(const P of[A2,B2])ln([P[0]-tx,P[1]-ty],[P[0]+tx,P[1]+ty]);
        let ang=Math.atan2(uy,ux);if(Math.cos(ang)<-1e-6)ang+=Math.PI;const m=midp(A2,B2),tp=[m[0]-Math.sin(ang)*h*0.4,m[1]+Math.cos(ang)*h*0.4];
        head('TEXT',e);pt(10,tp);w(40,nf(h));w(1,fmt(L));w(50,nf(normA(deg(ang))));w(7,'STANDARD');w(72,1);pt(11,tp);break;}
      case'pline':case'ink':head('POLYLINE',e);w(66,1);pt(10,[0,0]);w(70,e.closed?1:0);
        for(const p of e.pts){w(0,'VERTEX');w(8,encDxf(e.ly||st.cur));pt(10,p);w(70,0);}w(0,'SEQEND');w(8,encDxf(e.ly||st.cur));break;
      case'circle':head('CIRCLE',e);pt(10,e.o);w(40,nf(e.r));break;
      case'arc':head('ARC',e);pt(10,e.o);w(40,nf(e.r));w(50,nf(normA(deg(e.a0))));w(51,nf(normA(deg(e.a1))));break;
      case'text':e.lines.forEach((ln,i)=>{head('TEXT',e);const off=(e.y0||0)+i*(e.ls||e.h*1.667),r=e.rot||0,p=[e.p[0]+Math.sin(r)*off,e.p[1]-Math.cos(r)*off];pt(10,p);w(40,nf(e.h));w(1,encDxf(ln));w(50,nf(normA(deg(r))));if(e.wf&&e.wf!==1)w(41,nf(e.wf));w(7,'STANDARD');if(e.ha){w(72,e.ha);pt(11,p);}});break;
      case'point':head('POINT',e);pt(10,e.p);break;
      case'fill':for(const r of e.rings){if(r.length===3||r.length===4){head('SOLID',e);pt(10,r[0]);pt(11,r[1]);pt(12,r[r.length-1]);pt(13,r.length===4?r[2]:r[2]);}
        else{head('POLYLINE',e);w(66,1);pt(10,[0,0]);w(70,1);for(const p of r){w(0,'VERTEX');w(8,encDxf(e.ly||st.cur));pt(10,p);w(70,0);}w(0,'SEQEND');w(8,encDxf(e.ly||st.cur));}}break;
    }
  }
  w(0,'ENDSEC');w(0,'EOF');
  return o.join('\r\n')+'\r\n';
}
function exportName(){if(blankName){const d=new Date(),z=n=>String(n).padStart(2,'0');return`${blankName}_${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}.dxf`;}const base=impName?impName.replace(/\.[^.]+$/,''):'補繪';const d=new Date(),z=n=>String(n).padStart(2,'0');return`${base}_補繪_${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}.dxf`;}
async function exportDXF(share){
  if(!st.ents.length){toast('這張圖上你還沒畫東西');return;}
  const txt=buildDXF(),name=exportName(),bytes=new TextEncoder().encode(txt),data=b64(bytes);const P=NP();
  try{
    if(!share&&P.SupportFolder&&P.SupportFolder.saveAs){await P.SupportFolder.saveAs({name,data,mime:'application/dxf'});toast('已存檔：'+name);return;}
    if(P.Filesystem&&P.Share){const r=await P.Filesystem.writeFile({path:name,data,directory:'CACHE'});await P.Share.share({title:name,files:[r.uri],dialogTitle:'分享 DXF'});return;}
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:'application/dxf'}));a.download=name;document.body.appendChild(a);a.click();a.remove();
    toast('已下載：'+name);
  }catch(err){if(!/cancel/i.test(err.message||''))toast('匯出失敗：'+(err.message||err),4000);}
}
$('expSave').onclick=()=>{closeSheet('fileSheet');exportDXF(false);};
$('expShare').onclick=()=>{closeSheet('fileSheet');exportDXF(true);};

/* ---------- 啟動 ---------- */
function loadAll(){
  lts=[{name:'CONTINUOUS',desc:'Solid line',els:[],total:0}];mergeLT(parseLin(BUILTIN));
  try{const o=JSON.parse(localStorage.getItem('simplecad.v2')||'null');
    if(o){st=Object.assign(st,o);{const m=o.osm||{};// 舊設定：插入點、節點原本跟著端點
      st.osm=Object.assign({},OSM_DEF,m.end===false&&!('ins'in m)?{ins:false,nod:false}:{},m);}}
    else{const v1=JSON.parse(localStorage.getItem('simplecad.v1')||'null');if(v1&&v1.st){if(v1.st.ents&&v1.st.ents.length)localStorage.setItem('simplecad.draw:(無底圖)',JSON.stringify(v1.st.ents.map(e=>Object.assign(e,{ly:e.ly||'補繪'}))));if(Array.isArray(v1.lts))mergeLT(v1.lts.filter(x=>x&&x.name&&Array.isArray(x.els)).map(finishLT));}}
    const sl=JSON.parse(localStorage.getItem('simplecad.lts')||'null');if(Array.isArray(sl))mergeLT(sl.filter(x=>x&&x.name&&Array.isArray(x.els)).map(finishLT));
  }catch(_){}
  if(!st.layers||!st.layers.length)st.layers=[{name:'補繪',ci:1,lt:'CONTINUOUS',on:true}];
  if(!st.layers.some(l=>l.name===st.cur))st.cur=st.layers[0].name;
  st.view=null;loadDraw('(無底圖)');
}
loadAll();
buildTabs();
window.addEventListener('resize',resize);try{new ResizeObserver(resize).observe($('wrap'));}catch(_){}
resize();setHint(baseHintText());updateUI();
(async()=>{
  await loadShxStore();
  if(NP().SupportFolder&&localStorage.getItem('simplecad.supUri'))await scanSupport(false);
  // 舊版只存一個 'last'：搬進最近檔案清單
  const old=await idbFileGet('last');if(old&&old.bytes){await addRecent(old.name,new Uint8Array(old.bytes));await idbFile('last',null);}
  const lk=localStorage.getItem('simplecad.lastKey');if(lk)await openRecent(lk,true);
  schedule();
})();
window.__cad={get cmd(){return cmd;},get cur(){return cur;},get st(){return st;},get imp(){return imp;},get lts(){return lts;},schedule,zoomFit,shxFiles:()=>shxFiles,buildDXF,tm2ll,set view(v){st.view=v;},get view(){return st.view;}};
document.querySelectorAll('#penW [data-w]').forEach(b=>b.onclick=()=>{st.inkW=+b.dataset.w;fillPenW();saveSettings();buildPenBar();});
