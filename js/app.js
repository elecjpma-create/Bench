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
  find:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/>',
  loc:'<circle cx="12" cy="12" r="4"/><path d="M12 2v4M12 18v4M2 12h4M18 12h4"/><circle cx="12" cy="12" r="8"/>',
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
  scale:'<rect x="3" y="11" width="10" height="10" rx="1"/><path d="M13 11l8-8M15 3h6v6"/>',
  ins:'<rect x="3" y="3" width="9" height="9" rx="1"/><path d="M16 12v8M12 16h8"/>',
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

/* ---------- 經緯度 → TWD97 二度分帶（GRS80；WGS84 與 TWD97 差不到 1m，不另轉基準） ---------- */
function ll2tm(lat,lon,lon0){
  const a=6378137,f=1/298.257222101,k0=0.9999,E0=250000,e2=f*(2-f),ep2=e2/(1-e2);
  const p=rad(lat),l=rad(lon)-rad(lon0),sp=Math.sin(p),cp=Math.cos(p),tp=Math.tan(p);
  const N=a/Math.sqrt(1-e2*sp*sp),T=tp*tp,C=ep2*cp*cp,A=l*cp;
  const M=a*((1-e2/4-3*e2*e2/64-5*e2**3/256)*p-(3*e2/8+3*e2*e2/32+45*e2**3/1024)*Math.sin(2*p)+(15*e2*e2/256+45*e2**3/1024)*Math.sin(4*p)-(35*e2**3/3072)*Math.sin(6*p));
  const E=E0+k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep2)*A**5/120);
  const Nn=k0*(M+N*tp*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep2)*A**6/720));
  return[E,Nn];
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
// 只顯示、不能點也不能鎖點的底圖圖層（2026-11-20：圖號畫圖時一直被點到）
const VIEW_ONLY_LY=/^a?圖號$/;const pickable=e=>shown(e)&&!VIEW_ONLY_LY.test(e.ly||'');
function* snapEnts(w,tol){for(const e of st.ents)if(ownShown(e))yield e;const L=w?queryImp(w[0]-tol,w[1]-tol,w[0]+tol,w[1]+tol):imp;for(const e of L)if(pickable(e))yield e;
  if(w)for(const e of nativeNear(w[0]-tol,w[1]-tol,w[0]+tol,w[1]+tol,600))if(pickable(e))yield e;}
function snapAt(w,base){
  if(st.snap){const s=findSnap(w,22/st.view.s,base);if(s)return{p:s.p.slice(),snap:s};}
  if(st.ortho&&base){const dx=w[0]-base[0],dy=w[1]-base[1];return{p:Math.abs(dx)>=Math.abs(dy)?[w[0],base[1]]:[base[0],w[1]],snap:null};}
  return{p:w.slice(),snap:null};
}
function cmdBase(){return cmd&&cmd.base?cmd.base():null;}
function setCursorRaw(w){const r=snapAt(w,cmdBase());cur={raw:w.slice(),p:r.p,snap:r.snap};kp.unlockAll();refreshCmd();}
function pickEnt(w,filter){
  const tol=18/st.view.s;let bi=null,bd=tol,oi=null,od=tol;
  // 文字框內不算 0：點到框裡時，8 像素內有線就選線（大字如圖號才不會擋住下面的線）
  for(const e of snapEnts(w,tol)){if(filter&&!filter(e))continue;if(!near(e,w,tol))continue;let d=hitDist(e,w);if(e.t==='text')d=Math.max(d,8/st.view.s);
    if(e.imp){if(d<bd){bd=d;bi=e;}}else if(d<od){od=d;oi=e;}}
  // 自己畫的線在最上層（2026-11-20）：和底圖重疊時，自己的線只要不比底圖遠 6 像素以上就選自己的
  if(oi&&od<=bd+6/st.view.s)return oi;
  return bi||oi;
}

/* ---------- 復原與儲存 ---------- */
function snapshot(){undoS.push(JSON.stringify(st.ents));if(undoS.length>200)undoS.shift();redoS=[];}
function doUndo(){if(cmd&&cmd.pts&&cmd.pts.length){cmdUndoPt();return;}if(!undoS.length)return;redoS.push(JSON.stringify(st.ents));st.ents=JSON.parse(undoS.pop());selE=null;selSet.clear();saveDraw();updateUI();schedule();}
function doRedo(){if(!redoS.length)return;undoS.push(JSON.stringify(st.ents));st.ents=JSON.parse(redoS.pop());selE=null;selSet.clear();saveDraw();updateUI();schedule();}
function addEnt(e){e.ly=e.ly||st.cur;st.ents.push(e);}
let saveT=0,saveDT=0;
function saveSettings(){clearTimeout(saveT);saveT=setTimeout(()=>{try{const o=Object.assign({},st);delete o.ents;localStorage.setItem('simplecad.v2',JSON.stringify(o));localStorage.setItem('simplecad.lts',JSON.stringify(lts.filter(l=>l.src)));}catch(_){}},250);}
function saveDraw(){clearTimeout(saveDT);saveDT=setTimeout(saveDrawNow,200);}
function loadDraw(key){drawKey=key;try{st.ents=JSON.parse(localStorage.getItem('simplecad.draw:'+key)||'[]');}catch(_){st.ents=[];}for(const e of st.ents)delete e.bb;undoS=[];redoS=[];selE=null;selSet.clear();
  // 修 v0.9.47～0.9.63 的錯：複製／插入底圖的東西沒轉成自己的線（還帶底圖記號，畫面上看不到），開圖時轉回來
  let fx=0;for(const e of st.ents)if(e.imp){delete e.imp;delete e.g;delete e.c;delete e._sg;delete e.rc;e.ly=st.cur;if(e.lt==='BYLAYER'||e.lt==='BYBLOCK')delete e.lt;fx++;}
  if(fx){saveDraw();setTimeout(()=>toast(`修正了 ${fx} 個之前複製／插入後看不到的物件，放在「${st.cur}」圖層`,5000),800);}}

/* ---------- 數字鍵盤 ---------- */
const kp={
  mode:'la',act:null,vals:{},lock:{},shown:false,hidden:false,
  fields(){return this.mode==='la'?[['L','長度'],['A','角度']]:this.mode==='xy'?[['X','X 坐標'],['Y','Y 坐標']]:this.mode==='d'?[['D','距離']]:this.mode==='k'?[['K','比例']]:[['A','角度']];},
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
      d.innerHTML=`<label>${n}</label><div class="${this.act===k?'act':''} ${this.lock[k]?'lock':''}">${this.lock[k]&&this.vals[k]===''?'<span class="kcar">▏</span>':(this.cur(k)||'')}</div>`;
      // 點已選中、還在跟著游標的欄位＝清空開始打（2026-11-20）
      d.onclick=()=>{if(this.act===k&&!this.lock[k]&&this.cur(k)){this.clearFor(k);return;}this.act=k;this.render();};$('kfields').appendChild(d);
    }
    if(this.mode==='la'||this.mode==='xy'){const b=document.createElement('button');b.id='kswap';b.textContent='⇄';b.title='切換長度角度／坐標';b.onclick=()=>{this.setMode(this.mode==='la'?'xy':(cmdBase()?'la':'xy'));};$('kfields').appendChild(b);}
    const hb=document.createElement('button');hb.id='kswap';hb.textContent='⌄';hb.title='收起鍵盤';hb.onclick=()=>{this.hidden=true;$('keypad').style.display='none';updateCmdBar();};$('kfields').appendChild(hb);
  },
  key(c){
    const k=this.act;if(!k)return;
    let v=this.lock[k]?this.vals[k]:'';
    // ⌫（2026-11-20）：欄位是跟著游標的數字時，按 ⌫ 先清空讓你打；已經空了再按 ⌫ 才回到跟著游標
    if(c==='⌫'){if(!this.lock[k]){this.clearFor(k);return;}if(this.vals[k]===''){delete this.lock[k];delete this.vals[k];this.apply();return;}v=this.vals[k].slice(0,-1);}
    else if(c==='-'){v=v.startsWith('-')?v.slice(1):'-'+v;}
    else if(c==='.'){if(!v.includes('.'))v=(v===''||v==='-'?v+'0':v)+'.';}
    else v+=c;
    this.setRef();
    this.vals[k]=v;this.lock[k]=true;this.apply();
  },
  setRef(){if(this.ref==null){const b=cmdBase();this.ref=(b&&cur&&dist(b,cur.p)>1e-12)?Math.atan2(cur.p[1]-b[1],cur.p[0]-b[0]):0;}},
  clearFor(k){this.setRef();this.act=k;this.vals[k]='';this.lock[k]=true;this.apply();},
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
  // 先選後按指令：選物件那一步直接用先選的（修剪、延伸要依序點邊界，不套用）
  const pre=!cmd&&selSet.size&&c.kind==='select'&&!/^(trim|extend)$/.test(c.name)?[...selSet]:null;if(!cmd)selSet.clear();
  let skip=0;if(pre){for(const e of pre){if(c.filter&&!c.filter(e)){skip++;continue;}selSet.add(e);}}
  boxArm=false;cmd=c;cur=null;selE=null;kp.unlockAll();kp.hidden=false;kp.keepXY=false;eraser=false;
  if(c.keypad)kp.show(c.keypad);else kp.hide();
  closePanel();if(c.init)c.init();
  $('penbar').style.display=c.kind==='pen'?'flex':'none';if(c.kind==='pen')buildPenBar();
  refreshCmd();updateUI();
  if(pre){if(skip)toast(`略過底圖或不適用的 ${skip} 個`,2000);if(selSet.size&&cmd===c)c.ok();}
}
function endCmd(){if(cmd&&cmd.cleanup)cmd.cleanup();cmd=null;cur=null;selSet.clear();kp.hide();$('penbar').style.display='none';$('penW').style.display='none';$('cmdbar').style.display='none';setHint(baseHintText());updateUI();schedule();}
function cancelCmd(){if(cmd&&cmd.cancel&&cmd.cancel()===false){refreshCmd();return;}endCmd();}
function cmdPlus(){if(!cmd)return;if(cmd.kind==='points'){if(cur)commitPoint();}else if(cmd.plus)cmd.plus();}
function cmdOk(){if(!cmd)return;if(cmd.kind==='points'&&cur&&!cmd.live){const last=cmdBase();if(!last||dist(last,cur.p)>1e-9)commitPoint();}if(cmd&&cmd.ok)cmd.ok();refreshCmd();}
function commitPoint(){if(!cmd||!cur)return;const p=cur.p.slice();kp.unlockAll();
  cmd.onPoint(p);if(cmd&&cmd.kind==='points'&&cmd.keypad==='la'&&cmdBase()&&kp.mode==='xy'&&!kp.keepXY)kp.setMode('la');kp.keepXY=false;refreshCmd();}
function cmdUndoPt(){if(cmd&&cmd.pts&&cmd.pts.length){cmd.pts.pop();if(cmd.onUndoPt)cmd.onUndoPt();refreshCmd();}}
/** 點到底圖圖塊裡的一段線：整個圖塊一起亮、顯示插入點（像 CAD） */
let selGrpKey=null,selGrp=null,selIns=null,selE0=null,gripHit0=null;
function selBlock(){if(!selE||!selE.imp||!selE.g){selGrpKey=null;selGrp=null;selIns=null;return null;}
  if(selGrpKey!==selE){selGrpKey=selE;selGrp=groupOf(selE);selIns=selE.gi||selGrp.find(x=>x.gi)?.gi||null;
    if(!selIns&&nativeOn){try{selIns=JSON.parse(CadNative.groupIns(selE.g));}catch(_){selIns=null;}}}
  return selGrp;}
function baseHintText(){if(selE&&selBlock()&&selGrp.length>1){const ly=`［${selE.ly}］`,nm=selE.gn||(selGrp.find(x=>x.gn)||{}).gn;
    return`${ly}圖塊${nm?'「'+nm+'」':''}（${selGrp.length} 個物件）`+(selIns?`　插入點 X ${fmt(selIns[0])}　Y ${fmt(selIns[1])}`:'');}
  return selE?entInfo(selE):'單指拖曳平移、雙指縮放；點物件看資訊。下方選工具開始畫。';}
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
  $('txtOk').textContent=textCtx&&textCtx.edit?'更新':'放上去';openSheet('textSheet');setTimeout(()=>{try{$('txtVal').focus();}catch(_){}},150);
}
/** 編輯現有文字（自己寫的；底圖的不改）：內容、字高、角度 */
function openTextEdit(e){if(!e||e.t!=='text'||e.imp)return;textCtx={p:e.p.slice(),edit:e};
  $('txtVal').value=(e.lines||[]).join('\n');$('txtH').value=+(+e.h).toFixed(4);$('txtA').value=+normA(deg(e.rot||0)).toFixed(2);openTextDlg(null,true);}
$('txtOk').onclick=()=>{
  const v=$('txtVal').value.trim();if(!v||!textCtx){closeSheet('textSheet');return;}
  if(textCtx.edit){const e=textCtx.edit;if(!st.ents.includes(e)){closeSheet('textSheet');textCtx=null;return;}
    const h=parseFloat($('txtH').value)||e.h,a=parseFloat($('txtA').value)||0;snapshot();
    e.ls=e.ls?e.ls*h/(e.h||h):h*1.667;e.h=h;e.rot=rad(a);e.lines=v.split('\n');delete e._sg;delete e.rc;delete e.bb;
    saveDraw();closeSheet('textSheet');textCtx=null;setHint(baseHintText(),true,{t:'編輯文字',f:()=>openTextEdit(e)});schedule();toast('已更新文字');return;}
  const h=parseFloat($('txtH').value)||st.textH,a=parseFloat($('txtA').value)||0;st.textH=h;saveSettings();
  snapshot();addEnt({t:'text',p:textCtx.p,h,rot:rad(a),lines:v.split('\n'),ha:0,y0:0,ls:h*1.667,wf:1,font:'txt',big:'chineset'});saveDraw();
  closeSheet('textSheet');textCtx=null;startCmd(cmdText());
};
$('txtAlign').onclick=()=>{
  closeSheet('textSheet');const saved=textCtx;
  startCmd({kind:'pickObj',name:'textalign',hint:()=>['點一條線，文字會順著它的方向',false],
    onPick(e,w){const a=lineAngleAt(e,w);if(a==null){toast('這個物件取不到方向');return;}
      let d=normA(deg(a));if(d>90&&d<=270)d=normA(d-180);textCtx=saved;cmd=null;$('txtA').value=d.toFixed(2);openTextDlg(null,true);if(saved&&saved.edit)endCmd();else startCmdQuiet(cmdText());}});
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
// 街景：Google 地圖的街景畫面（不用金鑰）；附近沒有街景時由 Google 地圖自己處理
function openPano(la,lo){const u=`https://www.google.com/maps/@?api=1&map_action=pano&viewpoint=${la.toFixed(7)},${lo.toFixed(7)}`;
  if(NATIVE||isApp){location.href=u;return;}const w=window.open(u,'_blank');if(!w)location.href=u;}
function cmdCoord(ll){return pointsCmd({name:ll?'ll':'xy',live:true,keypad:'xy',
  base(){return null;},
  hint(){if(!cur)return[ll?'經緯度：點圖上任一點（可拖曳、可鎖點，或輸入坐標）':'點坐標：點圖上任一點（可拖曳、可鎖點）',false];
    const p=cur.p;if(!ll)return[`X ${fmt(p[0])}\nY ${fmt(p[1])}`,'big'];
    const[la,lo]=tm2ll(p[0],p[1],st.lon0);return[`${dmsLL(la,'N','S')}\n${dmsLL(lo,'E','W')}`,'big'];},
  extraBtns(){return cur?[{t:'複製',f:()=>{const p=cur.p;let t;if(ll){const[la,lo]=tm2ll(p[0],p[1],st.lon0);t=`${dmsLL(la,'N','S')} ${dmsLL(lo,'E','W')}`;}else t=`${fmt(p[0])},${fmt(p[1])}`;
      (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast('已複製：'+t)).catch(()=>toast(t,4000));}},
    ...(ll?[{t:'導航',f:()=>{const[la,lo]=tm2ll(cur.p[0],cur.p[1],st.lon0);openNav(la,lo);}},{t:'街景',f:()=>{const[la,lo]=tm2ll(cur.p[0],cur.p[1],st.lon0);openPano(la,lo);}}]:[])]:[];},
  onPoint(){},ok(){endCmd();}
});}

/* ---- 選取物件的共用步驟 ---- */
function selectStage(o){const x=o.extra||{};boxArm=false;return{kind:'select',name:x.name||o.name,filter:x.filter||o.filter,group:!!x.group,
  extraBtns(){return[{t:boxArm?'框選：拖曳畫框':'框選',c:'mode'+(boxArm?' on':''),f:()=>{boxArm=!boxArm;refreshCmd();}},{t:st.lockBase?'底圖已鎖':'鎖定底圖',c:'mode'+(st.lockBase?' on':''),f:()=>{lockBaseToggle();refreshCmd();}}];},
  hint:o.hint||function(){return[`${o.title}：點選要${o.verb}的物件${x.group?'（底圖也可以，圖塊會整個選起來）':''}（再點一次取消；按「框選」再拖曳可一次選一片：往右拉選框內的、往左拉碰到就選），選好按 ✓　已選 ${selCount()}`,selSet.size>0];},
  ok:o.ok||function(){if(!selSet.size){toast('還沒選物件');return;}o.next();}};}
const ownOnly=e=>!e.imp;
let grpIdx=null;
function groupOf(e){if(nativeOn&&e.g){const a=imp.filter(x=>x.g===e.g);return a.concat(nativeGroup(e.g));}if(!grpIdx){grpIdx=new Map();for(const x of imp)if(x.g){let a=grpIdx.get(x.g);if(!a)grpIdx.set(x.g,a=[]);a.push(x);}}return grpIdx.get(e.g)||[e];}
// 底圖物件複製成自己的：放到目前圖層、顏色隨圖層，保留線型
/* 圖塊：底圖的用 g 綁在一起；複製成自己的以後用 og 綁（點一下整組選、整組移動刪除） */
const newOg=()=>'o'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);
function ogOf(e,gm){const k=e.imp?(e.g?'i'+e.g:''):(e.og?'o'+e.og:'');if(!k||!gm)return null;if(!gm.has(k))gm.set(k,newOg());return gm.get(k);}
function ownGroup(e){return st.ents.filter(x=>x.og===e.og);}
function grpOf(e){return e.imp&&e.g?groupOf(e):(!e.imp&&e.og)?ownGroup(e):[e];}
/** 選了幾個：一個圖塊算 1 個 */
function selCount(){const k=new Set();for(const e of selSet)k.add(e.imp&&e.g?'i'+e.g:(!e.imp&&e.og)?'o'+e.og:e);return k.size;}
/** 底圖圖塊的插入點：讀檔時有就用；原生版另外跟原生要（同一個圖塊只問一次） */
const insCache=new Map();
function impIns(e){if(e.gi)return e.gi;if(!e.imp||!e.g)return null;if(insCache.has(e.g))return insCache.get(e.g);let p=null;
  for(const x of groupOf(e))if(x.gi){p=x.gi;break;}
  if(!p&&nativeOn){try{p=JSON.parse(CadNative.groupIns(e.g));}catch(_){p=null;}}insCache.set(e.g,p);return p;}
/** 鎖點用：游標附近圖塊的插入點（底圖圖塊、自己複製或插入的圖塊）。圖塊的線可能離插入點有段距離，所以往外多找 3m */
function insSnapCands(w,tol){const R=Math.max(tol,3),seen=new Set(),out=[];
  for(const e of snapEnts(w,R)){let k,p;if(e.imp&&e.g){k='i'+e.g;if(seen.has(k))continue;seen.add(k);p=impIns(e);}else if(!e.imp&&e.og&&e.gi){k='o'+e.og;if(seen.has(k))continue;seen.add(k);p=e.gi;}else continue;
    if(p&&Math.abs(p[0]-w[0])<=tol&&Math.abs(p[1]-w[1])<=tol)out.push(p);}return out;}
function ownCopy(e,gm){const c=JSON.parse(JSON.stringify(e));delete c.bb;const og=ogOf(e,gm);if(e.imp&&e.g&&!c.gi){const p=impIns(e);if(p)c.gi=p.slice();}// 複製的圖塊帶著插入點
  if(c.imp){delete c.imp;delete c.g;delete c.c;delete c._sg;delete c.rc;c.ly=st.cur;if(c.lt==='BYLAYER'||c.lt==='BYBLOCK')delete c.lt;}
  if(og)c.og=og;else delete c.og;return c;}

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
  const f=cmd&&cmd.filter;let n=0;const ok=e=>(!f||f(e))&&!(st.lockBase&&e.imp)&&boxHit(e,R,cross);
  for(const e of st.ents)if(ownShown(e)&&ok(e)&&!selSet.has(e)){selSet.add(e);n++;}
  if(!st.lockBase&&(!f||f({imp:1,t:'line',a:[0,0],b:[0,0]}))){
    const L=grid?queryImp(R[0],R[1],R[2],R[3]):imp;for(const e of L)if(pickable(e)&&ok(e)&&!selSet.has(e)){selSet.add(e);n++;}
    if(nativeOn)for(const e of nativeNear(R[0],R[1],R[2],R[3],200000))if(pickable(e)&&ok(e)&&!selSet.has(e)){selSet.add(e);n++;}
  }
  for(const e of [...selSet])if(!e.imp&&e.og)for(const x of ownGroup(e))selSet.add(x);// 自己的圖塊碰到一部分就整組
  toast(`${cross?'碰到框':'框內'}選到 ${n} 個`,1200);
}

/* ---------- 剪貼簿：複製到剪貼簿（含底圖，保留圖層、顏色、線型）、原座標貼上 ---------- */
let clip=null;const _aciC=new Map();
function hexAci(h){if(h==null)return 7;h=String(h);if(_aciC.has(h))return _aciC.get(h);
  const v=parseInt(h.replace('#',''),16);if(!isFinite(v))return 7;const r=v>>16&255,g=v>>8&255,b=v&255;let bi=7,bd=1e9;
  for(let i=1;i<=255;i++){const w=parseInt(aciHex(i).slice(1),16),d=((w>>16&255)-r)**2+((w>>8&255)-g)**2+((w&255)-b)**2;if(d<bd){bd=d;bi=i;}if(!d)break;}
  _aciC.set(h,bi);return bi;}
function clipCopy(e,gm){const c=JSON.parse(JSON.stringify(e));const og=ogOf(e,gm);if(og)c.og=og;if(e.imp&&e.g&&!c.gi){const p=impIns(e);if(p)c.gi=p.slice();}
  if(c.imp){for(const k of['imp','g','c','_sg','rc','nid','bb','nt','ti'])delete c[k];c.ci=hexAci(e.c);if(c.lt==='BYLAYER'||c.lt==='BYBLOCK')delete c.lt;if(!c.ly)c.ly='0';}
  else{delete c._sg;delete c.rc;}
  return c;}
function cmdCopyClip(){return selectStage({title:'複製到剪貼簿',verb:'複製',next(){
  const gm=new Map(),ents=[...selSet].map(e=>clipCopy(e,gm)),lys=new Map();
  for(const e of ents)if(!lys.has(e.ly)){const L=st.layers.find(l=>l.name===e.ly),I=impLayers.find(l=>l.name===e.ly);lys.set(e.ly,L?{name:L.name,ci:L.ci,lt:L.lt}:{name:e.ly,ci:I?hexAci(I.c):(e.ci||7),lt:'CONTINUOUS'});}
  clip={ents,layers:[...lys.values()]};try{localStorage.setItem('simplecad.clip',JSON.stringify(clip));}catch(_){}
  toast(`已複製 ${ents.length} 個到剪貼簿（換到別張圖用「原座標貼上」）`,3000);endCmd();
},extra:{name:'copyclip',group:true,filter:e=>!0}});}
function cmdPasteOrig(){
  if(!clip){try{clip=JSON.parse(localStorage.getItem('simplecad.clip')||'null');}catch(_){}}
  if(!clip||!clip.ents||!clip.ents.length){toast('剪貼簿是空的，先用「複製到剪貼簿」');return null;}
  if(cmd)endCmd();snapshot();const was=st.ents.length;
  for(const L of clip.layers||[])if(!st.layers.some(l=>l.name===L.name))st.layers.push({name:L.name,ci:L.ci||7,lt:L.lt||'CONTINUOUS',on:true});
  const add=JSON.parse(JSON.stringify(clip.ents)),gm=new Map();for(const e of add)if(e.og){if(!gm.has(e.og))gm.set(e.og,newOg());e.og=gm.get(e.og);}st.ents.push(...add);// 每次貼上都是新的一組saveSettings();saveDraw();
  if(!was&&!imp.length&&!nativeOn)zoomFit();
  toast(`已在原座標貼上 ${add.length} 個`,2000);schedule();return null;
}

/* ---------- 空白圖：不載底圖、自己命名，畫的東西另外存 ---------- */
let blankName='';
function dropBase(){if(NATIVE){nativeOn=false;nFit=null;nCache.clear();try{CadNative.clearBase();}catch(_){}}imp=[];grpIdx=null;insCache.clear();grid=null;impLayers=[];hidLy.clear();offLy.clear();frzLy.clear();impName='';syncHid();invalidateBase();}
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
      hint(){return this.pts.length?[`${title}：點目的點，或輸入距離、角度`+(copy?'（可連續複製，✓ 結束）':''),true]:[cur?`${title}：拖曳微調，再點一下或按 ＋ 確定基準點`:`${title}：點基準點`,!!cur];},
      onPoint(p){if(!this.pts.length){this.pts.push(p);return;}const b=this.pts[0],dx=p[0]-b[0],dy=p[1]-b[1];
        snapshot();if(copy){const gm=new Map();for(const e of sel){const c=ownCopy(e,gm);xform(c,q=>[q[0]+dx,q[1]+dy],0);st.ents.push(c);}}
        else for(const e of sel)xform(e,q=>[q[0]+dx,q[1]+dy],0);
        saveDraw();if(!copy){endCmd();toast('已移動');}},
      base(){return this.pts.length?this.pts[0]:null;},
      carry(){return this.pts.length>0;},
      ok(){endCmd();},
      preview(){if(this.pts.length&&cur){const b=this.pts[0],dx=cur.p[0]-b[0],dy=cur.p[1]-b[1];ctx.globalAlpha=.9;for(const e of sel){const c=JSON.parse(JSON.stringify(e));xform(c,q=>[q[0]+dx,q[1]+dy],0);drawTemp(c);}ctx.globalAlpha=1;previewPath([b],cur.p,false,true);}}
    }));
  },extra:{name:copy?'copy':'move',filter:copy?null:ownOnly,group:copy}});
}
function startCmdKeep(c){const keep=new Set(selSet);startCmd(c);selSet=keep;schedule();}
/* 旋轉 */
/* 旋轉：點中心，再點方向或輸入角度；「參考」＝點兩點量出原方向，再點（或輸入）新方向，轉兩者的差（像 CAD 的 R） */
function cmdRotate(){return selectStage({title:'旋轉',verb:'旋轉',next(){
  const sel=[...selSet];let ref=null,refA=null,np=null;// np：新方向用兩點（2026-11-23：參考方向要和某條線平行）
  const angTwo=(p,q)=>{let a=Math.atan2(q[1]-p[1],q[0]-p[0])-(refA??0);while(a>Math.PI/2)a-=Math.PI;while(a<=-Math.PI/2)a+=Math.PI;return a;};// 平行：取轉比較少的那個方向
  const angAt=(b,p)=>{const A=kp.num('A');if(A!=null)return rad(A)-(refA??0);return Math.atan2(p[1]-b[1],p[0]-b[0])-(refA??0);};
  const apply=a=>{snapshot();for(const e of sel)rotEnt(e,b0(),a);saveDraw();endCmd();toast('已旋轉');};let b0=()=>null;
  startCmdKeep(pointsCmd({name:'rot',init(){kp.setMode('xy');b0=()=>this.pts[0];},
    hint(){if(!this.pts.length)return[cur?'旋轉：拖曳微調，再點一下或按 ＋ 確定旋轉中心':'旋轉：點旋轉中心',!!cur];
      if(ref&&ref.length===0)return['旋轉（參考）：點參考第一點',!!cur];if(ref&&ref.length===1)return['旋轉（參考）：點參考第二點',!!cur];
      if(np&&np.length===0)return['旋轉（兩點）：點新方向的第一點（例如欄的一端）',!!cur];if(np&&np.length===1)return['旋轉（兩點）：點新方向的第二點，參考方向會轉到和這兩點連線平行',!!cur];
      if(ref)return['旋轉（參考）：點新的方向點（參考方向會指向那一點），或按「兩點」點兩點讓它平行對齊，或輸入角度',true];
      return['旋轉：點一點決定角度，或在「角度」輸入旋轉度數（逆時針為正）；要對齊就按「參考」',true];},
    extraBtns(){if(!this.pts.length)return[];const B=[{t:ref?'參考中':'參考',c:'mode'+(ref?' on':''),f:()=>{if(ref){ref=null;refA=null;np=null;kp.setMode('la');}else{ref=[];kp.setMode('xy');}refreshCmd();}}];
      if(ref&&ref.length===2)B.push({t:np?'兩點中':'兩點',c:'mode'+(np?' on':''),f:()=>{np=np?null:[];kp.setMode(np?'xy':'a');refreshCmd();}});return B;},
    onPoint(p){if(!this.pts.length){this.pts.push(p);kp.setMode('la');return;}
      if(np){np.push(p);if(np.length===2){if(dist(np[0],np[1])<1e-6){np.pop();toast('兩點同一個位置，請點另一端',3000);refreshCmd();return;}apply(angTwo(np[0],np[1]));return;}refreshCmd();return;}
      if(ref&&ref.length<2){ref.push(p);if(ref.length===2){if(dist(ref[0],ref[1])<1e-6){ref.pop();toast('參考第二點和第一點同一個位置，量不出方向：請點這條邊的另一端',3500);refreshCmd();return;}// 2026-11-23
        refA=Math.atan2(ref[1][1]-ref[0][1],ref[1][0]-ref[0][0]);kp.setMode('a');}refreshCmd();return;}
      apply(angAt(this.pts[0],p));},
    base(){if(np&&np.length===1)return np[0];if(ref&&ref.length===1)return ref[0];return this.pts.length?this.pts[0]:null;},
    ok(){if(this.pts.length&&kp.num('A')!=null&&(!ref||ref.length===2))apply(angAt(this.pts[0],this.pts[0]));},
    preview(){if(!this.pts.length||!cur)return;const b=this.pts[0];
      if(ref&&ref.length<2){if(ref.length===1)previewPath([ref[0]],cur.p,false,true);return;}
      if(np){if(np.length===1&&dist(np[0],cur.p)>1e-6){const a=angTwo(np[0],cur.p);ctx.globalAlpha=.6;sel.forEach(e=>{const c=JSON.parse(JSON.stringify(e));rotEnt(c,b,a);drawTemp(c);});ctx.globalAlpha=1;previewPath([np[0]],cur.p,false,true);}return;}
      const a=angAt(b,cur.p);ctx.globalAlpha=.6;sel.forEach(e=>{const c=JSON.parse(JSON.stringify(e));rotEnt(c,b,a);drawTemp(c);});ctx.globalAlpha=1;previewPath([b],cur.p,false,true);}
  }));
},extra:{name:'rot',filter:ownOnly}});}
/* 縮放：點基準點（不動的點），輸入比例；「參考」＝點兩點量出原長度，再點（或輸入）新長度 */
function scaleEnt(e,b,k){xform(e,q=>[b[0]+(q[0]-b[0])*k,b[1]+(q[1]-b[1])*k],0);if(e.r)e.r*=k;if(e.h)e.h*=k;if(e.ls)e.ls*=k;}
function cmdScale(){return selectStage({title:'縮放',verb:'縮放',next(){
  const sel=[...selSet];let ref=null,refL=null,B=null;
  const facAt=p=>{if(refL){const D=kp.num('D');return D!=null?D/refL:dist(B,p)/refL;}const K=kp.num('K');return K!=null?K:null;};
  const apply=k=>{if(!(k>0)){toast('比例要大於 0');return;}snapshot();for(const e of sel)scaleEnt(e,B,k);saveDraw();endCmd();toast(`已縮放 ×${+k.toFixed(4)}`);};
  startCmdKeep(pointsCmd({name:'scale',init(){kp.setMode('xy');},
    hint(){if(!B)return[cur?'縮放：拖曳微調，再點一下或按 ＋ 確定基準點':'縮放：點基準點（縮放時這一點不動，圖塊通常點插入點）',!!cur];
      if(ref&&ref.length===0)return['縮放（參考）：點參考第一點',!!cur];if(ref&&ref.length===1)return['縮放（參考）：點參考第二點（量出原長度）',!!cur];
      if(ref)return[`縮放（參考）：原長 ${fmt(refL)}，點新長度的點，或在「距離」輸入新長度`,true];
      return['縮放：在「比例」輸入倍數（2＝放大兩倍、0.5＝一半）按 ✓；要用長度對就按「參考」',true];},
    extraBtns(){return B?[{t:ref?'參考中':'參考',c:'mode'+(ref?' on':''),f:()=>{if(ref){ref=null;refL=null;kp.setMode('k');}else{ref=[];kp.setMode('xy');}refreshCmd();}}]:[];},
    onPoint(p){if(!B){B=p;this.pts.push(p);kp.setMode('k');refreshCmd();return;}
      if(ref&&ref.length<2){ref.push(p);if(ref.length===2){refL=dist(ref[0],ref[1]);if(!(refL>1e-9)){toast('兩點太近');ref=[];refL=null;}else kp.setMode('d');}refreshCmd();return;}
      if(refL)apply(facAt(p));else toast('輸入比例按 ✓，或按「參考」用長度對');},
    base(){if(ref&&ref.length===1)return ref[0];return B;},
    ok(){if(!B)return;if(refL&&kp.num('D')!=null){apply(kp.num('D')/refL);return;}if(!refL&&kp.num('K')!=null)apply(kp.num('K'));},
    preview(){if(!B||!cur)return;if(ref&&ref.length<2){if(ref.length===1)previewPath([ref[0]],cur.p,false,true);return;}
      const k=facAt(cur.p);if(!(k>0))return;ctx.globalAlpha=.6;sel.forEach(e=>{const c=JSON.parse(JSON.stringify(e));scaleEnt(c,B,k);drawTemp(c);});ctx.globalAlpha=1;if(refL)previewPath([B],cur.p,false,true);}
  }));
},extra:{name:'scale',filter:ownOnly}});}
/* 插入圖塊：點一個圖塊當樣本（底圖或自己複製的都行，也可以先選好），再連續點插入點；角度可改 */
function blockIns(sel){for(const e of sel)if(e.gi)return e.gi;const e=sel[0];
  if(e&&e.imp&&e.g){const p=impIns(e);if(p)return p;}
  let b=[1e18,1e18,-1e18,-1e18];for(const x of sel){const r=entBox(x);if(r){b=[Math.min(b[0],r[0]),Math.min(b[1],r[1]),Math.max(b[2],r[2]),Math.max(b[3],r[3])];}}return[(b[0]+b[2])/2,(b[1]+b[3])/2];}
function cmdInsert(){return selectStage({title:'插入圖塊',verb:'當樣本',next(){
  const sel=[...selSet],ins=blockIns(sel);let ang=0,sc=1;
  const place=(p,draw)=>{const a=rad(ang),c=Math.cos(a),s=Math.sin(a),gm=new Map(),out=[];
    for(const e of sel){const k=draw?JSON.parse(JSON.stringify(e)):ownCopy(e,gm);
      xform(k,q=>{const x=(q[0]-ins[0])*sc,y=(q[1]-ins[1])*sc;return[p[0]+x*c-y*s,p[1]+x*s+y*c];},a);if(sc!==1){if(k.r)k.r*=sc;if(k.h)k.h*=sc;if(k.ls)k.ls*=sc;}if(!draw&&!k.og&&sel.length>1)k.og=gm.get('one')||(gm.set('one',newOg()),gm.get('one'));out.push(k);}return out;};
  let n=0;
  startCmdKeep(pointsCmd({name:'ins',carry(){return true;},init(){kp.setMode('xy');},
    extraBtns(){return[{t:`角度 ${ang}°`,c:'mode',f:()=>{const v=prompt('插入角度（度，逆時針為正）',String(ang));if(v!=null&&isFinite(+v)){ang=+v;refreshCmd();}}},
      {t:`比例 ${sc}`,c:'mode',f:()=>{const v=prompt('插入比例（1＝原大小，0.5＝一半）',String(sc));if(v!=null&&isFinite(+v)&&+v>0){sc=+v;refreshCmd();}}}];},
    hint(){return[`插入圖塊（${sel.length} 個物件${n?`，已插入 ${n} 個`:''}）：點插入點，可連續點；✓ 結束`,!!cur];},
    onPoint(p){this.pts.push(p);snapshot();st.ents.push(...place(p,false));n++;saveDraw();refreshCmd();schedule();},
    ok(){endCmd();if(n)toast(`已插入 ${n} 個圖塊`);},
    preview(){if(cur){ctx.globalAlpha=.9;for(const k of place(cur.p,true))drawTemp(k);ctx.globalAlpha=1;}}}));
  selSet=new Set(sel);
},extra:{name:'ins',group:true,filter:e=>!!(e.g||e.og)}});}
function rotEnt(e,b,a){const c=Math.cos(a),s=Math.sin(a);xform(e,q=>[b[0]+(q[0]-b[0])*c-(q[1]-b[1])*s,b[1]+(q[0]-b[0])*s+(q[1]-b[1])*c],a);}
function xform(e,f,da){
  delete e.bb;// 外框要重算，不然放大時會被當成在畫面外（不畫、點不到）
  switch(e.t){
    case'line':e.a=f(e.a);e.b=f(e.b);break;
    case'pline':case'ink':e.pts=e.pts.map(f);if(e.spl)e.spl.fit=e.spl.fit.map(f);if(e.av)e.av=e.av.map(f);break;
    case'circle':e.o=f(e.o);break;
    case'arc':e.o=f(e.o);e.a0+=da;e.a1+=da;break;
    case'text':e.p=f(e.p);e.rot=(e.rot||0)+da;delete e._sg;delete e.rc;break;
    case'dim':e.a=f(e.a);e.b=f(e.b);break;
    case'point':e.p=f(e.p);break;
    case'fill':e.rings=e.rings.map(r=>r.map(f));break;
  }
  if(e.gi)e.gi=f(e.gi);// 圖塊插入點跟著走
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
/* ---------- 含弧聚合線：av＝頂點、bu＝每段凸度（0＝直線），pts／kv 依它們展開 ---------- */
function bulgeArc(a,b,bu,out){// 從 a 到 b、凸度 bu 的弧，展開成點（不含 a）
  const th=4*Math.atan(bu),c=dist(a,b);if(Math.abs(bu)<1e-9||c<1e-12){out.push(b.slice());return;}
  const r=c/(2*Math.sin(Math.abs(th)/2)),mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,ux=(b[0]-a[0])/c,uy=(b[1]-a[1])/c,h=r*Math.cos(th/2)*Math.sign(bu);
  const o=[mx-uy*h,my+ux*h],a0=Math.atan2(a[1]-o[1],a[0]-o[0]),n=Math.max(8,Math.min(96,Math.ceil(Math.abs(th)*r*2)));
  for(let k=1;k<=n;k++){const t=a0+th*k/n;out.push(k===n?b.slice():[o[0]+r*Math.cos(t),o[1]+r*Math.sin(t)]);}}
function plBuild(e){// 依 av／bu 重新展開；全是直線就變回一般聚合線
  if(!e.av)return e;const V=e.av,n=V.length,B=e.bu||[];
  if(!B.some(b=>Math.abs(b||0)>1e-9)){e.pts=V.map(p=>p.slice());delete e.av;delete e.bu;delete e.kv;return e;}
  const P=[V[0].slice()],kv=[0];const segs=e.closed?n:n-1;
  for(let i=0;i<segs;i++){bulgeArc(V[i],V[(i+1)%n],B[i]||0,P);if(i+1<n)kv.push(P.length-1);}
  if(e.closed)P.pop();e.pts=P;e.kv=kv;delete e.bb;return e;}
function plVerts(e){return e.av||e.pts;}
function segMid(e,i){const V=plVerts(e),n=V.length,a=V[i],b=V[(i+1)%n],bu=(e.bu||[])[i]||0;if(!bu)return midp(a,b);
  const c=dist(a,b),s=c/2*bu,mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2,ux=(b[0]-a[0])/c,uy=(b[1]-a[1])/c;return[mx+uy*s,my-ux*s];}
function bulge3(a,m,b){// 過 a、m、b 三點、從 a 經 m 到 b 的弧的凸度（tan(圓心角/4)，逆時針為正）
  const ax=a[0],ay=a[1],bx=m[0],by=m[1],cx=b[0],cy=b[1],d=2*(ax*(by-cy)+bx*(cy-ay)+cx*(ay-by));if(Math.abs(d)<1e-12)return 0;
  const ox=((ax*ax+ay*ay)*(by-cy)+(bx*bx+by*by)*(cy-ay)+(cx*cx+cy*cy)*(ay-by))/d,oy=((ax*ax+ay*ay)*(cx-bx)+(bx*bx+by*by)*(ax-cx)+(cx*cx+cy*cy)*(bx-ax))/d;
  const A=Math.atan2(ay-oy,ax-ox),M=Math.atan2(by-oy,bx-ox),B=Math.atan2(cy-oy,cx-ox),T=2*Math.PI,ccw=(u,v)=>((v-u)%T+T)%T;
  const th=ccw(A,M)<=ccw(A,B)?ccw(A,B):-ccw(B,A);// m 在 a→b 的逆時針路徑上＝逆時針弧
  return Math.tan(th/4);}
function gripsOf(e){
  if(!e||e.imp)return[];const G=[];
  switch(e.t){
    case'line':G.push({p:e.a,k:'a'},{p:e.b,k:'b'},{p:midp(e.a,e.b),k:'move'});break;
    case'dim':G.push({p:e.a,k:'a'},{p:e.b,k:'b'});break;
    case'pline':if(e.spl)e.spl.fit.forEach((p,i)=>G.push({p,k:'fit',i}));else{const V=plVerts(e),n=V.length;V.forEach((p,i)=>G.push({p,k:'v',i}));for(let i=0;i<(e.closed?n:n-1);i++)G.push({p:segMid(e,i),k:'m',i});}break;
    case'circle':G.push({p:e.o,k:'move'});for(const[a,b]of[[1,0],[0,1],[-1,0],[0,-1]])G.push({p:[e.o[0]+a*e.r,e.o[1]+b*e.r],k:'rad'});break;
    case'arc':{const[p0,p1]=arcEnds(e),m=e.a0+sweepOf(e.a0,e.a1)/2;G.push({p:p0,k:'a0'},{p:p1,k:'a1'},{p:[e.o[0]+e.r*Math.cos(m),e.o[1]+e.r*Math.sin(m)],k:'rad'},{p:e.o,k:'move'});break;}
    case'point':case'text':G.push({p:e.p,k:'move'});break;
  }
  return G;
}
function hitGrip(sp){if(!selE||selE.imp||!ownShown(selE)||selSet.size>1)return null;let best=null,bd=22;for(const g of gripsOf(selE)){const q=toS(g.p),d=dist(q,sp);if(d<bd){bd=d;best=g;}}return best;}
function applyGrip(e,g,p){
  const c=JSON.parse(JSON.stringify(e)),b=g.p;
  switch(g.k){
    case'a':c.a=p.slice();break;case'b':c.b=p.slice();break;
    case'v':if(c.av){c.av[g.i]=p.slice();plBuild(c);}else c.pts[g.i]=p.slice();break;
    case'm':{const V=c.av||c.pts,n=V.length,dx=p[0]-b[0],dy=p[1]-b[1];for(const j of[g.i,(g.i+1)%n])V[j]=[V[j][0]+dx,V[j][1]+dy];if(c.av)plBuild(c);break;}// 整段平移
    case'arcm':{c.bu[g.i]=bulge3(c.av[g.i],p,c.av[(g.i+1)%c.av.length]);plBuild(c);break;}// 轉換為弧：拖中點定弧
    case'addv':{const V=c.av||c.pts;V.splice(g.i+1,0,p.slice());if(c.av){c.bu.splice(g.i+1,0,0);plBuild(c);}break;}// 加入頂點
    case'lineadd':return plBuild({t:'pline',pts:[c.a,p.slice(),c.b],closed:false,ly:c.ly,ci:c.ci,lt:c.lt,w:c.w});
    case'linearc':{const o={t:'pline',av:[c.a,c.b],bu:[bulge3(c.a,p,c.b)],closed:false,ly:c.ly,ci:c.ci,lt:c.lt,w:c.w};return plBuild(o);}
    case'fit':{c.spl.fit[g.i]=p.slice();const s=splinePts(c.spl.fit,!!c.closed);c.pts=s.pts;c.kv=s.kv;break;}
    case'rad':{const r=dist(c.o,p);if(r>1e-9)c.r=r;break;}
    case'a0':c.a0=angOf(c.o,p);break;case'a1':c.a1=angOf(c.o,p);break;
    case'move':{const dx=p[0]-b[0],dy=p[1]-b[1];xform(c,q=>[q[0]+dx,q[1]+dy],0);break;}
  }
  return c;
}
function drawGrips(e){for(const g of gripsOf(e)){const q=toS(g.p);ctx.fillStyle=g.k==='move'?'#22c55e':'#3b82f6';ctx.strokeStyle='#fff';ctx.lineWidth=1;
  if(g.k==='m'||(e.t==='line'&&g.k==='move')){// 段中點：沿著那一段的扁長橫條（像 CAD 的多功能夾點）
    const V=e.t==='line'?[e.a,e.b]:plVerts(e),a=toS(V[e.t==='line'?0:g.i]),b=toS(V[e.t==='line'?1:(g.i+1)%V.length]),an=Math.atan2(b[1]-a[1],b[0]-a[0]);
    ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(an);ctx.fillRect(-9,-3.5,18,7);ctx.strokeRect(-9,-3.5,18,7);ctx.restore();continue;}
  ctx.fillRect(q[0]-5,q[1]-5,10,10);ctx.strokeRect(q[0]-5,q[1]-5,10,10);}}
/** 點一下夾點：跳出選單（拉伸、加入頂點、移除頂點、轉換為弧／直線） */
function gripMenu(e,g,sp){const m=$('gripMenu');m.innerHTML='';const add=(t,f)=>{const b=document.createElement('button');b.textContent=t;b.onclick=()=>{hideGripMenu();f();};m.appendChild(b);};
  const go=(gg,base)=>{startCmd(gripCmd(e,gg,base));cur=null;refreshCmd();};
  if(e.t==='pline'&&!e.spl){const V=plVerts(e),n=V.length;
    if(g.k==='v'){add('拉伸',()=>go(g));if(lenFix(e,g))add('調整長度',()=>startCmd(cmdLength(e,g)));add('加入頂點',()=>go({p:g.p,k:'addv',i:g.i},g.p));
      if(n>2)add('移除頂點',()=>{const i=st.ents.indexOf(e);if(i<0)return;snapshot();const c=JSON.parse(JSON.stringify(e));const W=c.av||c.pts;W.splice(g.i,1);if(c.av){c.bu.splice(g.i,1);plBuild(c);}st.ents[i]=c;selE=c;saveDraw();setHint(baseHintText(),true);schedule();});}
    else if(g.k==='m'){const arc=!!((e.bu||[])[g.i]);add('拉伸',()=>go(g));add('加入頂點',()=>go({p:g.p,k:'addv',i:g.i},g.p));
      if(arc)add('轉換為直線',()=>{const i=st.ents.indexOf(e);if(i<0)return;snapshot();const c=JSON.parse(JSON.stringify(e));c.bu[g.i]=0;plBuild(c);st.ents[i]=c;selE=c;saveDraw();setHint(baseHintText(),true);schedule();});
      else add('轉換為弧',()=>{const c=e.av?e:Object.assign(e,{av:e.pts.map(p=>p.slice()),bu:e.pts.map(()=>0)});go({p:g.p,k:'arcm',i:g.i},g.p);});}}
  else if(e.t==='line'){if(g.k==='move'){add('移動',()=>go(g));add('加入頂點',()=>go({p:g.p,k:'lineadd'},g.p));add('轉換為弧',()=>go({p:g.p,k:'linearc'},g.p));}
    else{add('拉伸',()=>go(g));add('調整長度',()=>startCmd(cmdLength(e,g)));add('加入頂點',()=>go({p:g.p,k:'lineadd'},g.p));}}
  else{go(g);return;}
  m.style.display='flex';const r=cv.getBoundingClientRect();m.style.left=Math.min(r.left+sp[0]+12,window.innerWidth-170)+'px';m.style.top=Math.min(r.top+sp[1]+12,window.innerHeight-200)+'px';}
/* 調整長度（2026-11-23）：點直線端點或多段線頭尾的頂點 → 輸入新的總長（另一端不動，沿原方向伸縮）；打負數＝縮短多少 */
function lenFix(e,g){// 回傳不動的那一點；多段線只有頭尾頂點、而且那一段是直的才可以
  if(e.t==='line')return g.k==='a'?e.b:g.k==='b'?e.a:null;
  if(e.t==='pline'&&!e.spl&&!e.closed&&g.k==='v'){const V=plVerts(e),n=V.length;if(n<2)return null;
    if(g.i===0&&!((e.bu||[])[0]))return V[1];if(g.i===n-1&&!((e.bu||[])[n-2]))return V[n-2];}return null;}
function lenApply(e,g,L){const f=lenFix(e,g),m=g.p,d=dist(f,m);if(!(d>1e-12)||!(L>0))return null;const q=[f[0]+(m[0]-f[0])/d*L,f[1]+(m[1]-f[1])/d*L];
  const c=JSON.parse(JSON.stringify(e));delete c.bb;if(c.t==='line'){c[g.k]=q;return c;}
  if(c.av){c.av[g.i]=q;plBuild(c);}else c.pts[g.i]=q;return c;}
function cmdLength(e,g){const f=lenFix(e,g),L0=dist(f,g.p);return{kind:'dist',name:'length',keypad:'d',
  init(){kp.setMode('d');kp.clearFor('D');},
  hint(){return[`調整長度：目前 ${fmt(L0)} m。輸入新的總長按 ✓（另一端不動）；打負數＝縮短多少`,false];},
  newL(){const v=kp.num('D');if(v==null||isNaN(v))return null;return v<0?L0+v:v;},
  preview(){const L=this.newL();if(L>0){const c=lenApply(e,g,L);if(c){ctx.globalAlpha=.8;drawTemp(c);ctx.globalAlpha=1;}}},
  ok(){const L=this.newL();if(!(L>0)){toast('長度要大於 0');return;}const c=lenApply(e,g,L),i=st.ents.indexOf(e);if(!c||i<0){endCmd();return;}
    snapshot();st.ents[i]=c;saveDraw();endCmd();selE=c;setHint(baseHintText(),true);schedule();toast(`長度 ${fmt(L0)} → ${fmt(L)} m`);},
  cancel(){endCmd();selE=e;setHint(baseHintText(),true);schedule();return false;}
};}
function hideGripMenu(){const m=$('gripMenu');if(m)m.style.display='none';}
function gripCmd(e,g,base0){
  const ctr=(g.k==='rad'||g.k==='a0'||g.k==='a1')?e.o:null;
  return pointsCmd({name:'grip',
    hint(){const t={move:'移動：點新位置',m:'拉伸這一段：點新位置',addv:'加入頂點：點新頂點的位置',lineadd:'加入頂點：點新頂點的位置',arcm:'轉換為弧：點弧要經過的點',linearc:'轉換為弧：點弧要經過的點'}[g.k]||'夾點：點新位置';return[cur?'拖曳微調位置（可鎖點、輸入長度角度），點一下或按 ✓ 確定':t,!!cur];},
    base(){return ctr||g.p;},
    onPoint(p){const c=applyGrip(e,g,p);const i=st.ents.indexOf(e);
      if(i>=0&&(dist(p,g.p)>1e-12||g.k==='addv'||g.k==='lineadd')){snapshot();st.ents[i]=c;saveDraw();}
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
function cmdPen(){return{kind:'pen',name:'pen',hint(){return[eraser?'橡皮擦：在筆跡上劃過就整筆刪掉':'手寫：手指或觸控筆直接寫，雙指平移縮放；畫完停住不放＝變直線／弧／圓／多邊形',false];}};}
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
  const tiny=2.5/st.view.s;// 畫面上小於 2.5 像素的物件（圖例符號、小碎線）先不畫，放大才畫
  const list=(grid?queryImp(a[0]-m,a[1]-m,b[0]+m,b[1]+m):imp).filter(e=>shown(e)&&!e.nt&&!(e.t!=='point'&&e.bb&&e.bb[2]-e.bb[0]<tiny&&e.bb[3]-e.bb[1]<tiny));
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
// 從檔案管理員等 App 用「開啟檔案」選本 App 帶進來的圖；回傳是否有開
async function cadIntent(){if(!NATIVE)return false;let m;try{m=await CadCall('Cad','openIntent',{});}catch(err){busy(false);if(!/none/.test(err.message||''))toast('開檔失敗：'+(err.message||err),5000);return false;}
  closeSheet('fileSheet');await nativeLoaded(m);return true;}
window.cadIntent=cadIntent;
async function nativeOpen(){try{const m=await CadCall('Cad','open',{});await nativeLoaded(m);}catch(err){busy(false);if(!/cancel/i.test(err.message||''))toast('開檔失敗：'+(err.message||err),5000);}}
async function nativeLoaded(m){
  if(m.dxf){busy(false);await openDrawing(m.name,unb64(m.data),true);return;}
  busy(true,'載入文字…');
  const T=await (await fetch('/__native/texts.json?t='+Date.now())).json();
  const ents=T.map((t,ti)=>{const e={t:'text',imp:1,ti,p:t.p,h:t.h,rot:t.r,lines:String(t.t).split('\n'),ha:t.ha,y0:t.y0,ls:t.ls,wf:t.wf,vert:!!t.v,c:t.c,ly:t.l,font:t.f||'',big:t.b||''};if(t.g)e.g=t.g;e.bb=entBox(e);return e;});
  buildGrid(ents);saveDrawNow();
  imp=ents;grpIdx=null;insCache.clear();nCache.clear();nativeOn=true;nFit=m.fit;_nv='';
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
  if(areaFills.size&&areaTopo&&smallMarks&&smallMode==='area'){const T=areaTopo;ctx.save();ctx.globalAlpha=NATIVE?.35:.45;// 填色畫在最下層（原生模式底圖在下面，改用半透明）
    const path=(r,rev)=>{const n=r.length/2;for(let t=0;t<n;t++){const i=2*(rev?n-1-t:t),q=toS([r[i]+T.ox,r[i+1]+T.oy]);t?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);}ctx.closePath();};
    for(const[k,c]of areaFills){ctx.beginPath();path(T.F[k].ring,false);for(const j of areaHoles(k))path(T.F[j].ring,true);ctx.fillStyle=c;ctx.fill('nonzero');}ctx.restore();}
  const hl=st.bg==='white'?'rgba(0,140,200,.35)':'rgba(79,179,200,.45)';
  if(selE&&shown(selE)){const G=selBlock();if(G&&G.length>1){let n=0;for(const x of G){if(shown(x))drawEnt(x,hl,6,true);if(++n>5000)break;}}else drawEnt(selE,hl,6,true);
    if(G&&selIns){const q=toS(selIns),r=6;ctx.save();ctx.strokeStyle='#3d9bff';ctx.fillStyle='rgba(61,155,255,.35)';ctx.lineWidth=2;ctx.fillRect(q[0]-r,q[1]-r,2*r,2*r);ctx.strokeRect(q[0]-r,q[1]-r,2*r,2*r);// 插入點（藍色方塊，像 CAD 的夾點）
      ctx.beginPath();ctx.moveTo(q[0]-r-5,q[1]);ctx.lineTo(q[0]+r+5,q[1]);ctx.moveTo(q[0],q[1]-r-5);ctx.lineTo(q[0],q[1]+r+5);ctx.stroke();ctx.restore();}}
  if(!cmd&&selE&&!selE.imp&&selSet.size<=1)drawGrips(selE);
  {let n=0;for(const e of selSet){if(selSet.size>500&&!visible(e))continue;drawEnt(e,'rgba(255,170,40,.6)',6,true);if(++n>4000)break;}}
  if(boxNow){const[a,b]=boxNow,cr=b[0]<a[0];ctx.save();ctx.fillStyle=cr?'rgba(60,200,90,.12)':'rgba(70,130,255,.12)';ctx.strokeStyle=cr?'#3cc85a':'#4682ff';ctx.lineWidth=1.5;if(cr)ctx.setLineDash([6,4]);
    ctx.fillRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));ctx.strokeRect(Math.min(a[0],b[0]),Math.min(a[1],b[1]),Math.abs(b[0]-a[0]),Math.abs(b[1]-a[1]));ctx.restore();}
  drawBase();
  for(const e of st.ents)if(ownShown(e)&&visible(e))drawEnt(e,ownColor(e),undefined,false,ownLt(e));
  drawSmall();
  drawAddr();drawPark();drawSheets();drawEf();
  drawLoc();drawFind();
  if(cmd&&cmd.preview)cmd.preview();
  if(ink&&ink.pts.length>1)drawInk({pts:ink.pts,w:st.inkW/st.view.s},colorFor(aciHex(st.penCi)));
  bubble=null;
  if(cur&&cmd&&cmd.kind==='points'){
    const[x,y]=toS(cur.p);const c=st.bg==='white'?'#0a7d92':'#7fe3f5';
    ctx.strokeStyle=c;ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(x,y,13,0,TAU);ctx.moveTo(x-26,y);ctx.lineTo(x-7,y);ctx.moveTo(x+7,y);ctx.lineTo(x+26,y);ctx.moveTo(x,y-26);ctx.lineTo(x,y-7);ctx.moveTo(x,y+7);ctx.lineTo(x,y+26);ctx.stroke();
    ctx.fillStyle=c;ctx.fillRect(x-1.5,y-1.5,3,3);
    if(cur.snap)drawSnapMark(cur.snap);
  }
  const p=cur?cur.p:null;$('hintC').textContent=p?`X ${fmt(p[0])}\nY ${fmt(p[1])}`:'';
  placeSmallBar();
}
/** 區域檢查／小線段那條列：指令列、選取列開著時往下排，不要蓋住它們的按鈕 */
function placeSmallBar(){const b=$('smallBar');if(b.style.display==='none')return;let t=58;
  for(const id of['cmdbar','selBar']){const e=$(id);if(e&&getComputedStyle(e).display!=='none'){const r=e.getBoundingClientRect();if(r.height&&r.top<140)t=Math.max(t,r.bottom+6);}}
  if(b.style.top!==t+'px')b.style.top=t+'px';}

/* ---------- 指標事件 ---------- */
let g=null,ink=null;
// 手寫停住變形狀（2026-11-23，像 Samsung 筆記）：畫完停住不放約 0.5 秒，認成直線／弧／圓／多邊形（三角、矩形…）就換成乾淨的形狀；
// 認不出來就維持手寫。直線認出來後還可以繼續拖，終點跟著手指；其他形狀認出來後就固定
function inkHold(){if(!ink)return;clearTimeout(ink.ht);ink.ht=setTimeout(()=>{if(!ink||ink.shape||ink.len<24||ink.pts.length<3)return;
  const r=inkShape(ink.pts);if(!r)return;ink.shape=r.k;ink.straight=r.k==='line';ink.pts=r.pts;try{navigator.vibrate&&navigator.vibrate(15);}catch(_){}
  setHint({line:'直線（還可以拖終點）',arc:'弧線',circle:'圓',poly:'折線',gon:'多邊形',rect:'矩形'}[r.k]+'：放開就畫上去',false);schedule();},500);}
function fitCircle(P){let n=P.length,sx=0,sy=0;for(const p of P){sx+=p[0];sy+=p[1];}const mx=sx/n,my=sy/n;let Suu=0,Svv=0,Suv=0,Suuu=0,Svvv=0,Suvv=0,Svuu=0;
  for(const p of P){const u=p[0]-mx,v=p[1]-my;Suu+=u*u;Svv+=v*v;Suv+=u*v;Suuu+=u*u*u;Svvv+=v*v*v;Suvv+=u*v*v;Svuu+=v*u*u;}
  const det=Suu*Svv-Suv*Suv;if(Math.abs(det)<1e-12)return null;const b1=(Suuu+Suvv)/2,b2=(Svvv+Svuu)/2,uc=(b1*Svv-b2*Suv)/det,vc=(Suu*b2-Suv*b1)/det;
  const o=[uc+mx,vc+my],r=Math.sqrt(uc*uc+vc*vc+(Suu+Svv)/n);let e=0;for(const p of P){const d=dist(p,o)-r;e+=d*d;}return{o,r,rms:Math.sqrt(e/n)};}
function rdp(P,tol){if(P.length<3)return P.slice();const keep=new Uint8Array(P.length);keep[0]=keep[P.length-1]=1;const st2=[[0,P.length-1]];
  while(st2.length){const[i,j]=st2.pop();let md=0,mk=-1;const a=P[i],b=P[j],L=dist(a,b)||1e-12;for(let k=i+1;k<j;k++){const p=P[k];const d=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1]))/L;if(d>md){md=d;mk=k;}}
    if(md>tol){keep[mk]=1;st2.push([i,mk],[mk,j]);}}return P.filter((_,i)=>keep[i]);}
function inkShape(P){const n=P.length;if(n<5)return null;let L=0;for(let i=1;i<n;i++)L+=dist(P[i-1],P[i]);
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(const p of P){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  const D=Math.hypot(x1-x0,y1-y0)||1e-9,a=P[0],b=P[n-1],d=dist(a,b),closed=d<0.25*D&&L>1.8*D;
  const sweepOf=c=>{let s=0,pa=Math.atan2(P[0][1]-c.o[1],P[0][0]-c.o[0]);for(let i=1;i<n;i++){const q=Math.atan2(P[i][1]-c.o[1],P[i][0]-c.o[0]);let dd=q-pa;while(dd>Math.PI)dd-=2*Math.PI;while(dd<-Math.PI)dd+=2*Math.PI;s+=dd;pa=q;}return s;};
  const ring=(c,a0,sw,m)=>{const out=[];for(let i=0;i<=m;i++){const t=a0+sw*i/m;out.push([c.o[0]+c.r*Math.cos(t),c.o[1]+c.r*Math.sin(t)]);}return out;};
  if(!closed){let md=0;for(const p of P){const dd=Math.abs((b[0]-a[0])*(a[1]-p[1])-(a[0]-p[0])*(b[1]-a[1]))/(d||1e-12);if(dd>md)md=dd;}
    if(md<0.07*d)return{k:'line',pts:[a.slice(),b.slice()]};
    const c=fitCircle(P);if(c&&c.rms<0.05*c.r&&c.r<4*D){const sw=sweepOf(c),deg=Math.abs(sw)*180/Math.PI;
      if(deg>25&&deg<330){const a0=Math.atan2(a[1]-c.o[1],a[0]-c.o[0]);return{k:'arc',pts:ring(c,a0,sw,Math.max(12,Math.round(deg/4)))};}}
    const V=rdp(P,0.06*D);if(V.length>=3&&V.length<=8)return{k:'poly',pts:V.map(p=>p.slice())};return null;}
  const c=fitCircle(P);if(c&&c.rms<0.07*c.r&&Math.abs(sweepOf(c))>1.6*Math.PI){const a0=Math.atan2(a[1]-c.o[1],a[0]-c.o[0]);return{k:'circle',pts:ring(c,a0,2*Math.PI*Math.sign(sweepOf(c)||1),64)};}
  // 封閉多邊形：先找角點，頭尾黏在一起
  // 頭尾是同一點，直接簡化會找不到角：先從離起點最遠的點切成兩半各自簡化
  const Q=P.concat([P[0]]);let fk=0,fd=0;for(let i=1;i<Q.length-1;i++){const dd=dist(Q[0],Q[i]);if(dd>fd){fd=dd;fk=i;}}
  let V=rdp(Q.slice(0,fk+1),0.07*D).concat(rdp(Q.slice(fk),0.07*D).slice(1));V.pop();
  // 起點不一定在角上：起點兩側幾乎一直線就拿掉
  const colin=(p,q,r)=>Math.abs((q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]))/(dist(p,r)||1e-12)<0.07*D;
  while(V.length>3&&colin(V[V.length-1],V[0],V[1]))V.shift();
  for(let i=V.length-1;i>0&&V.length>3;i--)if(dist(V[i],V[i-1])<0.08*D)V.splice(i,1);
  if(V.length<3||V.length>8)return null;
  if(V.length===4){// 四個角都接近直角＝矩形，扶正成真的矩形
    const ang=i=>{const p=V[(i+3)%4],q=V[i],r=V[(i+1)%4],u=[p[0]-q[0],p[1]-q[1]],v=[r[0]-q[0],r[1]-q[1]];return Math.acos(Math.max(-1,Math.min(1,(u[0]*v[0]+u[1]*v[1])/((Math.hypot(...u)*Math.hypot(...v))||1))))*180/Math.PI;};
    if([0,1,2,3].every(i=>Math.abs(ang(i)-90)<15)){const th=Math.atan2(V[1][1]-V[0][1],V[1][0]-V[0][0]),ux=Math.cos(th),uy=Math.sin(th);let u0=Infinity,u1=-Infinity,v0=Infinity,v1=-Infinity;
      for(const p of V){const u=p[0]*ux+p[1]*uy,v=-p[0]*uy+p[1]*ux;u0=Math.min(u0,u);u1=Math.max(u1,u);v0=Math.min(v0,v);v1=Math.max(v1,v);}
      const W=(u,v)=>[u*ux-v*uy,u*uy+v*ux];const R=[W(u0,v0),W(u1,v0),W(u1,v1),W(u0,v1)];R.push(R[0].slice());return{k:'rect',pts:R};}}
  const G=V.map(p=>p.slice());G.push(G[0].slice());return{k:'gon',pts:G};}
// 帶著走（2026-11-20）：移動／複製定好基準點後、插入圖塊時，雙指縮放平移畫面，游標留在螢幕同一個位置，要複製的東西跟著畫面走（像 CAD），可以一路帶到很遠的地方
const carrying=()=>!!(cmd&&cmd.carry&&cmd.carry()&&cur);
function evPt(e){const r=cv.getBoundingClientRect();return[e.clientX-r.left,e.clientY-r.top];}
cv.addEventListener('pointerdown',e=>{
  e.preventDefault();try{cv.setPointerCapture(e.pointerId);}catch(_){}
  const sp=evPt(e);lastType=e.pointerType;ptrs.set(e.pointerId,sp);
  if(ptrs.size===2){const[a,b]=[...ptrs.values()],m=midp(a,b);if(ink){clearTimeout(ink.ht);ink=null;}boxNow=null;g={type:'pinch',d0:dist(a,b)||1,s0:st.view.s,w0:toW(m),cs:carrying()?toS(cur.raw):null};schedule();return;}
  if(ptrs.size>2)return;
  if(e.pointerType==='mouse'&&e.button!==0){g={type:'pan',last:sp};return;}
  if(cmd&&cmd.kind==='pen'){
    if(eraser){g={type:'erase',last:sp,snap:false};eraseAt(toW(sp),g);}
    else{ink={pts:[toW(sp)],last:sp,hp:sp,len:0};inkHold();g={type:'ink'};}
    schedule();return;
  }
  hideGripMenu();
  if(!cmd){const gr=hitGrip(sp);if(gr){const e0=selE;selE0=e0;gripHit0=gr;startCmd(gripCmd(e0,gr));cur={raw:gr.p.slice(),p:gr.p.slice(),snap:null};refreshCmd();g={type:'pending',start:sp,last:sp,moved:false,grip:true};return;}}
  if((!cmd||cmd.kind==='select')&&boxArm){g={type:'box',start:sp};boxNow=[sp,sp];return;}
  g={type:'pending',start:sp,last:sp,moved:false};
});
cv.addEventListener('pointermove',e=>{
  const sp=evPt(e);if(ptrs.has(e.pointerId))ptrs.set(e.pointerId,sp);
  if(!g)return;
  if(g.type==='pinch'){if(ptrs.size<2)return;const[a,b]=[...ptrs.values()],m=midp(a,b),s=clampS(g.s0*dist(a,b)/g.d0);st.view={s,ox:m[0]-g.w0[0]*s,oy:m[1]+g.w0[1]*s};if(g.cs){const w=toW(g.cs);cur={raw:w,p:w.slice(),snap:null};}schedule();return;}
  if(g.type==='ink'){if(dist(sp,ink.last)>=1.5){ink.len+=dist(sp,ink.last);if(ink.straight)ink.pts[1]=toW(sp);else if(!ink.shape)ink.pts.push(toW(sp));ink.last=sp;schedule();}
    if(dist(sp,ink.hp)>6){ink.hp=sp;inkHold();}return;}
  if(g.type==='erase'){eraseAt(toW(sp),g);return;}
  if(g.type==='box'){boxNow=[g.start,sp];schedule();return;}
  if(g.type==='pending'&&dist(sp,g.start)>8){g.moved=true;g.type=(cmd&&cmd.kind==='points'&&cur)?'cursor':'pan';}
  if(g.type==='pan'){const cs=carrying()?toS(cur.raw):null;st.view.ox+=sp[0]-g.last[0];st.view.oy+=sp[1]-g.last[1];g.last=sp;if(cs){const w=toW(cs);cur={raw:w,p:w.slice(),snap:null};}schedule();return;}
  if(g.type==='cursor'){const s=st.view.s,raw=[cur.raw[0]+(sp[0]-g.last[0])/s,cur.raw[1]-(sp[1]-g.last[1])/s];g.last=sp;setCursorRaw(raw);return;}
});
function endPtr(e,cancel){
  ptrs.delete(e.pointerId);if(!g)return;
  if(g.type==='pinch'){if(g.cs&&cur)setCursorRaw(cur.raw);if(ptrs.size<2)g=ptrs.size?{type:'dead'}:null;saveSettings();return;}
  if(g.type==='dead'){if(!ptrs.size)g=null;return;}
  const G=g;g=null;if(ink)clearTimeout(ink.ht);if(cancel){ink=null;boxNow=null;schedule();return;}
  if(G.type==='box'){const B=boxNow;boxNow=null;if(B&&dist(B[0],B[1])>8){boxSelect(B[0],B[1]);boxArm=false;}if(cmd)refreshCmd();else{const L=[...selSet];if(!selE&&L.length)selE=L[L.length-1];setHint(baseHintText(),!!selE);updSelBar();}schedule();return;}
  if(G.type==='ink'){const P=ink.pts,sh=ink.shape;ink=null;if(sh&&cmd&&cmd.hint)setHint(...[].concat(cmd.hint()));if(P.length===1)P.push([P[0][0]+0.3/st.view.s,P[0][1]]);snapshot();addEnt({t:'ink',pts:P,w:st.inkW/st.view.s,ci:st.penCi});saveDraw();schedule();return;}
  if(G.type==='erase'){if(G.did)saveDraw();return;}
  if(G.type==='pan'){saveSettings();return;}
  if(G.type==='pending'&&!G.moved){if(G.grip){const c0=cmd&&cmd.name==='grip'?cmd:null;const e0=selE0,g0=gripHit0;endCmd();selE=e0;setHint(baseHintText(),true);if(e0&&g0)gripMenu(e0,g0,G.start);schedule();return;}onTap(G.start);}
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
  if(!cmd&&efPick){efTap(w);return;}
  if(!cmd&&sheetPick){sheetTap(w);return;}
  if(!cmd&&fillMode&&areaTopo&&smallMode==='area'&&smallMarks){const T=areaTopo,k=T.locate(w[0]-T.ox,w[1]-T.oy);
    if(k<0){toast('那裡不在任何封閉區裡');return;}if(areaFills.has(k))areaFills.delete(k);else{const P=['#ff5a5a','#4fb3ff','#5ad16a','#ffb13d','#c77dff','#3de0d0'];areaFills.set(k,P[fillCi++%P.length]);}
    const f=T.F[k];setHint(`區域面積 ${f.area<10?f.area.toFixed(2):f.area.toFixed(1)} m²　地物：${[...f.kinds.keys()].map(x=>x==='H'?'房屋':x).join('、')||'（無）'}`,true);schedule();return;}
  // 區域檢查標記優先（30px 內有標記就處理標記），沒有標記才看門牌點
  if(!cmd&&smallMarks){const V=smallVis();let bi=-1,bd=30;for(const m of V){const q=toS(m.p);const d=Math.hypot(q[0]-sp[0],q[1]-sp[1]);if(d<bd){bd=d;bi=smallMarks.indexOf(m);}}
    if(bi<0&&(parkTap(sp)||addrTap(sp)))return;
    if(bi>=0){if(bi===smallIdx&&!smallHl){smallHl=true;schedule();return;}if(bi===smallIdx){okToggle();const m2=smallMarks[bi];setHint((m2.ok?'已確認：':'取消確認：')+(m2.msg||''),true);return;}smallIdx=bi;smallHl=true;updSmallBar();const m=smallMarks[bi];setHint(m.msg||`${m.len.toFixed(2)}m　${m.l}`,true);schedule();return;}}
  if(!cmd&&!smallMarks&&(parkTap(sp)||addrTap(sp)))return;
  if(!cmd&&smallMarks&&smallHl&&smallIdx>=0){smallHl=false;schedule();setHint(baseHintText(),false);return;}// 點旁邊空白處：收起目前這筆的範圍標示
  if(!cmd){const e=pickEnt(w,st.lockBase?ownOnly:null);if(e){const grp=grpOf(e);
      if(selSet.has(e)){for(const x of grp)selSet.delete(x);if(!selE||grp.includes(selE)){const L=[...selSet];selE=L.length?L[L.length-1]:null;}}
      else{for(const x of grp)selSet.add(x);selE=e;}}
    setHint(baseHintText(),!!selE,selSet.size===1&&selE&&!selE.imp&&selE.t==='text'?{t:'編輯文字',f:()=>openTextEdit(selE)}:null);updSelBar();schedule();return;}
  switch(cmd.kind){
    case'points':
      if(cmd.live){setCursorRaw(w);return;}
      if(cur){commitPoint();if(!cmd||cmd.kind!=='points')return;}
      setCursorRaw(w);return;
    case'select':{const f0=cmd.filter,e=pickEnt(w,st.lockBase?(x=>!x.imp&&(!f0||f0(x))):f0);if(e){const grp=(!e.imp&&e.og)?ownGroup(e):(cmd.group&&e.g)?groupOf(e):[e];const on=!selSet.has(e);for(const x of grp)on?selSet.add(x):selSet.delete(x);}refreshCmd();return;}
    case'pickObj':{const e=pickEnt(w,cmd.filter);if(e)cmd.onPick(e,w);else toast('那裡沒有物件');refreshCmd();return;}
    case'side':cmd.onSide(w);return;
    default:selE=pickEnt(w);setHint(baseHintText(),!!selE);schedule();
  }
}

/* ---------- 底部工具列 ---------- */
const TABS=[
  ['sel','選取',()=>{endCmd();closePanel();}],
  ['draw','繪製',[['pline','多段線',cmdPline],['line','直線',cmdLine],['circle','圓',cmdCircle],['arc','弧',cmdArc],['spline','雲形線',cmdSpline],['polygon','多邊形',cmdPolygon],['text','文字',cmdText],['dim','標註',cmdDim],['ins','插入圖塊',cmdInsert]]],
  ['edit','編輯',[['move','移動',()=>cmdMove(false)],['copy','複製',()=>cmdMove(true)],['rot','旋轉',cmdRotate],['scale','縮放',cmdScale],['offset','偏移',cmdOffset],['trim','修剪',()=>cmdTrimExt(false)],['extend','延伸',()=>cmdTrimExt(true)],['join','接合',cmdJoin],['brk','打斷',cmdBreak],['del','刪除',cmdDelete],['chly','改圖層',cmdChLayer],['cclip','複製到剪貼簿',cmdCopyClip],['pclip','原座標貼上',cmdPasteOrig]]],
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
for(const[id,k]of[['tFile','file'],['tUndo','undo'],['tRedo','redo'],['tFit','fit'],['tLoc','loc'],['tFind','find'],['tSnap','snap'],['tOrtho','ortho'],['tSet','set']])$(id).innerHTML=svg(k);
$('tUndo').onclick=()=>{doUndo();updateUI();};$('tRedo').onclick=()=>{doRedo();updateUI();};$('tFit').onclick=zoomFit;
/* ---------- 定位：藍點＋精度圈；按一下開始並跳到目前位置，已經在畫面中央再按一下就關掉 ---------- */
let locW=null,locP=null,locGo=false;
function locCenter(){if(!locP)return;st.view.ox=W/2-locP.x*st.view.s;st.view.oy=H/2+locP.y*st.view.s;schedule();saveSettings();}
function locStop(){if(locW!==null)navigator.geolocation.clearWatch(locW);locW=null;locP=null;locGo=false;$('tLoc').classList.remove('on');schedule();}
$('tLoc').onclick=()=>{
  if(!navigator.geolocation){toast('這個裝置不支援定位');return;}
  if(locW!==null){if(locP){const q=toS([locP.x,locP.y]);if(Math.hypot(q[0]-W/2,q[1]-H/2)>40){locCenter();return;}}locStop();toast('定位已關閉');return;}
  locGo=true;$('tLoc').classList.add('on');toast('定位中…（空曠處約 3～10m，巷弄、室內會飄）',3000);
  locW=navigator.geolocation.watchPosition(p=>{const[x,y]=ll2tm(p.coords.latitude,p.coords.longitude,st.lon0||121);locP={x,y,acc:p.coords.accuracy||0};
      if(locGo){locGo=false;if(st.view.s<2)st.view.s=clampS(2);locCenter();}else schedule();},
    err=>{toast('定位失敗：'+(err.code===1?'沒有定位權限':err.code===2?'找不到位置（GPS 有開嗎？）':'逾時'),5000);locStop();},
    {enableHighAccuracy:true,maximumAge:2000,timeout:30000});};
function drawLoc(){if(!locP)return;const q=toS([locP.x,locP.y]),r=locP.acc*st.view.s;ctx.save();
  if(r>8){ctx.beginPath();ctx.arc(q[0],q[1],r,0,TAU);ctx.fillStyle='rgba(66,133,244,.15)';ctx.fill();ctx.strokeStyle='rgba(66,133,244,.6)';ctx.lineWidth=1;ctx.stroke();}
  ctx.beginPath();ctx.arc(q[0],q[1],8,0,TAU);ctx.fillStyle='#4285f4';ctx.fill();ctx.strokeStyle='#fff';ctx.lineWidth=2.5;ctx.stroke();ctx.restore();}
/* ---------- 收費停車場（2026-11-23）：新北市路外公共停車場資訊（CSV／JSON，TW97X／TW97Y），只畫有收費的 ---------- */
let park=null,parkName='',parkShow=localStorage.getItem('parkShow')!=='0';
function parkParse(txt){txt=txt.replace(/^﻿/,'').trim();let rows=[];
  if(/^[\[{]/.test(txt)){let j=JSON.parse(txt);if(!Array.isArray(j))j=j.result&&j.result.records||j.records||j.data||Object.values(j).find(Array.isArray)||[];rows=j;}
  else{// 整份一起切：引號裡可能有換行（例：水湳洞停車場的 SUMMARY）
    const R=[];let row=[],c='',q=false;for(let i=0;i<txt.length;i++){const ch=txt[i];
      if(q){if(ch==='"'){if(txt[i+1]==='"'){c+='"';i++;}else q=false;}else c+=ch;}
      else if(ch==='"')q=true;else if(ch===','){row.push(c);c='';}else if(ch==='\n'||ch==='\r'){if(ch==='\r'&&txt[i+1]==='\n')i++;row.push(c);c='';R.push(row);row=[];}else c+=ch;}
    row.push(c);R.push(row);const H=R[0].map(h=>h.trim());
    for(let i=1;i<R.length;i++){if(R[i].length<2)continue;const o={};H.forEach((h,k)=>o[h]=R[i][k]);rows.push(o);}}
  const g=(o,re)=>{for(const k in o)if(re.test(k))return String(o[k]??'').trim();return '';};
  const out=[];for(const o of rows){let x=parseFloat(g(o,/^(tw97x|x_?3826|px|x|e|e_?坐標|e_?座標|東坐標|東座標)$/i)),y=parseFloat(g(o,/^(tw97y|y_?3826|py|y|n|n_?坐標|n_?座標|北坐標|北座標)$/i));// E＝6 碼、N＝7 碼（2026-11-23）
    if(x>2000000&&y>100000&&y<500000)[x,y]=[y,x];// 原始資料有幾筆 X、Y 填反
    if(!(x>100000&&x<500000&&y>2000000))continue;
    const fee=g(o,/^payex$|費率|收費/i).replace(/;+\s*$/,'').replace(/;/g,'；');
    // 分類：可以臨停（計時／計次）＝paid；只有月租＝month；寫免費、沒有收錢的＝free；沒寫費率＝unk
    const kind=!fee.replace(/[；\s]/g,'')?'unk':/計時|計次|元\s*\/\s*(時|次)|每小時|每次/.test(fee)?'paid':/月租/.test(fee)?'month':/免費/.test(fee)&&!/\d+\s*元/.test(fee)?'free':'paid';
    out.push({x,y,n:g(o,/^name$|名稱/i),ad:g(o,/^address$|地址/i),fee,tm:g(o,/^servicetime$|時間/i),car:g(o,/^totalcar$|汽車/i),mo:g(o,/^totalmotor$|機車/i),ty:g(o,/^summary$/i).replace(/\s+/g,''),kind,free:kind==='free'||kind==='month'});}
  return out;}
const parkPaid=()=>park?park.filter(p=>!p.free):[];
function parkUpd(){const P=parkPaid();const c=k=>park.filter(p=>p.kind===k).length;$('parkInfo').textContent=park?`${parkName}：${park.length} 個停車場；畫出可以臨停（計時／計次）的 ${c('paid')} 個、沒寫費率的 ${c('unk')} 個（灰色）；不畫只有月租的 ${c('month')} 個、免費的 ${c('free')} 個`:'還沒載入';$('parkShow').textContent='停車場：'+(parkShow?'開':'關');
  $('parkBtn').classList.toggle('on',!!(park&&parkShow));findIdx=null;}
(async()=>{const v=await idbFileGet('park');if(v&&v.rows){park=v.rows;parkName=v.name||'停車場資料';}parkUpd();schedule();})();
$('parkBtn').onclick=()=>{closeSheet('layerSheet');parkUpd();openSheet('parkSheet');};
$('parkLoad').onclick=()=>{$('parkFile').value='';$('parkFile').click();};
$('parkFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;busy(true,'讀取停車場資料…');
  try{const r=parkParse(addrText(new Uint8Array(await f.arrayBuffer())));if(!r.length){toast('這份資料看不到停車場的 TWD97 坐標（TW97X／TW97Y）',5000);return;}
    park=r;parkName=f.name;parkShow=true;localStorage.setItem('parkShow','1');idbFile('park',{name:f.name,rows:r});parkUpd();schedule();toast(`停車場資料已載入：${r.length} 個，圖上畫 ${parkPaid().length} 個（只有月租、免費的不畫）`,4000);}
  catch(err){toast('讀不懂這份資料：'+(err.message||err),5000);}finally{busy(false);}};
// Support 資料夾或其他地方讀到的停車場 CSV（2026-11-23）：認得出停車場坐標欄才收，回傳筆數
function parkTry(name,txt){let r;try{r=parkParse(txt);}catch(_){return 0;}if(!r.length||!r.some(p=>p.n&&p.fee!==undefined))return 0;
  park=r;parkName=name;idbFile('park',{name,rows:r});parkUpd();schedule();return r.length;}
$('parkClear').onclick=()=>{if(park&&confirm(`要移除「${parkName}」嗎？`)){park=null;parkName='';idbFile('park',null);parkUpd();schedule();}};
$('parkShow').onclick=()=>{parkShow=!parkShow;localStorage.setItem('parkShow',parkShow?'1':'0');parkUpd();schedule();};
function drawPark(){if(!parkShow||!park)return;const a=toW([0,H]),b=toW([W,0]),m=40/st.view.s,sz=Math.max(9,Math.min(16,st.view.s*4));ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';
  const lab=W/st.view.s<600;for(const p of park){if(p.free||p.x<a[0]-m||p.x>b[0]+m||p.y<a[1]-m||p.y>b[1]+m)continue;const q=toS([p.x,p.y]);
    ctx.fillStyle=p.kind==='unk'?'#7a8591':'#1e6fd9';ctx.strokeStyle='#fff';ctx.lineWidth=1.5;ctx.beginPath();ctx.rect(q[0]-sz,q[1]-sz,sz*2,sz*2);ctx.fill();ctx.stroke();
    ctx.fillStyle='#fff';ctx.font=`bold ${Math.round(sz*1.4)}px sans-serif`;ctx.fillText('P',q[0],q[1]+1);
    if(lab&&p.n){ctx.font='12px sans-serif';ctx.lineWidth=3;ctx.strokeStyle='rgba(0,0,0,.75)';ctx.strokeText(p.n,q[0],q[1]+sz+10);ctx.fillStyle='#8cc4ff';ctx.fillText(p.n,q[0],q[1]+sz+10);}}
  ctx.restore();}
function parkTap(sp){if(!parkShow||!park)return false;let bp=null,bd=22;for(const p of park){if(p.free)continue;const q=toS([p.x,p.y]),d=Math.hypot(q[0]-sp[0],q[1]-sp[1]);if(d<bd){bd=d;bp=p;}}
  if(!bp)return false;const v=[bp.n,bp.ad,bp.ty,(bp.car&&bp.car!=='0'?`汽車 ${bp.car} 格`:'')+(bp.mo&&bp.mo!=='0'?`${bp.car&&bp.car!=='0'?'、':''}機車 ${bp.mo} 格`:''),bp.fee||'費率未提供',bp.tm].filter(Boolean);setHint(v.join('｜'),true);return true;}
/* ---------- 搜尋（2026-11-20）：圖上的文字（底圖＋自己寫的）、門牌資料；結果依離畫面中心的距離排，點一筆跳過去 ---------- */
const findNorm=s=>String(s||'').replace(/[０-９Ａ-Ｚａ-ｚ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/\s|\\P/g,'').replace(/臺/g,'台').toUpperCase();
let findIdx=null,findMark=null;
function findTexts(){const key=imp.length+'|'+st.ents.length+'|'+drawKey;if(findIdx&&findIdx.key===key)return findIdx;
  const T=[],one=new Map();// one：單一個中文字的文字（河名常一個字一個字放），依字分組
  const add=e=>{if(e.t!=='text'||!e.lines||!e.p)return;const raw=e.lines.join(' '),n=findNorm(raw);if(!n)return;const o={n,raw,x:e.p[0],y:e.p[1],h:e.h||1,ly:e.ly||'',e};T.push(o);
    if(n.length===1&&/[㐀-鿿]/.test(n)){let l=one.get(n);if(!l)one.set(n,l=[]);l.push(o);}};
  for(const e of imp)add(e);for(const e of st.ents)add(e);
  return findIdx={key,T,one};}
// 一個字一個字分開放的（例如河名「大」「漢」「溪」，字和字常隔 60～200m）：從第一個字開始，同圖層、6 倍字高或 300m 內找最近的下一個字
function findChain(q,I){const out=[],cs=[...q];if(cs.length<2||!cs.every(c=>I.one.has(c)))return out;
  for(const a of I.one.get(cs[0])){const ch=[a];let ok=true;
    for(let k=1;k<cs.length&&ok;k++){const p=ch[ch.length-1];let best=null,bd=Infinity;
      for(const b of I.one.get(cs[k])){if(b.ly!==p.ly||ch.includes(b))continue;const d=Math.hypot(b.x-p.x,b.y-p.y);if(d<bd&&d<=Math.max(6*Math.max(p.h,b.h),300)){bd=d;best=b;}}
      if(best)ch.push(best);else ok=false;}
    if(ok){const x=ch.reduce((t,o)=>t+o.x,0)/ch.length,y=ch.reduce((t,o)=>t+o.y,0)/ch.length;out.push({raw:cs.join(''),x,y,ly:a.ly,e:a.e,kind:'分開的字',ex:1});}}
  return out;}
function findAddr(q){const out=[];if(!addrRaw)return out;
  for(const raw of addrRaw)addrEach(raw,(a,c)=>{const g=i=>i<0?'':addrFw(a[i]);
    let la=g(c.L).replace(/巷$/,''),al=g(c.B).replace(/弄$/,''),no=g(c.N).replace(/號.*$/,'');
    const full=(g(c.S)||g(c.A))+(la?la+'巷':'')+(al?al+'弄':'')+(no?no+'號':'');const n=findNorm(full);if(!n.includes(q))return;
    const x=+a[c.X],y=+a[c.Y];if(!isFinite(x)||!isFinite(y)||!x||!y)return;out.push({raw:full,x,y,ly:'',kind:'門牌',ex:n===q||n.endsWith(q)?1:0});});
  return out;}
function findRun(){const q=findNorm($('findIn').value);const list=$('findList'),box=$('findRes');
  if(!q){box.style.display='none';$('findInfo').textContent='請輸入要找的字';return;}
  const I=findTexts();let R=[];
  for(const o of I.T)if(o.n.includes(q))R.push({raw:o.raw,x:o.x,y:o.y,ly:o.ly,e:o.e,kind:o.e.imp?'':'我寫的',ex:o.n===q?1:0});
  R=R.concat(findChain(q,I),findAddr(q));for(const p of parkPaid()){const n=findNorm(p.n+p.ad);if(n.includes(q))R.push({raw:p.n+(p.ad?'（'+p.ad+'）':''),x:p.x,y:p.y,ly:'',kind:'收費停車場',ex:findNorm(p.n)===q?1:0});}
  const c=toW([W/2,H/2]);for(const r of R)r.d=Math.hypot(r.x-c[0],r.y-c[1]);
  R.sort((a,b)=>(b.ex-a.ex)||(a.d-b.d));const N=R.length,MAX=300;R=R.slice(0,MAX);
  $('findInfo').textContent=N?`找到 ${N} 筆`+(N>MAX?`（只列最近的 ${MAX} 筆）`:'')+'，依離畫面中心近到遠排（完全相同的排前面）':'找不到'+(addrRaw?'':'（門牌要先在「圖層 → 門牌」載入資料才找得到）');
  const esc=t=>String(t).replace(/[&<>"]/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[ch]));
  const dist=d=>d<1000?Math.round(d)+' m':(d/1000).toFixed(d<10000?1:0)+' km';
  list.innerHTML=R.map((r,i)=>{const off=r.e&&!shown(r.e);const sub=[r.kind,r.ly,'距 '+dist(r.d),off?'圖層關閉中':''].filter(Boolean).join(' · ');
    return `<button data-i="${i}">${esc(r.raw)}<span class="fs">${esc(sub)}</span></button>`;}).join('');
  box.style.display=N?'':'none';
  list.querySelectorAll('button').forEach(b=>b.onclick=()=>findGo(R[+b.dataset.i]));}
function findGo(r){findMark={x:r.x,y:r.y,t:r.raw};closeSheet('findSheet');
  const vw=W/st.view.s;if(vw>400||vw<20)st.view.s=clampS(W/150);// 太遠或太近就調到畫面寬約 150m
  st.view.ox=W/2-r.x*st.view.s;st.view.oy=H/2+r.y*st.view.s;schedule();saveSettings();
  if(r.e&&!shown(r.e))toast(`這個文字的圖層「${r.ly}」目前關閉，圖上只看得到搜尋標記`,4000);}
function drawFind(){if(!findMark)return;const q=toS([findMark.x,findMark.y]);ctx.save();
  ctx.strokeStyle='#ff3b30';ctx.lineWidth=3;ctx.beginPath();ctx.arc(q[0],q[1],22,0,TAU);ctx.stroke();
  ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(q[0]-34,q[1]);ctx.lineTo(q[0]-14,q[1]);ctx.moveTo(q[0]+14,q[1]);ctx.lineTo(q[0]+34,q[1]);ctx.moveTo(q[0],q[1]-34);ctx.lineTo(q[0],q[1]-14);ctx.moveTo(q[0],q[1]+14);ctx.lineTo(q[0],q[1]+34);ctx.stroke();
  ctx.restore();}
$('tFind').onclick=()=>{$('findClr').style.display=findMark?'':'none';openSheet('findSheet');setTimeout(()=>{const i=$('findIn');i.focus();i.select();},250);};
// 搜尋欄清空：結果清單也收掉（2026-11-22）
const findReset=()=>{$('findRes').style.display='none';$('findList').innerHTML='';$('findInfo').textContent='找圖上的文字（底圖和自己寫的）；載入門牌資料後也找門牌。空白、全形數字、臺／台不分。';};
$('findIn').oninput=()=>{if(!$('findIn').value.trim())findReset();};
$('findX').onclick=()=>{$('findIn').value='';findReset();$('findIn').focus();};
$('findClr').onclick=()=>{findMark=null;closeSheet('findSheet');schedule();};
$('findGo').onclick=findRun;$('findIn').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();$('findIn').blur();findRun();}};
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
/** 線型選單顯示「編號　說明」：133　鐵欄（說明取 .lin 定義第一段文字，後面的圖樣示意不要） */
// App（原生）讀圖時線型說明是空的（2026-11-23）：沒說明就查這張表（圖例總表 5 碼＋測試圖裡的 3 碼等線型名稱）
const LT_NAMES={"101":"連續線","106":"建築中房屋、高架鐵路、行人地下道、高架捷運、地下捷運","109":"田埂、助曲線、排水溝","111":"小徑、建築中道路","122":"高架道路","132":"板牆","133":"鐵欄","134":"水泥欄","135":"鐵絲網","136":"生籬","137":"竹垣","145":"地類界","161":"行道樹","174":"擋土牆","175":"駁坎","176":"土坎","191":"溝渠","201":"水泥牆","202":"磚牆","212":"鬆土路面","215":"行人路橋","90112":"圖廓註記","90121":"方格線","90122":"方格線註記","90211":"圖名","90212":"圖號","90221":"比例尺","90222":"高程起算註記","90223":"地圖投影坐標系","90225":"等高線間隔","90231":"圖幅接合表","90232":"行政界線略圖","90310":"中文地名","90320":"英文地名","90330":"中文註記","90340":"英文註記","90350":"等高線註記","90360":"標高點註記","90400":"圖例說明","90900":"其他","91210":"衛星控制點","91220":"精密導線點","91230":"導線點","91250":"自由測站點","91310":"一等水準點","91320":"水準點","91410":"中心樁","91420":"界樁","91430":"副樁","91440":"虛樁","91450":"測量基點樁","91920":"航測控制點","91930":"衛星定位點","92200":"省、直轄市等界","92201":"省、直轄市名","92300":"縣、省轄市、直轄市區等界","92301":"縣、省轄市、","92400":"鄉、鎮、縣轄市","92401":"鄉、鎮、縣轄市","92500":"村里界","92501":"村里名","93110":"永久性房屋","93111":"無牆壁房屋","93112":"樓層註記","93120":"建築中房屋","93130":"臨時性房屋","93212":"板牆","93214":"施工圍離","93230":"柵欄","93240":"網","93250":"籬","93260":"圍","93261":"舊城垣","93270":"門","93312":"中央政府公署","93314":"直轄市政府","93315":"縣政府","93318":"村里辦公室","93323":"直轄市議會","93324":"縣議會","93331":"大使、領事館","93332":"外國駐華辦事處","93340":"軍事機關","93411":"大專院校","93412":"中學","93413":"小學","93414":"職訓中心","93415":"幼稚園","93416":"駕訓班","93421":"圖書館","93422":"博物館","93423":"資料及陳列館","93424":"文化中心","93425":"社教館","93431":"紀念堂(館)","93432":"孔廟","93433":"忠烈祠","93434":"紀念墓園","93441":"紀念碑","93442":"紀念塔","93443":"紀念像","93444":"牌坊","93445":"牌樓","93451":"天文台","93452":"氣象台、測候所","93453":"水文觀測站","93454":"絕對重力站","93455":"衛星定位追蹤站","93460":"古蹟","93491":"升旗台","93511":"醫院","93512":"衛生所","93513":"孤兒院","93514":"養老院","93521":"殯儀館","93522":"火葬場","93523":"墓地","93524":"獨立墓","93531":"市場","93532":"地下街","93540":"戲院","93541":"劇院","93542":"音樂廳","93543":"活動中心","93544":"風景名勝區","93545":"公園","93546":"遊樂場(園)","93547":"露天劇場、音樂台","93548":"動物園","93549":"植物園","93551":"體育館","93552":"體育場","93553":"游泳池","93554":"海水浴場","93555":"運動場","93556":"球場","93560":"郵筒","93561":"郵局","93562":"電信公司營服處","93563":"電力公司服務處","93564":"電話亭","93571":"警察局、分駐所","93572":"監獄、看守所","93573":"消防隊","93574":"消防栓","93575":"防空洞","93576":"法院","93581":"銀行","93582":"證券公司","93583":"信託公司","93584":"信用合作社","93591":"塔","93592":"亭","93593":"水塔","93594":"水井","93595":"噴泉","93596":"油塔","93611":"教堂","93612":"寺廟","93613":"回教寺","93614":"宗祠","93691":"土地廟","93692":"大佛像","93711":"工廠","93712":"發電廠","93713":"造船廠","93714":"自來水廠","93721":"變電所","93722":"船塢","93723":"倉庫","93724":"油庫","93725":"抽水站","93726":"堆積場","93731":"污水處理廠","93732":"垃圾處理場","93733":"焚化爐","93734":"鍋爐","93741":"礦場","93742":"溫泉區","93744":"材料場","93781":"瓦斯整壓箱","93782":"高架配電台","93791":"輸送管","93792":"煙囪","93793":"油井、瓦斯井","93794":"油槽","93795":"瓦斯槽","93796":"儲存槽","93797":"變壓箱座","93798":"磚瓦窯","93799":"獨立標","93811":"雷達站","93812":"微波中繼站","93813":"衛星資料接收站","93814":"無線電台","93815":"天線","93821":"廣播電台","93822":"電視台","93823":"攝影棚","93891":"廣告架","93901":"界標","93902":"廢墟","93903":"靶場","93904":"階梯","93905":"碉堡","93906":"瞭望台(塔)","93907":"司令台","93908":"金爐","93909":"電信箱座","93911":"大樓","93912":"飯店(旅館)","93913":"公司","93914":"百貨公司","93915":"眷村","93916":"社區","93917":"其他","94111":"鐵路","94112":"高速鐵路","94113":"輕便鐵路","94121":"火車站","94122":"轉車台","94123":"平交道柵欄","94124":"平交道警視燈","94125":"鐵路機車廠","94211":"國道","94212":"省道","94213":"市區道路","94214":"縣道","94215":"鄉鎮道","94216":"小徑","94217":"小徑","94218":"人行道","94219":"區塊內道路","94221":"汽車站","94222":"交流道","94223":"立體交叉道","94224":"中央分隔島","94225":"行人陸橋","94226":"行地下道","94227":"收費站","94228":"加油站","94232":"交通號誌","94233":"交通標誌","94311":"地面捷運","94321":"捷運車站","94322":"捷運機車廠","94411":"鐵路隧道","94412":"公路隧道","94421":"鐵路橋","94422":"公路橋","94423":"車行吊橋","94424":"人行吊橋","94425":"浮橋","94426":"便橋","94427":"小橋","94431":"箱涵","94432":"管涵","94433":"擋土牆","94434":"路堤","94435":"路塹","94436":"駁坎","94511":"陸上機場","94512":"水上機場","94521":"跑道","94522":"滑行道","94523":"停機坪","94524":"停機棚","94525":"修護廠","94526":"航站大廈","94527":"管制塔台","94611":"商港","94612":"漁港","94613":"工礦港","94614":"軍港","94621":"港管所(哨)","94622":"防波堤","94623":"燈塔","94624":"港燈","94625":"錨地","94627":"沉船浮","94628":"消波塊","94901":"纜車線","94902":"高架索道","94903":"國道編號","94904":"省道編號","94905":"縣市道編號","94906":"鄉鎮道編號","94911":"方向指引","95111":"江、河、溪","95112":"時令河","95113":"乾河","95114":"小河","95115":"運河","95116":"溝、渠","95117":"溝、渠","95118":"暗溝","95121":"引水槽","95122":"渡口","95124":"水壩","95126":"水閘","95127":"攔河堰、攔沙壩","95128":"渡船碼頭","95132":"混凝土塊護岸","95133":"蛇籠","95134":"土坎","95141":"石磯","95142":"沙洲","95152":"瀑布","95153":"河川流向","95211":"湖泊","95212":"池塘","95213":"乾池","95214":"沼澤","95215":"濕地","95216":"水庫","95217":"蓄水池","95221":"湖濱碼頭","95222":"水涯線","95311":"崖岸","95312":"海岸線","95321":"海濱碼頭","95322":"水岸拋角石","95412":"珊瑚礁","95421":"泥底地質","95422":"沙底地質","95423":"礫底地質","95424":"岩床","95905":"島嶼","96111":"輸送線(高壓線)","96112":"配電線(電力線)","96120":"電信線路","96210":"水管","96220":"油管","96230":"瓦斯管","96911":"高壓線塔","96912":"電信塔","96914":"路燈","96920":"人孔","96921":"電力人孔","96922":"電信人孔","96923":"排水人孔","96924":"軍訊人孔","97111":"獨立樹","97121":"防風林","97122":"行道樹","97131":"針葉樹","97132":"闊葉樹","97133":"針、闊葉混合林","97134":"灌木林","97135":"竹林","97210":"草地","97220":"細草地","97311":"水田","97312":"蓮田","97321":"旱作地","97322":"蔗田","97331":"果園","97332":"茶園","97333":"菜園","97334":"花圃","97335":"苗圃","97411":"魚池","97412":"魚塭","97413":"養蚵場","97421":"牧場","97430":"鹽田","97912":"荒地","97913":"空地","97921":"地類界","97922":"田埂","98111":"計曲線","98112":"首曲線","98113":"間曲線","98114":"助曲線","98121":"一般標高點","98122":"特殊標高點","98211":"凹地","98212":"土墩、台地、小丘","98213":"斷崖","98221":"雨裂","98222":"流土","98223":"崩土","98224":"惡地","98231":"獨立岩","98232":"散岩","98233":"露岩","98240":"沙丘","9320500":"籬","9390009":"候車亭","93110H":"房屋斜線","93130H":"房屋斜線","93210a":"水泥牆","93210b":"磚牆","93210c":"石牆","93210d":"板牆","93210e":"土牆","93210f":"鋼鐵牆","93220a":"竹垣","93230a":"水泥欄","93230b":"鐵欄","93230c":"木欄","93240a":"鐵絲網","93250a":"生籬","93260a":"壘石圍","93712a":"水力發電廠","93712b":"火力發電廠","94110a":"單線鐵路","94110b":"雙線鐵路","94110c":"高架鐵路","94110d":"地下鐵路","94110e":"建築中鐵路","94200a":"產業道路","94200b":"高架道路","94200c":"鬆路面道路","94200d":"建築中道路","94226a":"行人地下道出入口","94229a":"平面停車場","94229b":"立體停車場","94229c":"停車場出入口","94300a":"高架捷運","94300b":"地下捷運","94300c":"建築中捷運","94420a":"鐵橋","94420b":"鋼筋混凝土橋","94420c":"磚石橋","94420d":"木橋","95131a":"土堤","95131b":"石堤","95131c":"混凝土堤","95131d":"小土堤","95411a":"泥濱","95411b":"沙濱","95411c":"礫濱","95411d":"岩濱","96913a":"電力桿","96913b":"電信桿","97330a":"香蕉園","97330b":"鳳梨園","97330c":"檳榔園","94214C":"縣道鬆面道路","95131C":"混凝土堤","94213A":"省道高架道路","94310A":"高架捷運","94215A":"縣道高架道路","94211A":"國道高架道路"};
function ltLabel(n){if(n==='CONTINUOUS')return'CONTINUOUS　連續線';const l=lts.find(x=>x.name===n);let d=l&&l.desc?l.desc.trim().split(/\s+/)[0]:'';if(!d||d===n)d=LT_NAMES[n]||LT_NAMES[String(n).toUpperCase()]||'';return d&&d!==n?n+'　'+d:n;}
/** 先點選物件再到圖層列表點別的圖層：自己畫的物件改到那層（底圖不改） */
function lyMoveSel(L){const S=selSet.size?[...selSet]:selE?[selE]:[];if(!S.length)return;const own=S.filter(e=>!e.imp&&st.ents.includes(e)&&e.ly!==L.name);
  if(!own.length){if(S.some(e=>e.imp))toast('底圖的物件不改圖層（先複製成自己的）');return;}snapshot();
  for(const e of own){const old=layerOf(e.ly);if(e.ci!=null&&old&&e.ci===old.ci)delete e.ci;e.ly=L.name;}// 原本跟著舊圖層顏色的，改跟新圖層
  saveDraw();schedule();const sk=S.length-own.length;toast(`已改 ${own.length} 個到圖層「${L.name}」`+(sk?`（略過 ${sk} 個）`:''));}
// 我的圖層可以收起來（2026-11-23）：收起時只留目前圖層那一行
let myLyFold=localStorage.getItem('myLyFold')==='1';
function myLyFoldUpd(){$('myLayers').classList.toggle('fold',myLyFold);$('myLyAdd').style.display=myLyFold?'none':'';
  $('myLyHead').textContent=myLyFold?`▸ 我的圖層（${st.layers.length} 個，只顯示目前圖層；點這裡展開）`:'▾ 我的圖層（點圓圈設為目前圖層；點這裡收起）';}
$('myLyHead').onclick=()=>{myLyFold=!myLyFold;localStorage.setItem('myLyFold',myLyFold?'1':'0');myLyFoldUpd();};
function fillLayerSheet(){
  try{updOldBtn();updSmallBar();}catch(_){}
  const box=$('myLayers');box.innerHTML='';myLyFoldUpd();
  for(const L of st.layers){// 一個圖層一行：圓圈｜色塊（顏色號）｜名稱＋線型小字｜燈泡｜⋯（改名、刪除）
    const r=document.createElement('div');r.className='lyr lyr1'+(st.cur===L.name?' cur':'');r.dataset.ly=L.name;
    const rb=document.createElement('input');rb.type='radio';rb.name='curly';rb.checked=st.cur===L.name;
    const setCur=()=>{rb.checked=true;st.cur=L.name;box.querySelectorAll('.lyr1').forEach(x=>x.classList.toggle('cur',x===r));saveSettings();lyMoveSel(L);};rb.onchange=setCur;
    const chip=document.createElement('button');chip.className='chip ci1';chip.style.background=aciHex(L.ci);chip.title='選顏色';
    const paintC=()=>{chip.style.background=aciHex(L.ci);const h=aciHex(L.ci).replace('#','');const lum=parseInt(h.slice(0,2),16)*.3+parseInt(h.slice(2,4),16)*.59+parseInt(h.slice(4,6),16)*.11;
      chip.style.color=lum>140?'#111':'#fff';chip.textContent=aciName(L.ci);chip.classList.toggle('long',chip.textContent.length>2);};paintC();
    chip.onclick=()=>openAci(L.ci,v=>{L.ci=v;paintC();saveSettings();schedule();});
    const mid=document.createElement('div');mid.className='lymid';
    const nm=document.createElement('div');nm.className='lynm';nm.textContent=L.name;nm.onclick=setCur;
    const sel=document.createElement('select');sel.className='ltmini';sel.title='線型';
    const names=['CONTINUOUS',...lts.map(l=>l.name).filter(n=>n!=='CONTINUOUS')];for(const n of names){const o=document.createElement('option');o.value=n;o.textContent=ltLabel(n);sel.appendChild(o);}
    sel.value=L.lt||'CONTINUOUS';sel.onchange=()=>{L.lt=sel.value;saveSettings();schedule();};mid.append(nm,sel);
    const eye=document.createElement('button');eye.className='lyb';eye.innerHTML=lyIcon('bulb',L.on!==false);eye.onclick=()=>{L.on=L.on===false;eye.innerHTML=lyIcon('bulb',L.on!==false);saveSettings();schedule();};
    const more=document.createElement('button');more.className='lyb';more.textContent='⋯';
    const act=document.createElement('div');act.className='lyact';act.style.display='none';
    const ren=document.createElement('button');ren.textContent='改名';ren.onclick=()=>{const v=(prompt('圖層名稱',L.name)||'').trim();if(!v||v===L.name)return;
      if(st.layers.some(x=>x!==L&&x.name===v)){toast('名稱重複');return;}for(const e of st.ents)if(e.ly===L.name)e.ly=v;if(st.cur===L.name)st.cur=v;L.name=v;saveSettings();saveDraw();fillLayerSheet();};
    const del=document.createElement('button');del.className='danger';del.textContent='刪除這個圖層';del.onclick=()=>{if(st.layers.length<=1){toast('至少要留一個圖層');return;}if(st.ents.some(e=>e.ly===L.name)){toast('這層還有東西，先刪掉或改圖層');return;}
      if(!confirm(`刪除圖層「${L.name}」？`))return;st.layers=st.layers.filter(x=>x!==L);if(st.cur===L.name)st.cur=st.layers[0].name;saveSettings();fillLayerSheet();};
    act.append(ren,del);more.onclick=()=>{act.style.display=act.style.display==='none'?'flex':'none';};
    r.append(rb,chip,mid,eye,more);box.append(r,act);
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
$('lyAll').onclick=()=>{offLy.clear();syncHid();fillLayerSheet();schedule();};// 全開不解除凍結
$('lyNone').onclick=()=>{impLayers.forEach(l=>offLy.add(l.name));syncHid();fillLayerSheet();schedule();};

/* ---------- 點到物件時：關閉這個圖層／到圖層列表找它 ---------- */
function updSelBar(){const b=$('selBar');if(!b)return;const show=!cmd;b.style.display=show?'flex':'none';if(!show)return;
  $('selBox').textContent=boxArm?'框選：拖曳畫框':'框選';$('selBox').classList.toggle('on',boxArm);$('selLock').textContent=st.lockBase?'底圖已鎖':'鎖定底圖';$('selLock').classList.toggle('on',!!st.lockBase);
  $('selClr').style.display=selSet.size?'':'none';$('selClr').textContent=`清除（${selCount()}）`;$('selOff').style.display=$('selList').style.display=selE?'':'none';}
function lockBaseToggle(){st.lockBase=!st.lockBase;saveSettings();if(st.lockBase){let n=0;for(const e of [...selSet])if(e.imp){selSet.delete(e);n++;}if(selE&&selE.imp)selE=[...selSet].pop()||null;}
  toast(st.lockBase?'底圖已鎖定：選取、框選只會選到自己畫的':'底圖解鎖：可以選到底圖',2200);updSelBar();schedule();}
$('selLock').onclick=lockBaseToggle;
$('selBox').onclick=()=>{boxArm=!boxArm;updSelBar();if(boxArm)toast('拖曳畫框：往右拉選框內的、往左拉碰到就選（累加）',2500);};
$('selClr').onclick=()=>{selSet.clear();selE=null;boxArm=false;setHint(baseHintText(),false);updSelBar();schedule();};
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
const smallMaxV=()=>{const v=+st.smallMax;return v>0?v:1;};const areaTolV=()=>{const v=+st.areaTol;return v>0?v:0.05;};const edgeTolV=()=>{const v=+st.edgeTol;return v>0?v:0.001;};// 舊圖：a 開頭；新圖：數字開頭（不含 0 圖層）
const oldLayers=()=>impLayers.filter(l=>OLD_RE.test(l.name)).map(l=>l.name);
const newLayers=()=>impLayers.filter(l=>NEW_RE.test(l.name)&&l.name!=='0'&&!CONTOUR_RE.test(l.name)).map(l=>l.name);
const qLayers=()=>impLayers.filter(l=>Q_RE.test(l.name)).map(l=>l.name);
function oldOff(){const o=oldLayers();return o.length&&o.every(n=>offLy.has(n));}
function updOldBtn(){const b=$('lyOld');if(!b)return;if(document.activeElement!==$('smallMax'))$('smallMax').value=smallMaxV();const o=oldLayers();b.disabled=!o.length;b.textContent=o.length?(oldOff()?'開舊圖':'關舊圖'):'無舊圖';
  if(document.activeElement!==$('areaTol'))$('areaTol').value=areaTolV();
  if($('edgeTol')&&document.activeElement!==$('edgeTol'))$('edgeTol').value=edgeTolV();
  $('lyArea').textContent=smallMarks&&smallMode==='area'?'取消區域檢查標記':'區域檢查';}
$('lyOld').onclick=()=>{const o=oldLayers();if(!o.length)return;if(oldOff())o.forEach(n=>offLy.delete(n));else o.forEach(n=>offLy.add(n));syncHid();fillLayerSheet();schedule();};
let smallMarks=null,smallIdx=-1,smallKey='',smallMode='small',smallHl=true;// smallHl：目前這筆的範圍、缺口、指示線要不要畫（點旁邊空白處就收起來）
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
  smallKey=impName;smallMode='small';setTimeout(()=>{okApply();updSmallBar();schedule();},0);smallMarks=L.map(m=>({p:[m.x,m.y],len:m.len,l:m.l}));smallIdx=-1;
  toast(smallMarks.length?`找到 ${smallMarks.length} 段小於 ${smallMaxV()}m 的線（新圖層和 Q 圖層、不含等高線、沒跟同圖層線相接的）`:'沒有找到小線段',3000);
  if(!smallMarks.length)smallMarks=null;updSmallBar();schedule();
}
const smallVis=()=>smallMarks?smallMarks.filter(markVis):[];
function updSmallBar(){const b=$('smallBar');if(!smallMarks){b.style.display='none';return;}b.style.display='flex';$('smList').style.display=smallMode==='area'?'':'none';$('smFill').style.display=smallMode==='area'&&areaTopo?'':'none';if(smallMode!=='area'||!smallMarks){fillMode=false;$('smFill').classList.remove('on');}
  const V=smallVis(),m=smallMarks[smallIdx],nok=V.filter(x=>x.ok).length;$('smOk').classList.toggle('on',!!(m&&m.ok));$('smallTxt').textContent=(m&&m.ok?'✓ ':'')+(m&&markVis(m)?(m.msg?`${V.indexOf(m)+1}/${V.length}　${m.msg}`:`${V.indexOf(m)+1}/${V.length}　${m.len.toFixed(2)}m　${m.l}`):(smallMode==='area'?`區域問題 ${V.length} 處`:smallMode==='rname'?`路名問題 ${V.length} 處`:`小線段 ${V.length} 段`)+(nok?`（已確認 ${nok}）`:''));}
/* 已確認：看過的標記點一下變灰色，記在這台裝置上（每張圖分開） */
const okKey=m=>(m.type||'s')+'|'+m.p[0].toFixed(1)+'|'+m.p[1].toFixed(1);
function okLoad(){try{return new Set(JSON.parse(localStorage.getItem('markOk:'+impName)||'[]'));}catch(_){return new Set();}}
function okSave(){if(!smallMarks)return;const S=okLoad();for(const m of smallMarks){const k=okKey(m);if(m.ok)S.add(k);else S.delete(k);}try{localStorage.setItem('markOk:'+impName,JSON.stringify([...S]));}catch(_){}}
function okApply(){const S=okLoad();if(smallMarks)for(const m of smallMarks)m.ok=S.has(okKey(m));}
function okToggle(){const m=smallMarks&&smallMarks[smallIdx];if(!m)return;m.ok=!m.ok;okSave();updSmallBar();schedule();}
function smallGo(d){const V=smallVis();if(!V.length){toast(smallMode==='area'?'開著的分類裡沒有問題':smallMode==='rname'?'沒有路名問題':'目前開著的圖層沒有小線段');return;}
  let k=V.indexOf(smallMarks[smallIdx]);k=k<0?(d>=0?0:V.length-1):(k+d+V.length)%V.length;const m=V[k];smallIdx=smallMarks.indexOf(m);smallHl=true;
  const v=st.view;v.s=Math.max(v.s,40);v.ox=W/2-m.p[0]*v.s;v.oy=H/2+m.p[1]*v.s;updSmallBar();schedule();}
function drawSmall(){updSelBar();if(smallMarks&&smallKey!==impName){smallMarks=null;updSmallBar();}if(!smallMarks)return;const cm=smallHl?smallMarks[smallIdx]:null;ctx.save();
  for(const m of smallMarks){if(!markVis(m))continue;const q=toS(m.p);if(q[0]<-30||q[1]<-30||q[0]>W+30||q[1]>H+30)continue;const on=m===cm;
    ctx.strokeStyle=on?'#ffea00':m.ok?'#6b6f76':(AREA_COL[m.type]||'#ff2bd6');ctx.lineWidth=on?3.5:m.ok?1.5:2.2;ctx.beginPath();ctx.arc(q[0],q[1],on?24:17,0,TAU);ctx.stroke();}
  if(cm&&cm.path){const o=cm.o,P=cm.path;ctx.strokeStyle='#2f6bff';ctx.lineWidth=5;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
    for(let i=0;i<P.length;i+=2){const q=toS([o[0]+P[i],o[1]+P[i+1]]);if(i)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1]);}ctx.stroke();
    const a=toS([o[0]+P[P.length-4],o[1]+P[P.length-3]]),b=toS([o[0]+P[P.length-2],o[1]+P[P.length-1]]),an=Math.atan2(b[1]-a[1],b[0]-a[0]);ctx.fillStyle='#2f6bff';ctx.beginPath();ctx.moveTo(b[0],b[1]);ctx.lineTo(b[0]-14*Math.cos(an-0.45),b[1]-14*Math.sin(an-0.45));ctx.lineTo(b[0]-14*Math.cos(an+0.45),b[1]-14*Math.sin(an+0.45));ctx.closePath();ctx.fill();}
  if(cm&&cm.gap){const o=cm.o,G=cm.gap;ctx.strokeStyle='#ff2020';ctx.fillStyle='#ff2020';ctx.lineWidth=4;
    for(let i=0;i+3<G.length;i+=4){const a=toS([o[0]+G[i],o[1]+G[i+1]]),b=toS([o[0]+G[i+2],o[1]+G[i+3]]);ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.stroke();for(const q of[a,b]){ctx.beginPath();ctx.arc(q[0],q[1],4,0,TAU);ctx.fill();}}}
  if(cm&&cm.ring){const r=cm.ring,o=cm.o;ctx.strokeStyle='#ffea00';ctx.lineWidth=2.5;ctx.setLineDash([8,5]);ctx.beginPath();
    for(let i=0;i<r.length;i+=2){const q=toS([o[0]+r[i],o[1]+r[i+1]]);if(i)ctx.lineTo(q[0],q[1]);else ctx.moveTo(q[0],q[1]);}ctx.closePath();ctx.stroke();ctx.setLineDash([]);}
  ctx.restore();}
$('edgeTol').onchange=()=>{const v=parseFloat($('edgeTol').value);if(v>0&&v<=1){st.edgeTol=v;saveSettings();}else $('edgeTol').value=edgeTolV();};
$('areaTol').onchange=()=>{const v=parseFloat($('areaTol').value);if(v>0&&v<=1){st.areaTol=v;saveSettings();}else $('areaTol').value=areaTolV();};
function updChk(){const b=$('newOnly');if(b){b.textContent='只看新圖相關：'+(st.newOnly?'開':'關');b.classList.toggle('on',!!st.newOnly);}
  if(document.activeElement!==$('newDist'))$('newDist').value=newDistV();}
function chkApply(){if(smallMarks&&smallMarks[smallIdx]&&!markVis(smallMarks[smallIdx]))smallIdx=-1;if(smallMode==='area'){updSmallBar();schedule();}}
$('chkBtn').onclick=()=>{updOldBtn();updChk();updSheetInfo();openSheet('chkSheet');};
$('newOnly').onclick=()=>{st.newOnly=!st.newOnly;saveSettings();updChk();chkApply();
  if(smallMode==='area'&&smallMarks){const h=smallMarks.filter(newHid).length;toast(st.newOnly?`藏了 ${h} 處離新圖超過 ${newDistV()}m 的舊圖問題`:'全部顯示',2000);}};
$('newDist').onchange=()=>{const v=parseFloat($('newDist').value);if(v>=0&&v<=100){st.newDist=v;saveSettings();chkApply();}else $('newDist').value=newDistV();};
$('smallMax').onchange=()=>{const v=parseFloat($('smallMax').value);if(v>0){st.smallMax=v;saveSettings();updOldBtn();}else $('smallMax').value=smallMaxV();};
/* ---------- 區域檢查：一區兩種屬性、房屋未封閉、增建註記位置、空白區（規則在 js/area.js） ---------- */
const AREA_COL={oddly:'#ff9ecf',edge:'#3dff7a',road:'#b46bff',mix:'#ff2bd6',open:'#ff5a1f',addout:'#ffa31a',empty:'#2bd9ff',roadfree:'#c08bff',lbfree:'#ff7ad9',stray:'#ff4fa0',small:'#ffe14d',onroad:'#ff8a3d',elevcross:'#9f7bff',veg:'#7ddc4a',floor:'#ff3b3b',floorout:'#ff8f8f',openadd:'#ff9a5a',flooradd:'#ff6f91',addside:'#ffd21a',addline:'#e0b000',facility:'#00d0a0',rname:'#4da3ff',rmiss:'#8ab4ff'};
// 區域檢查結果分類（副圖層列表）：順序＝列表順序＝◀▶ 順序
const AREA_CAT=[['edge','接邊不合／中斷'],
  ['open','房屋未封閉'],['floor','永久樓層衝突'],['floorout','樓層註記在房屋外'],['openadd','關掉增建後房屋缺口（5 碼）'],['flooradd','關掉增建後樓層衝突（5 碼）'],['addside','增建線找不到增建註記'],['addline','增建線越界／自由端點'],['addout','增建註記位置'],
  ['mix','一區兩種屬性'],['road','和道路／人行道相通'],['onroad','圖例在土路上'],['stray','圖例插入點跑到範圍外'],['roadfree','道路線懸空'],['lbfree','地類界懸空'],['elevcross','平面道路跨越高架'],['facility','大型設施沒有範圍線'],['veg','範圍線用錯圖層（植被圖層）'],['oddly','範圍線用錯圖層（註記、圖例圖層）'],['small',`新圖小線段`],['rname','路名和附近門牌對不上'],['rmiss','門牌有、圖上沒寫路名'],['empty','區域內無地物']];
let areaOff=new Set();try{areaOff=new Set(JSON.parse(localStorage.getItem('areaOff')||'[]'));}catch(_){}
const newDistV=()=>{const v=+st.newDist;return v>=0&&st.newDist!==''&&st.newDist!=null?v:20;};
const newHid=m=>!!(st.newOnly&&smallMode==='area'&&m.nd!=null&&m.nd>newDistV()+1e-9);// 只看新圖相關：離新圖太遠的舊圖問題藏起來
const markVis=m=>!hidLy.has(m.l)&&!(m.type&&smallMode==='area'&&areaOff.has(m.type))&&!newHid(m);
function fillAreaSheet(){const box=$('areaCats');box.innerHTML='';if(!smallMarks||smallMode!=='area'){$('areaInfo').textContent='還沒有區域檢查結果';return;}
  const n=new Map(),ok=new Map();let nh=0;for(const m of smallMarks){if(newHid(m)){nh++;continue;}n.set(m.type,(n.get(m.type)||0)+1);if(m.ok)ok.set(m.type,(ok.get(m.type)||0)+1);}
  for(const[t,nm]of AREA_CAT){const c=n.get(t)||0;const r=document.createElement('div');r.className='lyr';r.style.gridTemplateColumns='22px 1fr 36px 34px 34px';
    const chip=document.createElement('div');chip.className='chip';chip.style.background=AREA_COL[t]||'#ff2bd6';
    const lab=document.createElement('span');lab.style.flex='1';lab.textContent=`${nm}　${c}`+(ok.get(t)?`（已確認 ${ok.get(t)}）`:'');if(!c)lab.style.opacity='.45';
    const eye=document.createElement('button');eye.className='lyb';eye.innerHTML=lyIcon('bulb',!areaOff.has(t));
    eye.onclick=()=>{if(areaOff.has(t))areaOff.delete(t);else areaOff.add(t);try{localStorage.setItem('areaOff',JSON.stringify([...areaOff]));}catch(_){}eye.innerHTML=lyIcon('bulb',!areaOff.has(t));if(smallMarks[smallIdx]&&!markVis(smallMarks[smallIdx]))smallIdx=-1;$('areaInfo').textContent=`共 ${smallMarks.length} 處，開著的 ${smallVis().length} 處。`;updSmallBar();schedule();};
    const go=document.createElement('button');go.textContent='▶';go.title='跳到這類第一筆';go.onclick=()=>{const m=smallMarks.find(q=>q.type===t);if(!m)return;if(areaOff.has(t)){areaOff.delete(t);eye.innerHTML=lyIcon('bulb',true);}closeSheet('areaSheet');smallIdx=smallMarks.indexOf(m);smallGo(0);};
    const un=document.createElement('button');un.textContent='↺';un.title='這一類的已確認全部取消';un.disabled=!ok.get(t);
    un.onclick=()=>{if(!confirm(`「${nm}」已確認的 ${ok.get(t)} 處全部取消確認？`))return;for(const m of smallMarks)if(m.type===t)m.ok=false;okSave();updSmallBar();schedule();fillAreaSheet();};
    r.append(chip,lab,eye,go,un);box.appendChild(r);}
  const V=smallVis();$('areaInfo').textContent=`共 ${smallMarks.length} 處，開著的 ${V.length} 處。`+(nh?`只看新圖相關（${newDistV()}m）藏了 ${nh} 處。`:'');}
$('smFill').onclick=()=>{if(!areaTopo){toast('先跑區域檢查才能填色');return;}fillMode=!fillMode;$('smFill').classList.toggle('on',fillMode);
  toast(fillMode?'填色：點一個區域上色，再點一次取消（再按 🪣 結束）':'結束填色',2000);};
$('smList').onclick=()=>{if(smallMode!=='area')return;fillAreaSheet();openSheet('areaSheet');};
function areaAll(on){if(on)areaOff.clear();else for(const[t]of AREA_CAT)areaOff.add(t);try{localStorage.setItem('areaOff',JSON.stringify([...areaOff]));}catch(_){}
  if(smallMarks&&smallMarks[smallIdx]&&!markVis(smallMarks[smallIdx]))smallIdx=-1;fillAreaSheet();updSmallBar();schedule();}
$('areaAllOn').onclick=()=>areaAll(true);$('areaAllOff').onclick=()=>areaAll(false);
/** 植被圖層的散線：封閉 4 點以上或長度超過 3m＝拿植被圖層畫範圍（錯）；更短的是炸開的圖例碎片 */
/** 植被圖層的散線：先收集，areaCheck 再看它是不是當範圍線用（零長度的直接忽略：多半是同一點點兩次留下的） */
function areaVeg(a,ly,ox,oy,points,veg,kind,lnm){let L=0;for(let i=2;i<a.length;i+=2)L+=Math.hypot(a[i]-a[i-2],a[i+1]-a[i-1]);if(L<0.1)return;// 10cm 以下：夾點編輯或連點兩次留下的殘段，不當圖例也不當範圍線
  veg.push({p:a,nm:lnm(ly),k:kind(ly),L});}
function areaCollect(){/* 讀出區域檢查要用的線和點 */
  // 只寫編號的圖層（97321）借同編號、有名稱的那層（97321_旱作地）來判斷
  const full=new Map();for(const l of impLayers){const m=/^(a?\d+[A-Za-z]*)[_\s]*(\S.*)$/.exec(l.name);if(m&&/[^\x00-\x7f]/.test(m[2]))full.set(m[1].toUpperCase(),l.name);}
  const fullName=n=>/^a?\d+[A-Za-z]*$/.test(n)?(full.get(n.toUpperCase())||n):n;
  const roles=new Map(),kindOf=new Map(),par=new Map(),withHouse=new Set(),bigKinds=new Set(),veg=[],ditch=[],odd=[];
  const fd=x=>{while(par.has(x)&&par.get(x)!==x)x=par.get(x);return x;},un=(a,b)=>{if(!par.has(a))par.set(a,a);if(!par.has(b))par.set(b,b);const A=fd(a),B=fd(b);if(A!==B)par.set(B,A);};
  for(const l of impLayers){const fn=fullName(l.name),r=areaRole(fn);if(!r)continue;roles.set(l.name,r);
    if(r.a){const nm=areaKindName(fn);un('n:'+nm,'c:'+r.a);}}// 新舊圖：同編號或同名稱都算同一種地物
  un('n:圃','n:花圃');un('n:球場','n:體育場');un('n:運動場','n:體育場');// 同義名稱
  const disp=new Map();for(const l of impLayers){const r=roles.get(l.name);if(!r||!r.a)continue;const nm=areaKindName(fullName(l.name)),root=fd('n:'+nm);if(!disp.has(root))disp.set(root,nm);kindOf.set(l.name,disp.get(root));if(r.withH||r.big)withHouse.add(disp.get(root));if(r.big)bigKinds.add(disp.get(root));}
  if(!roles.size)return null;
  // 註記、圖例、文字的圖層（不是範圍類）：上面畫的一般線段（不含圖塊、文字）另外收，給區域檢查判斷有沒有拿來圍範圍
  const oddLy=new Set();for(const[n,r]of roles)if(!r.b&&!r.land&&!r.ditch&&!r.gate&&(r.t||r.a||r.fac))oddLy.add(n);
  const oddPush=(a,ly)=>{const r=roles.get(ly);odd.push({p:a,ly,nm:lnm(ly),h:r&&(r.t==='house'||r.t==='temp')});};
  // 作業範圍線候選：沒有編碼的圖層上的封閉線（例如 bon）
  const rangeLy=new Set(impLayers.map(l=>l.name).filter(n=>!roles.has(n)&&!/^a?\d/.test(n)&&!/^Q/i.test(n)&&!/圖框|圖號/.test(n)));
  const frameLy=new Set(impLayers.map(l=>l.name).filter(n=>/圖框/.test(n)));// 每一幅的圖框：當邊界，也拿來做接邊檢查
  const lines=[],points=[],ranges=[],gates=[];let ox=0,oy=0;
  const noAdd=false;// 交業主前：增建圖層關掉後，房屋線要自己封得起來
  const pushLine=(a,r,ly)=>{if(noAdd&&(r.b&AR_ADD)&&!/^a?\d{7}/.test(ly))return;/* 七碼的屋頂增建編輯當永久建物，不關 */if(r.wing&&a.length<=6){const n=a.length/2;let L=0;for(let i=2;i<a.length;i+=2)L+=Math.hypot(a[i]-a[i-2],a[i+1]-a[i-1]);if(L<3&&Math.hypot(a[0]-a[a.length-2],a[1]-a[a.length-1])>0.01)return;}lines.push({p:a,r:r.b,ly,k7:/^a?\d{7}/.test(ly),nm:lnm(ly),nw:/^\d/.test(ly)});};// 橋、涵的小翅膀不算
  const grpPt=(x,y,r,ly)=>{/* 圖例只看插入點 */if(r.gate)gates.push([x,y]);else if(r.fac)points.push({nw:/^\d/.test(ly),x,y,fac:true});else if(r.t&&!r.a)points.push(r.t==='temp'?{nw:/^\d/.test(ly),x,y,k:'H'}:{nw:/^\d/.test(ly),x,y,add:true});else if(r.a)points.push({nw:/^\d/.test(ly),x,y,k:kind(ly)});};
  const kind=ly=>kindOf.get(ly)||ly;
  const lnmC=new Map(),lnm=ly=>{let v=lnmC.get(ly);if(v==null)lnmC.set(ly,v=areaSyn(areaKindName(fullName(ly))));return v;};
  const textPt=(e,r)=>{const s=e.lines.join('').replace(/\s/g,'');if(!s)return;const x=e.p[0]-ox,y=e.p[1]-oy,b=e.bb||entBox(e),n0=points.length;// 以插入點為準
    if(r.t==='temp')points.push({nw:/^\d/.test(e.ly),x,y,k:'H'});// 位置用插入點
    else if(r.t==='house'){if(/^\d/.test(s))points.push({nw:/^\d/.test(e.ly),x,y,k:'H',fl:s.toUpperCase()});else if(/^[A-Za-z]/.test(s))points.push({nw:/^\d/.test(e.ly),x,y,add:true,tx:s.toUpperCase()});else if(/^[(（]?[中危廢]/.test(s))points.push({nw:/^\d/.test(e.ly),x,y,k:'H'});}// 中（建築中）、危、廢這類房屋註記
    else if(r.t==='add')points.push({nw:/^\d/.test(e.ly),x,y,add:true,tx:s.toUpperCase()});
    else if(r.a)points.push({nw:/^\d/.test(e.ly),x,y,k:kind(e.ly)});
    else if(r.fac)points.push({x,y,fac:true});// 候車亭這類附屬設施寫成文字的
    for(let i=n0;i<points.length;i++)if(b&&isFinite(b[0])){points[i].cx=(b[0]+b[2])/2-ox;points[i].cy=(b[1]+b[3])/2-oy;}};// 插入點剛好壓在線上時，往文字中心偏一點判斷
  if(nativeOn){
    const req={b:[...rangeLy,...frameLy],p:[],l:[],g:[]};for(const[n,r]of roles){if(r.b||r.ditch)req.b.push(n);if(r.gb&&!r.gate)req.g.push(n);if(oddLy.has(n))req.l.push(n);if(r.a||r.gate||r.fac||(r.t&&r.b))req.p.push(n);if(r.land)req.l.push(n);}
    const D=JSON.parse(CadNative.areaData(JSON.stringify(req))||'null');if(!D)return null;if(D.err)throw new Error(D.err);
    ox=D.ox;oy=D.oy;
    for(const a of D.s){const ly=D.L[a[0]],r=roles.get(ly);if(r&&r.ditch){ditch.push(a.slice(1));if(!r.b)continue;}if(r&&r.b)pushLine(a.slice(1),r,ly);else if(r&&oddLy.has(ly))oddPush(a.slice(1),ly);else if(r&&r.land)areaVeg(a.slice(1),ly,ox,oy,points,veg,kind,lnm);else if(frameLy.has(ly))lines.push({p:a.slice(1),r:AR_FRAME,ly});else if(rangeLy.has(ly))ranges.push(a.slice(1));}
    for(const a of D.p){const n=D.L[a[0]],r=roles.get(n);if(r)grpPt(a[1],a[2],r,n);}
  }else{
    const f=imp.find(e=>e.bb&&isFinite(e.bb[0]));if(f){ox=Math.floor(f.bb[0]);oy=Math.floor(f.bb[1]);}
    const grp=new Map();
    for(const e of imp){if(e.t==='text')continue;
      if(frameLy.has(e.ly)&&!e.g){for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);lines.push({p:a,r:AR_FRAME,ly:e.ly});}continue;}
      if(rangeLy.has(e.ly)&&!e.g){for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);ranges.push(a);}continue;}
      const r=roles.get(e.ly);if(!r)continue;const b=e.bb||entBox(e);
      if(e.g&&r.gb&&!r.gate){for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);pushLine(a,r,e.ly);}continue;}
      if(e.g){if(!r.a&&!r.t&&!r.gate&&!r.fac)continue;const k=e.g+'|'+e.ly;const g=grp.get(k);if(!g)grp.set(k,{b:b.slice(),ly:e.ly,gi:e.gi});else{g.b[0]=Math.min(g.b[0],b[0]);g.b[1]=Math.min(g.b[1],b[1]);g.b[2]=Math.max(g.b[2],b[2]);g.b[3]=Math.max(g.b[3],b[3]);}continue;}
      if(r.ditch){for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);ditch.push(a);}if(!r.b)continue;}
      if(r.land){for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);if(e.closed&&a.length>=4&&Math.hypot(a[0]-a[a.length-2],a[1]-a[a.length-1])>0.01)a.push(a[0],a[1]);areaVeg(a,e.ly,ox,oy,points,veg,kind,lnm);}continue;}// 植被圖層的散線
      if(!r.b&&oddLy.has(e.ly)&&e.t!=='point'&&e.t!=='fill'){for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);if(e.closed&&a.length>=4&&Math.hypot(a[0]-a[a.length-2],a[1]-a[a.length-1])>0.01)a.push(a[0],a[1]);oddPush(a,e.ly);}continue;}
      if(!r.b||e.t==='point'||e.t==='fill')continue;
      for(const P of entPolys(e)){const a=[];for(const q of P)a.push(q[0]-ox,q[1]-oy);pushLine(a,r,e.ly);}}
    for(const g of grp.values())grpPt((g.gi?g.gi[0]:(g.b[0]+g.b[2])/2)-ox,(g.gi?g.gi[1]:(g.b[1]+g.b[3])/2)-oy,roles.get(g.ly),g.ly);
  }
  const notes=[];for(const e of imp){if(e.t!=='text')continue;const r=roles.get(e.ly);if(r)textPt(e,r);else if(/註記/.test(e.ly)&&e.p)notes.push([e.p[0]-ox,e.p[1]-oy]);}// 中文註記（候車亭、警衛室…）：有寫名稱的房子不算沒有註記
  return{lines,points,gates,withHouse,bigKinds,veg,ditch,odd,notes,ox,oy,range:areaPickRange(ranges,lines)};
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
/** 跑區域檢查（只留作業範圍內的） */
let areaTopo=null,areaFills=new Map(),fillMode=false,fillCi=0;// 填色：區域編號→顏色
const areaHoleC=new Map();
/** 區域裡的洞：外框裡面、不屬於這一區的其他區（只取最外層的，裡面再套的不算） */
function areaHoles(k){if(areaHoleC.has(k))return areaHoleC.get(k);const T=areaTopo,f=T.F[k],r=f.ring,C=[];
  for(let j=0;j<T.F.length;j++){if(j===k)continue;const g=T.F[j];if(g.area>=f.area||g.bb[0]<f.bb[0]||g.bb[2]>f.bb[2]||g.bb[1]<f.bb[1]||g.bb[3]>f.bb[3])continue;
    const x=g.ring[0],y=g.ring[1];let ins=false;for(let i=0,q=r.length-2;i<r.length;q=i,i+=2){if((r[i+1]>y)!==(r[q+1]>y)&&x<(r[q]-r[i])*(y-r[i+1])/(r[q+1]-r[i+1])+r[i])ins=!ins;}if(ins)C.push(j);}
  const inR=(r,x,y)=>{let c=false;for(let i=0,q=r.length-2;i<r.length;q=i,i+=2){if((r[i+1]>y)!==(r[q+1]>y)&&x<(r[q]-r[i])*(y-r[i+1])/(r[q+1]-r[i+1])+r[i])c=!c;}return c;};
  // 被別的洞（較大的）包住的不算：它本身在那個洞的外框裡
  const H=C.filter(j=>{const g=T.F[j],x=g.ring[0]+1e-6,y=g.ring[1]+1e-6;return!C.some(o=>{if(o===j)return false;const h=T.F[o];return h.area>g.area&&h.bb[0]<=g.bb[0]&&h.bb[2]>=g.bb[2]&&h.bb[1]<=g.bb[1]&&h.bb[3]>=g.bb[3]&&inR(h.ring,(g.bb[0]+g.bb[2])/2,(g.bb[1]+g.bb[3])/2)&&inR(h.ring,x,y);});});
  areaHoleC.set(k,H);return H;}
function areaRun(D){
  const keep=areaKeep(D);
  const kt={};const R=areaCheck(D.lines,D.points,{keepTopo:kt,tol:areaTolV(),edgeTol:edgeTolV(),gates:D.gates,withHouse:D.withHouse,bigKinds:D.bigKinds,veg:D.veg,ditch:D.ditch,odd:D.odd,notes:D.notes,keep});
  areaTopo=kt.T?{F:kt.T.F,locate:kt.T.locate,ox:D.ox,oy:D.oy}:null;areaFills=new Map();areaHoleC.clear();
  if(keep){const n0=R.marks.length;R.marks=R.marks.filter(m=>keep(m.kx??m.x,m.ky??m.y));/* 接邊屬性問題：圓圈畫在區裡，要不要留看框上的點 */R.st.outRange=n0-R.marks.length;}
  const c={};for(const m of R.marks)c[m.type]=(c[m.type]||0)+1;R.st.cnt=c;return R;
}
/* ---------- 檢查圖幅：圖框圖層（每幅一個外框）＋圖號圖層（框中央的圖號文字）；選了就只檢查這些圖幅 ---------- */
const ADDR_PAD=50;// 門牌點：選的圖幅往外多畫 50m
/* 兩組各自的圖幅選擇：area＝區域檢查只查這些圖幅（⚙ 檢查設定）、addr＝門牌點只畫這些圖幅往外 50m（門牌面板）；每張圖各自記住 */
const SG={
  area:{key:'sheets',set:new Set(),for:'',info:'sheetInfo',clear:'sheetClear',inp:'sheetIn',sheet:'chkSheet',none:'沒選：檢查整張圖',has:n=>`只檢查 ${n} 幅`,
    end:n=>n?`只檢查 ${n} 幅，重跑區域檢查才會套用`:'沒選圖幅：檢查整張圖',cleared:'已清除：檢查整張圖'},
  addr:{key:'addrSheets',set:new Set(),for:'',info:'addrSheetInfo',clear:'addrSheetClear',inp:'addrSheetIn',sheet:'addrSheet',none:'沒選：畫底圖所有圖框（圖幅）裡的門牌',has:n=>`只畫 ${n} 幅（往外 50m）的門牌`,
    end:n=>n?`門牌點只畫選的 ${n} 幅`:'沒選圖幅：畫所有圖框裡的門牌',cleared:'已清除：畫所有圖框裡的門牌'}};
const sheetSel=SG.area.set;let sheetPick=null,sheetFr=null;
const SHEET_PAD=150;// 選定圖幅外多拿 150m 的線一起算，接邊另一側的區域才算得出來
function sheetFrames(){const key=impName+'|'+imp.length+'|'+nativeOn+'|'+impLayers.length;if(sheetFr&&sheetFr.key===key)return sheetFr.list;
  const fly=impLayers.map(l=>l.name).filter(n=>/圖框/.test(n));const FB=[];
  const box=(P,ox,oy,st2)=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<P.length;i+=st2){const x=st2===2?P[i]:P[i][0],y=st2===2?P[i+1]:P[i][1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(x1-x0>50&&y1-y0>50)FB.push([x0+ox,y0+oy,x1+ox,y1+oy]);};
  if(fly.length){
    if(nativeOn){let R=null;try{R=JSON.parse(CadNative.areaData(JSON.stringify({b:fly,p:[],l:[],g:[]}))||'null');}catch(_){}
      if(R&&!R.err)for(const a of R.s)box(a.slice(1),R.ox,R.oy,2);}
    else for(const e of imp)if(fly.includes(e.ly)&&e.t!=='text')for(const P of entPolys(e))box(P,0,0,1);}
  const B=[];for(const b of FB)if(!B.some(c=>Math.abs(c[0]-b[0])<1&&Math.abs(c[1]-b[1])<1&&Math.abs(c[2]-b[2])<1&&Math.abs(c[3]-b[3])<1))B.push(b);
  const T=imp.filter(e=>e.t==='text'&&/圖號/.test(e.ly)&&e.p);
  const list=B.map(b=>{const cx=(b[0]+b[2])/2,cy=(b[1]+b[3])/2;let best=null,bd=Infinity;
    for(const t of T){if(t.p[0]<b[0]||t.p[0]>b[2]||t.p[1]<b[1]||t.p[1]>b[3])continue;const d=Math.hypot(t.p[0]-cx,t.p[1]-cy);if(d<bd){bd=d;best=t;}}
    const num=best?best.lines.join('').replace(/\s/g,''):'';return{id:num||`${Math.round(b[0])},${Math.round(b[1])}`,num,b};});
  if(fly.length&&(!nativeOn||FB.length))sheetFr={key,list};return list;}
function sheetApply(D){const S=sheetBoxes();if(!S.length){if(sheetSel.size)toast('選的圖幅在這張圖找不到，改檢查整張圖',3000);return true;}
  const ox=D.ox,oy=D.oy,BX=S.map(f=>[f.b[0]-ox,f.b[1]-oy,f.b[2]-ox,f.b[3]-oy]);
  const PB=BX.map(b=>[b[0]-SHEET_PAD,b[1]-SHEET_PAD,b[2]+SHEET_PAD,b[3]+SHEET_PAD]);
  const ptIn=(x,y)=>PB.some(b=>x>=b[0]&&x<=b[2]&&y>=b[1]&&y<=b[3]);
  const arrIn=a=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<a.length;i+=2){if(a[i]<x0)x0=a[i];if(a[i]>x1)x1=a[i];if(a[i+1]<y0)y0=a[i+1];if(a[i+1]>y1)y1=a[i+1];}
    return PB.some(b=>x1>=b[0]&&x0<=b[2]&&y1>=b[1]&&y0<=b[3]);};
  const n0=D.lines.length;D.lines=D.lines.filter(L=>arrIn(L.p));D.points=D.points.filter(q=>ptIn(q.x,q.y));
  if(D.gates)D.gates=D.gates.filter(g=>ptIn(g[0],g[1]));if(D.ditch)D.ditch=D.ditch.filter(arrIn);if(D.odd)D.odd=D.odd.filter(o=>arrIn(o.p||o));
  if(D.notes)D.notes=D.notes.filter(n=>ptIn(n[0],n[1]));
  if(D.veg)D.veg=D.veg.filter(v=>!v||!v.p||arrIn(v.p));
  D.keep=(x,y)=>BX.some(b=>x>=b[0]-0.5&&x<=b[2]+0.5&&y>=b[1]-0.5&&y<=b[3]+0.5);D.range=null;D.sheetN=S.length;D.cut=n0-D.lines.length;
  if(!D.lines.length){toast('選的圖幅裡沒有可以檢查的線',3000);return false;}return true;}
function areaKeep(D){return D.keep||(D.range?(x,y)=>areaInRing(D.range.ring,x,y)===D.range.inside:null);}
function sheetAt(w){return sheetFrames().filter(f=>w[0]>=f.b[0]&&w[0]<=f.b[2]&&w[1]>=f.b[1]&&w[1]<=f.b[3]).sort((a,b)=>(a.b[2]-a.b[0])*(a.b[3]-a.b[1])-(b.b[2]-b.b[0])*(b.b[3]-b.b[1]))[0]||null;}
function sgLoad(g){if(g.for===impName)return;g.for=impName;g.set.clear();try{for(const x of JSON.parse(localStorage.getItem(g.key+':'+impName)||'[]'))g.set.add(x);}catch(_){}}
function sgSave(g){try{localStorage.setItem(g.key+':'+impName,JSON.stringify([...g.set]));}catch(_){}sgInfo(g);}
function sgBoxes(g){sgLoad(g);return sheetFrames().filter(f=>g.set.has(f.id));}
function sgInfo(g){const el=$(g.info);if(!el)return;sgLoad(g);const S=sgBoxes(g);
  el.textContent=!imp.length?'還沒開底圖':!sheetFrames().length?'這張圖沒有圖框圖層':S.length?`${g.has(S.length)}：${S.map(f=>f.num||f.id).join('、')}`:g.none;
  const b=$(g.clear);if(b)b.disabled=!g.set.size;}
function sheetLoad(){sgLoad(SG.area);}
function sheetBoxes(){return sgBoxes(SG.area);}
function updSheetInfo(){sgInfo(SG.area);sgInfo(SG.addr);}
function sheetPickHint(){setHint(`點圖框裡面選／取消圖幅（已選 ${sheetPick.set.size} 幅）`,true,{t:'完成',f:sheetPickEnd});}
function sheetPickStart(g){if(!sheetFrames().length){toast('這張圖沒有圖框圖層');return;}sgLoad(g);closeSheet(g.sheet);closeSheet('layerSheet');sheetPick=g;sheetPickHint();schedule();}
function sheetPickEnd(){const g=sheetPick;sheetPick=null;setHint(baseHintText(),false);schedule();if(g){sgInfo(g);toast(g.end(g.set.size),2500);}}
function sheetTap(w){const g=sheetPick,f=sheetAt(w);if(!f){toast('那裡不在任何圖框裡');return;}if(g.set.has(f.id))g.set.delete(f.id);else g.set.add(f.id);sgSave(g);sheetPickHint();schedule();}
function drawSheets(){if(!sheetPick)return;const S=sgBoxes(sheetPick);// 只在「在圖上點選」時把選的圖幅畫成橘框
  ctx.save();ctx.lineWidth=3;ctx.strokeStyle='#ffb13d';ctx.fillStyle='rgba(255,177,61,0.13)';
  for(const f of S){const a=toS([f.b[0],f.b[3]]),c=toS([f.b[2],f.b[1]]);ctx.fillRect(a[0],a[1],c[0]-a[0],c[1]-a[1]);ctx.strokeRect(a[0],a[1],c[0]-a[0],c[1]-a[1]);
    ctx.fillStyle='#ffb13d';ctx.font='bold 16px sans-serif';ctx.textAlign='center';ctx.fillText(f.num||f.id,(a[0]+c[0])/2,(a[1]+c[1])/2);ctx.fillStyle='rgba(255,177,61,0.13)';}
  ctx.restore();}
function sgGo(g){sgLoad(g);const F=sheetFrames();if(!F.length){toast('這張圖沒有圖框圖層');return;}
  const want=$(g.inp).value.split(/[\s,，、;；]+/).map(x=>x.trim()).filter(Boolean);if(!want.length)return;const miss=[];
  let add=0;for(const w of want){const ex=F.filter(f=>f.num===w),M=ex.length?ex:F.filter(f=>f.num&&f.num.endsWith(w));if(!M.length){miss.push(w);continue;}for(const f of M)if(!g.set.has(f.id)){g.set.add(f.id);add++;}}// 只打尾數：同尾數的都加（例：41＝那一排）
  sgSave(g);$(g.inp).value='';schedule();toast((miss.length?`找不到圖號：${miss.join('、')}。`:'')+`加入 ${add} 幅，共 ${g.set.size} 幅`,2500);}
for(const g of Object.values(SG)){const pre=g===SG.area?'sheet':'addrSheet';
  $(pre+'PickBtn').onclick=()=>sheetPickStart(g);
  $(pre+'Clear').onclick=()=>{sgLoad(g);g.set.clear();sgSave(g);schedule();toast(g.cleared,2000);};
  $(pre+'Go').onclick=()=>sgGo(g);}
/* ---------- 路名對門牌：門牌位置數值資料（CSV，TWD97），比對圖上路名附近的門牌；也可以把門牌點顯示在圖上 ---------- */
let addrRaw=null,addrName='',addrIdx=null,addrDot=null;const addrFiles=new Map();// 檔名→瘦身後的 CSV（含表頭）；多個縣市可以同時放
let addrShow=localStorage.getItem('addrShow')==='1';
const addrFw=s=>(s||'').replace(/^"|"$/g,'').replace(/[０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xFEE0)).replace(/\s/g,'').replace(/臺/g,'台');
// 拆成：路名（不含段）、段、巷、弄。圖上路名太長時常省略前段（只寫「33巷2弄」），比對時只比有寫出來的部分
function addrTok(s){const t={};let m;
  if(m=s.match(/(\d+)弄$/)){t.al=m[1];s=s.slice(0,-m[0].length);}
  if(m=s.match(/([^\d路街道段]*\d+|[^\d路街道段]+)巷$/)){t.ln=addrLn(m[1]);s=s.slice(0,-m[0].length);}
  if(m=s.match(/([一二三四五六七八九十]+)段$/)){t.sec=m[1];s=s.slice(0,-m[0].length);}
  if(s)t.rd=s;return t;}
// 有名字的巷：「豐2巷」和門牌的「豐二巷」當成同一條（中文數字換成阿拉伯數字）
function addrLn(s){return s.replace(/[一二三四五六七八九十]+/g,c=>{const d='一二三四五六七八九'.indexOf(c[0])+1,i=c.indexOf('十');
  if(i<0)return String(c.length===1?d:c);const a=i===0?1:'一二三四五六七八九'.indexOf(c[i-1])+1,b=i<c.length-1?'一二三四五六七八九'.indexOf(c[i+1])+1:0;return String(a*10+b);});}
const addrFit=(l,d)=>['rd','sec','ln','al'].every(k=>l[k]===undefined||l[k]===d[k]);
function updAddrInfo(){const el=$('addrInfo');if(el)el.textContent=addrRaw?`已載入：${addrName}（區域檢查時一起比對路名）`:'還沒載入';$('addrClear').disabled=!addrRaw;
  const b=$('addrShow');b.disabled=!addrRaw;b.textContent=addrShow?'門牌點：開':'門牌點：關';b.classList.toggle('on',addrShow&&!!addrRaw);
  const t=$('addrBtn');if(t)t.classList.toggle('on',!!(addrRaw&&addrShow));}
function addrJoin(save){addrIdx=null;addrDot=null;const b=[...addrFiles.values()].filter(Boolean);addrRaw=b.length?b:null;addrName=[...addrFiles.keys()].join('、');
  if(save)idbFile('addr',addrFiles.size?{ver:2,files:Object.fromEntries(addrFiles)}:null);updAddrInfo();schedule();}
/** 加一份門牌 CSV（原始或瘦身過的都行）；不是門牌資料回傳 null */
function addrAdd(name,txt){const h=txt.slice(0,600);if(!/x_3826|橫坐標|橫座標/i.test(h))return null;const sl=addrSlim(txt);
  addrFiles.set(name,sl);addrJoin(true);return{from:txt.length,to:sl.length,n:sl.split('\n').length-1};}
(async()=>{const v=await idbFileGet('addr');
  if(v&&v.files)for(const k in v.files)addrFiles.set(k,v.ver===2?v.files[k]:'street,area,lane,alley,x_3826,y_3826\n'+v.files[k]);// 舊版存的沒有表頭、沒有門牌號
  else if(v&&v.text)addrFiles.set(v.name||'門牌資料',v.text);addrJoin(false);})();
$('addrBtn').onclick=()=>{closeSheet('layerSheet');updAddrInfo();sgInfo(SG.addr);openSheet('addrSheet');};
/** 已瘦身的門牌文字（原生那邊瘦好的）直接放進來 */
function addrPut(name,sl){if(!sl)return null;addrFiles.set(name,sl);addrJoin(true);return{n:sl.split('\n').length-1};}
$('addrLoad').onclick=async()=>{
  if(NATIVE){// 原始檔可能好幾百 MB：交給原生邊讀邊瘦身
    let r;try{busy(true,'讀取門牌資料（邊讀邊瘦身）…');r=await CadCall('Cad','addrPick',{});}catch(err){if(!/cancel/i.test(err.message||''))toast(err.message||String(err),5000);return;}finally{busy(false);}
    const a=addrPut(r.name,r.text);toast(a?`門牌資料已載入：${a.n} 筆（瘦身後）`:'這份 CSV 看不到 TWD97 坐標欄（x_3826／橫坐標）',4000);return;}
  $('addrFile').value='';$('addrFile').click();};
$('addrClear').onclick=()=>{if(addrRaw&&confirm(`要移除「${addrName}」嗎？`)){addrFiles.clear();addrJoin(true);}};
$('addrShow').onclick=()=>{addrShow=!addrShow;localStorage.setItem('addrShow',addrShow?'1':'0');updAddrInfo();schedule();if(addrShow)toast('門牌點：點一下橘色的點會顯示門牌（要放大到街道才會畫）',3500);};
$('addrFile').onchange=async e=>{const f=e.target.files[0];if(!f)return;busy(true,'讀取門牌資料…');try{const r=addrAdd(f.name,addrText(new Uint8Array(await f.arrayBuffer())));
  if(!r){toast('這份 CSV 看不到 TWD97 坐標欄（x_3826／橫坐標）',5000);return;}
  toast(`門牌資料已載入（瘦身 ${(r.from/1e6).toFixed(1)}→${(r.to/1e6).toFixed(1)} M 字）`,3000);}finally{busy(false);}};
function addrText(bytes){try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch(_){return new TextDecoder('big5').decode(bytes);}}
function addrCols(t){const H=t.slice(0,t.indexOf('\n')).split(',').map(s=>s.replace(/^"|"$/g,'').trim());const col=re=>H.findIndex(h=>re.test(h));
  return{X:col(/x_3826|橫坐標|橫座標/i),Y:col(/y_3826|縱坐標|縱座標/i),S:col(/street|^road$|街路段|街_路段|路段/i),A:col(/^area$|地區/i),L:col(/^lane$|^巷$/i),B:col(/^alley$|^弄$/i),N:col(/^number$|門牌號|^號$/i)};}
/** 逐行走一份 CSV（跳過表頭） */
function addrEach(raw,fn){const t=raw.charCodeAt(0)===0xFEFF?raw.slice(1):raw;const c=addrCols(t);let i=t.indexOf('\n');
  while(i>=0&&i<t.length){const j=t.indexOf('\n',i+1);const ln=t.slice(i+1,j<0?t.length:j);i=j;if(ln&&ln!=='\r')fn(ln.replace(/\r$/,'').split(','),c);}}
/** 門牌瘦身：只留路段、地區、巷、弄、門牌號（去掉樓層）、整數公尺坐標；同一個門牌號只留一筆 */
function addrSlim(raw){const seen=new Set(),out=['street,area,lane,alley,number,x_3826,y_3826'];const g=v=>String(v||'').replace(/^"|"$/g,'').trim();
  addrEach(raw,(a,c)=>{const x=Math.round(+g(a[c.X])),y=Math.round(+g(a[c.Y]));if(!x||!y)return;
    const k=[c.S,c.A,c.L,c.B].map(i=>i<0?'':g(a[i])).join(',');const no=c.N<0?'':g(a[c.N]).replace(/號.*$/,'號');
    const q=no?k+','+no:k+'|'+Math.round(x/10)+','+Math.round(y/10);if(seen.has(q))return;seen.add(q);out.push(k+','+no+','+x+','+y);});
  return out.join('\n');}
/** 只取圖面範圍（外擴 300m）裡的門牌，建格網 */
function addrBuild(x0,y0,x1,y1){const key=[x0,y0,x1,y1].map(v=>Math.round(v)).join(',');if(addrIdx&&addrIdx.key===key)return addrIdx;
  const G=new Map(),C=100,all=new Set();const P0=x0-300,P1=x1+300,Q0=y0-300,Q1=y1+300;
  for(const raw of addrRaw)addrEach(raw,(a,c)=>{
    const st=addrFw(a[c.S]),ar=c.A>=0?addrFw(a[c.A]):'';for(const b of [st,ar])if(b)all.add(addrTok(b).rd);
    const x=+a[c.X],y=+a[c.Y];if(!(x>=P0&&x<=P1&&y>=Q0&&y<=Q1))return;
    const la=c.L>=0?addrLn(addrFw(a[c.L]).replace(/巷$/,'')):'',al=c.B>=0?addrFw(a[c.B]).replace(/弄$/,''):'';const T=[];
    for(const b of [st,ar])if(b){const k=addrTok(b);T.push({rd:k.rd,sec:k.sec,ln:la||undefined,al:al||undefined});}
    if(!T.length&&la)T.push({ln:la,al:al||undefined});if(!T.length)return;
    const full=(st||ar)+(la?la+(/\d$/.test(la)?'巷':''):'');const g=Math.floor(x/C)+','+Math.floor(y/C);let l=G.get(g);if(!l)G.set(g,l=[]);l.push({x,y,T,full});});
  return addrIdx={key,G,C,all};}
/** 門牌點（顯示用）：全部門牌的格網，50m 一格 */
function addrDots(){if(addrDot)return addrDot;const G=new Map(),C=50,X=[],Y=[],L=[];
  for(const raw of addrRaw)addrEach(raw,(a,c)=>{const x=+a[c.X],y=+a[c.Y];if(!x||!y)return;
    const s=addrFw(a[c.S]),ar=c.A>=0?addrFw(a[c.A]):'',la=c.L>=0?addrFw(a[c.L]):'',al=c.B>=0?addrFw(a[c.B]):'',no=c.N>=0?addrFw(a[c.N]):'';
    const k=X.length;X.push(x);Y.push(y);L.push(s+(ar&&ar!==s?ar:'')+la+al+no);const g=Math.floor(x/C)*1e6+Math.floor(y/C);let l=G.get(g);if(!l)G.set(g,l=[]);l.push(k);});
  return addrDot={G,C,X,Y,L};}
function addrDotsIn(x0,y0,x1,y1,max){const D=addrDots(),o=[];for(let i=Math.floor(x0/D.C);i<=Math.floor(x1/D.C);i++)for(let j=Math.floor(y0/D.C);j<=Math.floor(y1/D.C);j++){
    for(const k of D.G.get(i*1e6+j)||[]){const x=D.X[k],y=D.Y[k];if(x>=x0&&x<=x1&&y>=y0&&y<=y1){o.push(k);if(o.length>max)return null;}}}return o;}
/** 門牌只顯示在底圖的圖框（圖幅）範圍內：圖框圖層每條線的外框（>50m）聯集；圖上沒有圖框就回傳 null（全部顯示） */
let addrFr=null;
function addrFrames(){const D=addrDots(),SB=sgBoxes(SG.addr),key=impName+'|'+imp.length+'|'+nativeOn+'|'+impLayers.length+'|'+SB.map(f=>f.id).join(',');if(addrFr&&addrFr.key===key&&addrFr.D===D)return addrFr.list;
  if(SB.length){// 門牌面板選了圖幅：只畫選的圖幅往外 50m 內的門牌
    const m=new Uint8Array(D.X.length);for(const f of SB){const K=addrDotsIn(f.b[0]-ADDR_PAD,f.b[1]-ADDR_PAD,f.b[2]+ADDR_PAD,f.b[3]+ADDR_PAD,Infinity);for(const k of K)m[k]=1;}
    const list=[];for(let k=0;k<m.length;k++)if(m[k])list.push(k);addrFr={key,D,list};return list;}
  const fly=impLayers.map(l=>l.name).filter(n=>/圖框/.test(n));const FB=[];
  const box=(P,ox,oy,st2)=>{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<P.length;i+=st2){const x=st2===2?P[i]:P[i][0],y=st2===2?P[i+1]:P[i][1];if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y;}
    if(x1-x0>50&&y1-y0>50)FB.push([x0+ox,y0+oy,x1+ox,y1+oy]);};
  if(fly.length){
    if(nativeOn){let R=null;try{R=JSON.parse(CadNative.areaData(JSON.stringify({b:fly,p:[],l:[],g:[]}))||'null');}catch(_){}
      if(!R||R.err)return null;// 原生端還沒好：先全部顯示，下次再試
      for(const a of R.s)box(a.slice(1),R.ox,R.oy,2);}
    else for(const e of imp)if(fly.includes(e.ly)&&e.t!=='text')for(const P of entPolys(e))box(P,0,0,1);}
  let list=null;
  if(FB.length){const m=new Uint8Array(D.X.length);for(const[x0,y0,x1,y1]of FB){const K=addrDotsIn(x0,y0,x1,y1,Infinity);for(const k of K)m[k]=1;}
    list=[];for(let k=0;k<m.length;k++)if(m[k])list.push(k);}
  addrFr={key,D,list};return list;}
const ADDR_MIN_S=0.8;// 門牌點：放大到每公尺 0.8 像素以上（畫面寬約 500m 以內）才畫、才點得到
function drawAddr(){if(!addrShow||!addrRaw||st.view.s<ADDR_MIN_S)return;const a=toW([0,H]),b=toW([W,0]),F=addrFrames(),D=addrDots();let K;
  if(F){K=[];for(const k of F){const x=D.X[k],y=D.Y[k];if(x>=a[0]&&x<=b[0]&&y>=a[1]&&y<=b[1]){K.push(k);if(K.length>30000)return;}}}// 有圖框：只畫圖框裡的，拉遠也畫
  else{if((b[0]-a[0])*(b[1]-a[1])>4e6)return;K=addrDotsIn(a[0],a[1],b[0],b[1],30000);if(!K)return;}// 沒有圖框：拉太遠（超過約 2km×2km）不畫
  ctx.save();ctx.fillStyle='#ff9f1c';ctx.strokeStyle=st.bg==='white'?'#7a4300':'#1a1206';ctx.lineWidth=1;
  ctx.beginPath();for(const k of K){const q=toS([D.X[k],D.Y[k]]);ctx.moveTo(q[0]+3,q[1]);ctx.arc(q[0],q[1],3,0,TAU);}ctx.fill();ctx.stroke();ctx.restore();}// 全部的點合成一條路徑，一次填色、一次描邊
/** 點門牌點：顯示這個位置（1m 內）所有門牌 */
function addrTap(sp){if(!addrShow||!addrRaw||st.view.s<ADDR_MIN_S)return false;const w=toW(sp),r=16/st.view.s;let K=addrDotsIn(w[0]-r,w[1]-r,w[0]+r,w[1]+r,500);if(!K||!K.length)return false;const F=addrFrames();if(F){const f=new Set(F);K=K.filter(k=>f.has(k));if(!K.length)return false;}
  const D=addrDots();let bk=-1,bd=1e18;for(const k of K){const d=Math.hypot(D.X[k]-w[0],D.Y[k]-w[1]);if(d<bd){bd=d;bk=k;}}if(bd>r)return false;
  const same=K.filter(k=>Math.hypot(D.X[k]-D.X[bk],D.Y[k]-D.Y[bk])<1).map(k=>D.L[k]);setHint([...new Set(same)].join('、'),true);return true;}
/** 圖上道路路名（942／944 道路、橋圖層的文字）和附近門牌比對 */
function addrCheck(){if(!addrRaw)return[];const R=[];const txt=[];let x0=1e18,y0=1e18,x1=-1e18,y1=-1e18;
  for(const e of imp){if(e.t!=='text'||!e.p||!/^a?94[24]|道路|路名/.test(e.ly))continue;const raw=addrFw((e.lines||[]).join(''));
    // 七碼的「縣144_柳橋路一段」「台1_中山路一段_縱貫公路」：去掉路線編號，取第一段路名
    const nm=raw.split('_').find(s=>/[路街巷弄段道]$/.test(s)&&!/^(台|縣|鄉|市|區|[^\d_]{1,2})\d+/.test(s));
    if(!nm||nm.length<2||/^[路街巷弄段道]$/.test(nm[0])||/快速道路|高速|快速公路|聯絡道|橋$|自行車|牽引道|坡道/.test(nm))continue;
    txt.push({x:e.p[0],y:e.p[1],nm});x0=Math.min(x0,e.p[0]);y0=Math.min(y0,e.p[1]);x1=Math.max(x1,e.p[0]);y1=Math.max(y1,e.p[1]);}
  if(!txt.length)return R;const I=addrBuild(x0,y0,x1,y1);
  const near=(x,y,r)=>{const o=[],n=Math.ceil(r/I.C);for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++)for(const p of I.G.get((Math.floor(x/I.C)+i)+','+(Math.floor(y/I.C)+j))||[])if(Math.hypot(p.x-x,p.y-y)<r)o.push(p);return o;};
  for(const t of txt){const lt=addrTok(t.nm);const n1=near(t.x,t.y,60);if(n1.length<2)continue;// 附近沒門牌（快速道路、河濱、農路）不比
    const n2=near(t.x,t.y,120);if(n2.some(p=>p.T.some(d=>addrFit(lt,d))))continue;
    const c={};for(const p of n1)c[p.full]=(c[p.full]||0)+1;const top=Object.entries(c).sort((a,b)=>b[1]-a[1]).slice(0,3).map(a=>a[0]).join('、');
    const none=lt.rd&&!I.all.has(lt.rd)?'；整份門牌資料找不到「'+lt.rd+'」':'';
    R.push({x:t.x,y:t.y,msg:`路名「${t.nm}」和附近門牌對不上（附近門牌多是 ${top}${none}）`});}
  // 反過來：門牌有、圖上沒寫路名。門牌依完整名稱（路＋段＋巷＋弄）分組，40m 內連成一串、3 間以上，80m 內找不到寫到這一層的路名就報
  // 旁支門牌和主幹同名的（沒有自己的巷弄號）會歸到主幹那組，主幹有寫就不報
  const deep=d=>d.al!==undefined?'al':d.ln!==undefined?'ln':'rd',fitFull=(l,d)=>{const k=deep(d);return l[k]!==undefined&&l[k]===d[k]&&addrFit(l,d);};
  const TG=new Map(),TC=150;for(const t of txt){t.tk=addrTok(t.nm);const g=Math.floor(t.x/TC)+','+Math.floor(t.y/TC);let l=TG.get(g);if(!l)TG.set(g,l=[]);l.push(t);}
  const txtNear=(x,y,r)=>{const o=[],n=Math.ceil(r/TC);for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++)for(const t of TG.get((Math.floor(x/TC)+i)+','+(Math.floor(y/TC)+j))||[])if(Math.hypot(t.x-x,t.y-y)<r)o.push(t);return o;};
  const grp=new Map();for(const l of I.G.values())for(const p of l){if(!txtNear(p.x,p.y,150).length)continue;// 圖面範圍外（附近 150m 沒有任何路名）的門牌不管
    const d=p.T[0];const k=[d.rd,d.sec,d.ln,d.al].join('|');let g=grp.get(k);if(!g)grp.set(k,g={d,P:[]});g.P.push(p);}
  for(const g of grp.values()){const P=g.P,seen=new Uint8Array(P.length);
    for(let i=0;i<P.length;i++){if(seen[i])continue;const C=[i];seen[i]=1;
      for(let q=0;q<C.length;q++){const a=P[C[q]];for(let j=0;j<P.length;j++)if(!seen[j]&&Math.abs(P[j].x-a.x)<40&&Math.abs(P[j].y-a.y)<40&&Math.hypot(P[j].x-a.x,P[j].y-a.y)<40){seen[j]=1;C.push(j);}}
      if(C.length<3)continue;if(C.some(c=>txtNear(P[c].x,P[c].y,80).some(t=>fitFull(t.tk,g.d))))continue;
      let cx=0,cy=0;for(const c of C){cx+=P[c].x;cy+=P[c].y;}cx/=C.length;cy/=C.length;let m=P[C[0]],md=1e18;for(const c of C){const dd=Math.hypot(P[c].x-cx,P[c].y-cy);if(dd<md){md=dd;m=P[c];}}
      const nm=P[C[0]].full+(g.d.al?g.d.al+'弄':'');R.push({x:m.x,y:m.y,miss:1,msg:`門牌是「${nm}」（${C.length} 間），附近 80m 圖上沒寫這個路名`});}}
  return R;}
async function findArea(onlyNoAdd){
  const D=areaCollect();
  if(!D||!D.lines.length){toast('這張圖沒有認得的房屋、圍牆、道路、地類界圖層（5 碼或 7 碼編碼）',4000);return;}
  sheetLoad();if(sheetSel.size&&!sheetApply(D))return;
  const R=areaRun(D);
  {// 新圖（數字開頭）和 Q 圖層的小線段，一起列在區域檢查結果裡
    const nw=newLayers(),q=qLayers(),only=nw.concat(q);let L=[];
    if(only.length){try{L=nativeOn?await CadCall('Cad','small',{max:smallMaxV(),only,q}):findSmallJS(new Set(only),smallMaxV(),new Set(nw),new Set(q));}catch(_){L=[];}}
    const keep=areaKeep(D);
    for(const m of L){const x=m.x-D.ox,y=m.y-D.oy;if(keep&&!keep(x,y))continue;R.marks.push({x,y,type:'small',msg:`新圖小線段 ${m.len<0.1?m.len.toFixed(3):m.len.toFixed(2)}m（${m.l}，沒有接到同圖層的線）`});}}
  {const keep=areaKeep(D);let A=[];try{A=addrCheck();}catch(err){console.error(err);}// 路名對門牌（有載入門牌資料才比）
    for(const m of A){const x=m.x-D.ox,y=m.y-D.oy;if(keep&&!keep(x,y))continue;R.marks.push({x,y,type:m.miss?'rmiss':'rname',msg:m.msg});}}
  const ord={};AREA_CAT.forEach(([t],i)=>ord[t]=i);
  R.marks.sort((a,b)=>(ord[a.type]??99)-(ord[b.type]??99)||b.y-a.y||a.x-b.x);
  smallKey=impName;smallMode='area';setTimeout(()=>{okApply();updSmallBar();schedule();},0);
  smallMarks=R.marks.map(m=>({p:[m.x+D.ox,m.y+D.oy],msg:m.msg,type:m.type,ring:m.ring,gap:m.gap,path:m.path,nd:m.nd,o:[D.ox,D.oy]}));smallIdx=-1;
  const c=R.st;
  toast(smallMarks.length?`找到 ${smallMarks.length} 處${D.sheetN?`（只看選的 ${D.sheetN} 幅）`:D.range?'（只看作業範圍內）':''}（${(c.ms/1000).toFixed(1)} 秒）`:`沒有找到問題（${c.face} 個區域，${(c.ms/1000).toFixed(1)} 秒）`,3500);
  if(!smallMarks.length)smallMarks=null;updSmallBar();updOldBtn();schedule();
  if(smallMarks){fillAreaSheet();openSheet('areaSheet');}// 跑完開分類列表
}
$('lyArea').onclick=()=>{if(smallMarks&&smallMode==='area'){smallMarks=null;updSmallBar();fillLayerSheet();schedule();return;}closeSheet('layerSheet');busy(true,'檢查區域中…');
  setTimeout(()=>{findArea().catch(err=>{console.error(err);toast('區域檢查出錯：'+(err&&err.message||err),5000);}).finally(()=>busy(false));},60);};
$('smOk').onclick=okToggle;
$('smPrev').onclick=()=>smallGo(-1);$('smNext').onclick=()=>smallGo(1);$('smOff').onclick=()=>{smallMarks=null;updSmallBar();updAddrInfo();schedule();};

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
  if(ext==='csv'){const t=addrText(bytes),r=addrAdd(name,t);if(r)return`${name}：門牌 ${r.n} 筆（瘦身後）`;const k=parkTry(name,t);return k?`${name}：停車場 ${k} 個`:`${name}：不是門牌或停車場資料，略過`;}
  if(ext!=='lin')return`${name}：略過（只吃 .lin、.shx、門牌 .csv`+(/^(rar|zip|7z)$/.test(ext)?'，壓縮檔請先解壓縮':'')+'）';
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
      try{if(/\.csv$/i.test(f.name)&&NATIVE){const{text}=await SF.slimCsv({uri:f.uri});// 門牌 CSV：原生瘦身後才送過來
          if(text)addrPut(f.name,text);else if(f.size<20e6){const{data}=await SF.read({uri:f.uri});parkTry(f.name,addrText(unb64(data)));}}// 不是門牌：看是不是停車場（小檔才整個讀）
        else{const{data}=await SF.read({uri:f.uri});processSupport(f.name,unb64(data));}man[f.name]=f.size+':'+f.modified;}catch(err){console.warn(f.name,err);}}
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
    imp=r.ents;grpIdx=null;insCache.clear();impLayers=r.layers;offLy=new Set(r.layers.filter(l=>l.off||(l.hidden&&!l.frozen)).map(l=>l.name));frzLy=new Set(r.layers.filter(l=>l.frozen).map(l=>l.name));syncHid();
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
$('impClear').onclick=()=>{blankName='';if(NATIVE){nativeOn=false;nFit=null;nCache.clear();try{CadNative.clearBase();}catch(_){}}saveDrawNow();imp=[];grpIdx=null;insCache.clear();grid=null;impLayers=[];hidLy.clear();offLy.clear();frzLy.clear();impName='';localStorage.removeItem('simplecad.lastKey');loadDraw('(無底圖)');closeSheet('fileSheet');schedule();};

/* ---------- IndexedDB（最後開的圖） ---------- */
function idb2(){return new Promise((res,rej)=>{try{const r=indexedDB.open('simplecad',2);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('shx'))d.createObjectStore('shx');if(!d.objectStoreNames.contains('files'))d.createObjectStore('files');};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});}
async function idbFile(k,v){try{const d=await idb2();await new Promise(r=>{const t=d.transaction('files','readwrite');const s=t.objectStore('files');v==null?s.delete(k):s.put(v,k);t.oncomplete=t.onerror=()=>r();});}catch(_){}}
async function idbFileGet(k){try{const d=await idb2();return await new Promise(r=>{const t=d.transaction('files','readonly'),q=t.objectStore('files').get(k);q.onsuccess=()=>r(q.result);q.onerror=()=>r(null);});}catch(_){return null;}}

/* ---------- 匯出 DXF（R12，中文用 \U+ 表示） ---------- */
function encDxf(s){let o='';for(const ch of String(s)){const c=ch.codePointAt(0);if(c<128&&c>=32)o+=ch;else if(c>0xffff)o+='?';else o+='\\U+'+c.toString(16).toUpperCase().padStart(4,'0');}return o;}
const nf=v=>{const s=(+v).toFixed(6);return s.replace(/\.?0+$/,'')||'0';};
function buildDXF(only){
  const o=[];const w=(c,v)=>{o.push(String(c).padStart(3,' '));o.push(String(v));};
  const ents=(only||st.ents).filter(e=>['line','pline','ink','circle','arc','text','dim','point','fill'].includes(e.t));
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
  const head=(t,e)=>{w(0,t);w(8,encDxf(e.ly||st.cur));if(e.ci!=null)w(62,e.ci);if(e.lt)w(6,encDxf(e.lt.toUpperCase()));};
  let OX=0,OY=0;const pt=(c,p)=>{w(c,nf(p[0]-OX));w(c+10,nf(p[1]-OY));w(c+20,0);};
  // 圖塊（og 一組）輸出成 BLOCK＋INSERT，CAD 打開還是一個圖塊；圖塊名稱用原本的名稱＋流水號，避免和底圖同名但內容不同
  const G=new Map();for(const e of ents)if(e.og){let l=G.get(e.og);if(!l)G.set(e.og,l=[]);l.push(e);}
  const blk=[];let bn=0;const usedN=new Set();
  for(const[og,L]of G){let ins=null;for(const e of L)if(e.gi){ins=e.gi;break;}
    if(!ins){let b=[1e18,1e18];for(const e of L){const r=entBox(e);if(r){b=[Math.min(b[0],r[0]),Math.min(b[1],r[1])];}}const e0=L[0];ins=b[0]<1e17?b:(e0.a||e0.o||e0.p||(e0.pts&&e0.pts[0])||[0,0]);}
    let base=String(L.find(e=>e.gn)?.gn||'CPY').replace(/[<>\/":;?*|=,`\s]/g,'_').slice(0,24);let nm;do{nm=`${base}_${++bn}`;}while(usedN.has(nm));usedN.add(nm);
    blk.push({nm,ins,L,ly:L[0].ly||st.cur});}
  w(0,'SECTION');w(2,'BLOCKS');
  for(const B of blk){w(0,'BLOCK');w(8,'0');w(2,encDxf(B.nm));w(70,0);w(10,0);w(20,0);w(30,0);w(3,encDxf(B.nm));OX=B.ins[0];OY=B.ins[1];for(const e of B.L)wEnt(e);OX=OY=0;w(0,'ENDBLK');w(8,'0');}
  w(0,'ENDSEC');
  w(0,'SECTION');w(2,'ENTITIES');
  for(const B of blk){w(0,'INSERT');w(8,encDxf(B.ly));w(2,encDxf(B.nm));pt(10,B.ins);}
  for(const e of ents)if(!e.og)wEnt(e);
  w(0,'ENDSEC');w(0,'EOF');
  return o.join('\r\n')+'\r\n';
  function wEnt(e){
    switch(e.t){
      case'line':head('LINE',e);pt(10,e.a);pt(11,e.b);break;
      case'dim':{const L=dist(e.a,e.b);if(!L)break;const h=e.h||st.textH||2,ux=(e.b[0]-e.a[0])/L,uy=(e.b[1]-e.a[1])/L,nx=-uy,ny=ux,off=e.off||0,sg=Math.sign(off)||1;
        const A2=[e.a[0]+nx*off,e.a[1]+ny*off],B2=[e.b[0]+nx*off,e.b[1]+ny*off],ln=(p,q)=>{head('LINE',e);pt(10,p);pt(11,q);};
        if(Math.abs(off)>h*0.3)for(const[P,Q]of[[e.a,A2],[e.b,B2]])ln([P[0]+nx*sg*h*0.25,P[1]+ny*sg*h*0.25],[Q[0]+nx*sg*h*0.5,Q[1]+ny*sg*h*0.5]);
        ln(A2,B2);const tx=(ux+nx)/Math.SQRT2*h*0.5,ty=(uy+ny)/Math.SQRT2*h*0.5;for(const P of[A2,B2])ln([P[0]-tx,P[1]-ty],[P[0]+tx,P[1]+ty]);
        let ang=Math.atan2(uy,ux);if(Math.cos(ang)<-1e-6)ang+=Math.PI;const m=midp(A2,B2),tp=[m[0]-Math.sin(ang)*h*0.4,m[1]+Math.cos(ang)*h*0.4];
        head('TEXT',e);pt(10,tp);w(40,nf(h));w(1,fmt(L));w(50,nf(normA(deg(ang))));w(7,'STANDARD');w(72,1);pt(11,tp);break;}
      case'pline':case'ink':head('POLYLINE',e);w(66,1);pt(10,[OX,OY]);w(70,e.closed?1:0);
        if(e.av)e.av.forEach((p,i)=>{w(0,'VERTEX');w(8,encDxf(e.ly||st.cur));pt(10,p);if(e.bu&&e.bu[i])w(42,nf(e.bu[i]));w(70,0);});
        else for(const p of e.pts){w(0,'VERTEX');w(8,encDxf(e.ly||st.cur));pt(10,p);w(70,0);}w(0,'SEQEND');w(8,encDxf(e.ly||st.cur));break;
      case'circle':head('CIRCLE',e);pt(10,e.o);w(40,nf(e.r));break;
      case'arc':head('ARC',e);pt(10,e.o);w(40,nf(e.r));w(50,nf(normA(deg(e.a0))));w(51,nf(normA(deg(e.a1))));break;
      case'text':e.lines.forEach((ln,i)=>{head('TEXT',e);const off=(e.y0||0)+i*(e.ls||e.h*1.667),r=e.rot||0,p=[e.p[0]+Math.sin(r)*off,e.p[1]-Math.cos(r)*off];pt(10,p);w(40,nf(e.h));w(1,encDxf(ln));w(50,nf(normA(deg(r))));if(e.wf&&e.wf!==1)w(41,nf(e.wf));w(7,'STANDARD');if(e.ha){w(72,e.ha);pt(11,p);}});break;
      case'point':head('POINT',e);pt(10,e.p);break;
      case'fill':for(const r of e.rings){if(r.length===3||r.length===4){head('SOLID',e);pt(10,r[0]);pt(11,r[1]);pt(12,r[r.length-1]);pt(13,r.length===4?r[2]:r[2]);}
        else{head('POLYLINE',e);w(66,1);pt(10,[OX,OY]);w(70,1);for(const p of r){w(0,'VERTEX');w(8,encDxf(e.ly||st.cur));pt(10,p);w(70,0);}w(0,'SEQEND');w(8,encDxf(e.ly||st.cur));}}break;
    }
  }
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

/* ---------- 依圖幅匯出（2026-11-23）：選整幅或分圖幅（-1 左下、-2 左上、-3 右上、-4 右下），每幅一個 DXF；兩幅以上包 ZIP ---------- */
let efQuad=localStorage.getItem('efQuad')==='1',efPick=false,efFor='';const efSel=new Map();// key `${id}|${q}` → {id,num,q}
function efLoad(){if(efFor===impName)return;efFor=impName;efSel.clear();try{for(const x of JSON.parse(localStorage.getItem('efSel:'+impName)||'[]'))efSel.set(x.id+'|'+x.q,x);}catch(_){}}
function efSave(){try{localStorage.setItem('efSel:'+impName,JSON.stringify([...efSel.values()]));}catch(_){}efUpd();}
const efName=x=>(x.num||x.id)+(x.q?'-'+x.q:'');
function efBox(x){const f=sheetFrames().find(f=>f.id===x.id);if(!f)return null;const[x0,y0,x1,y1]=f.b,xm=(x0+x1)/2,ym=(y0+y1)/2;
  return x.q===1?[x0,y0,xm,ym]:x.q===2?[x0,ym,xm,y1]:x.q===3?[xm,ym,x1,y1]:x.q===4?[xm,y0,x1,ym]:f.b;}
function efUpd(){efLoad();$('efWhole').classList.toggle('on',!efQuad);$('efQuad').classList.toggle('on',efQuad);
  const L=[...efSel.values()].sort((a,b)=>efName(a).localeCompare(efName(b),'zh-Hant',{numeric:true}));
  $('efInfo').textContent=!imp.length?'還沒開底圖（沒有圖框的請用上面的「另存新檔」）':!sheetFrames().length?'這張圖沒有圖框圖層，請用上面的「另存新檔」':L.length?`${L.length} 幅：${L.map(efName).join('、')}`:'還沒選';
  $('efClear').disabled=!efSel.size;$('efSave').disabled=$('efShare').disabled=!efSel.size;}
const efQ=(f,w)=>{const xm=(f.b[0]+f.b[2])/2,ym=(f.b[1]+f.b[3])/2;return w[0]<xm?(w[1]<ym?1:2):(w[1]<ym?4:3);};
function efTap(w){const f=sheetAt(w);if(!f){toast('那裡不在任何圖框裡');return;}const q=efQuad?efQ(f,w):0,k=f.id+'|'+q;
  if(efSel.has(k))efSel.delete(k);else efSel.set(k,{id:f.id,num:f.num,q});efSave();efHint();schedule();}
function efHint(){setHint(`點圖框${efQuad?'裡的四分之一':'裡面'}選／取消（已選 ${efSel.size} 幅）`,true,{t:'完成',f:efEnd});}
function efEnd(){efPick=false;setHint(baseHintText(),false);schedule();openSheet('expFrSheet');efUpd();}
function drawEf(){if(!efPick)return;ctx.save();ctx.lineWidth=3;ctx.strokeStyle='#4fc3f7';ctx.font='bold 16px sans-serif';ctx.textAlign='center';
  if(efQuad){ctx.setLineDash([6,6]);ctx.lineWidth=1.5;for(const f of sheetFrames()){const a=toS([(f.b[0]+f.b[2])/2,f.b[3]]),b=toS([(f.b[0]+f.b[2])/2,f.b[1]]),c=toS([f.b[0],(f.b[1]+f.b[3])/2]),d=toS([f.b[2],(f.b[1]+f.b[3])/2]);
    ctx.beginPath();ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);ctx.moveTo(c[0],c[1]);ctx.lineTo(d[0],d[1]);ctx.stroke();}ctx.setLineDash([]);ctx.lineWidth=3;}
  for(const x of efSel.values()){const b=efBox(x);if(!b)continue;const a=toS([b[0],b[3]]),c=toS([b[2],b[1]]);ctx.fillStyle='rgba(79,195,247,0.15)';ctx.fillRect(a[0],a[1],c[0]-a[0],c[1]-a[1]);ctx.strokeRect(a[0],a[1],c[0]-a[0],c[1]-a[1]);
    ctx.fillStyle='#4fc3f7';ctx.fillText(efName(x),(a[0]+c[0])/2,(a[1]+c[1])/2);}
  ctx.restore();}
// 碰到判斷：線段和矩形相交（含整段在裡面）
function segHitBox(ax,ay,bx,by,B){if(Math.max(ax,bx)<B[0]||Math.min(ax,bx)>B[2]||Math.max(ay,by)<B[1]||Math.min(ay,by)>B[3])return false;
  const ins=(x,y)=>x>=B[0]&&x<=B[2]&&y>=B[1]&&y<=B[3];if(ins(ax,ay)||ins(bx,by))return true;
  const cr=(x1,y1,x2,y2,x3,y3,x4,y4)=>{const d=(x2-x1)*(y4-y3)-(y2-y1)*(x4-x3);if(!d)return false;const t=((x3-x1)*(y4-y3)-(y3-y1)*(x4-x3))/d,u=((x3-x1)*(y2-y1)-(y3-y1)*(x2-x1))/d;return t>=0&&t<=1&&u>=0&&u<=1;};
  return cr(ax,ay,bx,by,B[0],B[1],B[2],B[1])||cr(ax,ay,bx,by,B[2],B[1],B[2],B[3])||cr(ax,ay,bx,by,B[2],B[3],B[0],B[3])||cr(ax,ay,bx,by,B[0],B[3],B[0],B[1]);}
function entHitBox(e,B){if(e.t==='text'||e.t==='point'){const p=e.p;return p[0]>=B[0]&&p[0]<=B[2]&&p[1]>=B[1]&&p[1]<=B[3];}
  const r=entBox(e);if(!r||r[2]<B[0]||r[0]>B[2]||r[3]<B[1]||r[1]>B[3])return false;
  if(e.t==='line')return segHitBox(e.a[0],e.a[1],e.b[0],e.b[1],B);
  if(e.t==='pline'||e.t==='ink'){const P=e.av||e.pts;for(let i=1;i<P.length;i++)if(segHitBox(P[i-1][0],P[i-1][1],P[i][0],P[i][1],B))return true;if(e.closed&&P.length>2&&segHitBox(P[P.length-1][0],P[P.length-1][1],P[0][0],P[0][1],B))return true;return P.length===1&&segHitBox(P[0][0],P[0][1],P[0][0],P[0][1],B);}
  if(e.t==='fill')return e.rings.some(R=>R.some((p,i)=>segHitBox(R[(i||R.length)-1][0],R[(i||R.length)-1][1],p[0],p[1],B)));
  return true;}// 圓、弧、標註：外框有碰到就算
function efEnts(B){const out=new Set(),grp=new Map();for(const e of st.ents)if(e.og){let l=grp.get(e.og);if(!l)grp.set(e.og,l=[]);l.push(e);}
  for(const e of st.ents){if(out.has(e))continue;if(!entHitBox(e,B))continue;if(e.og)for(const m of grp.get(e.og))out.add(m);else out.add(e);}// 圖塊整組
  return st.ents.filter(e=>out.has(e));}
// 不壓縮的 ZIP（store），檔名 UTF-8
function zipStore(files){const crcT=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;crcT[n]=c>>>0;}
  const crc=b=>{let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=crcT[(c^b[i])&255]^(c>>>8);return(c^0xFFFFFFFF)>>>0;};
  const te=new TextEncoder(),parts=[],cen=[];let off=0;const d=new Date(),dt=((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1)),dd=(((d.getFullYear()-1980)<<9)|((d.getMonth()+1)<<5)|d.getDate());
  for(const f of files){const nm=te.encode(f.name),c=crc(f.data),n=f.data.length;const h=new DataView(new ArrayBuffer(30));
    h.setUint32(0,0x04034b50,true);h.setUint16(4,20,true);h.setUint16(6,0x0800,true);h.setUint16(8,0,true);h.setUint16(10,dt,true);h.setUint16(12,dd,true);h.setUint32(14,c,true);h.setUint32(18,n,true);h.setUint32(22,n,true);h.setUint16(26,nm.length,true);h.setUint16(28,0,true);
    parts.push(new Uint8Array(h.buffer),nm,f.data);const C=new DataView(new ArrayBuffer(46));
    C.setUint32(0,0x02014b50,true);C.setUint16(4,20,true);C.setUint16(6,20,true);C.setUint16(8,0x0800,true);C.setUint16(10,0,true);C.setUint16(12,dt,true);C.setUint16(14,dd,true);C.setUint32(16,c,true);C.setUint32(20,n,true);C.setUint32(24,n,true);C.setUint16(28,nm.length,true);C.setUint32(42,off,true);
    cen.push(new Uint8Array(C.buffer),nm);off+=30+nm.length+n;}
  const cs=cen.reduce((a,b)=>a+b.length,0),E=new DataView(new ArrayBuffer(22));E.setUint32(0,0x06054b50,true);E.setUint16(8,files.length,true);E.setUint16(10,files.length,true);E.setUint32(12,cs,true);E.setUint32(16,off,true);
  const all=[...parts,...cen,new Uint8Array(E.buffer)],tot=all.reduce((a,b)=>a+b.length,0),z=new Uint8Array(tot);let p=0;for(const a of all){z.set(a,p);p+=a.length;}return z;}
async function efExport(share){efLoad();const L=[...efSel.values()].sort((a,b)=>efName(a).localeCompare(efName(b),'zh-Hant',{numeric:true}));if(!L.length)return;
  const te=new TextEncoder(),files=[],empty=[];for(const x of L){const B=efBox(x);if(!B){empty.push(efName(x));continue;}const E=efEnts(B);if(!E.length){empty.push(efName(x));continue;}files.push({name:efName(x)+'.dxf',data:te.encode(buildDXF(E)),n:E.length});}
  if(!files.length){toast('選的圖幅裡都沒有你畫的東西',3500);return;}
  const z=n=>String(n).padStart(2,'0'),d=new Date(),stamp=`${d.getFullYear()}${z(d.getMonth()+1)}${z(d.getDate())}_${z(d.getHours())}${z(d.getMinutes())}`;
  let name,bytes,mime;if(files.length===1){name=files[0].name.replace(/\.dxf$/,`_${stamp}.dxf`);bytes=files[0].data;mime='application/dxf';}
  else{name=`圖幅匯出_${files.length}幅_${stamp}.zip`;bytes=zipStore(files.map(f=>({name:f.name,data:f.data})));mime='application/zip';}
  const msg=`${files.map(f=>f.name.replace('.dxf','')+`（${f.n}）`).join('、')}`+(empty.length?`；沒東西略過：${empty.join('、')}`:'');
  const data=b64(bytes),P=NP();
  try{if(!share&&P.SupportFolder&&P.SupportFolder.saveAs){await P.SupportFolder.saveAs({name,data,mime});toast('已存檔：'+name+'\n'+msg,5000);return;}
    if(P.Filesystem&&P.Share){const r=await P.Filesystem.writeFile({path:name,data,directory:'CACHE'});await P.Share.share({title:name,files:[r.uri],dialogTitle:'分享'});toast(msg,4000);return;}
    const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([bytes],{type:mime}));a.download=name;document.body.appendChild(a);a.click();a.remove();toast('已下載：'+name+'\n'+msg,5000);}
  catch(err){if(!/cancel/i.test(err.message||''))toast('匯出失敗：'+(err.message||err),4000);}}
$('expByFr').onclick=()=>{closeSheet('fileSheet');efFor='';efUpd();openSheet('expFrSheet');};
$('efWhole').onclick=()=>{efQuad=false;localStorage.setItem('efQuad','0');efUpd();};
$('efQuad').onclick=()=>{efQuad=true;localStorage.setItem('efQuad','1');efUpd();};
$('efPick').onclick=()=>{if(!sheetFrames().length){toast('這張圖沒有圖框圖層');return;}efLoad();closeSheet('expFrSheet');efPick=true;efHint();schedule();};
$('efClear').onclick=()=>{efLoad();efSel.clear();efSave();schedule();};
$('efGo').onclick=()=>{efLoad();const F=sheetFrames();if(!F.length){toast('這張圖沒有圖框圖層');return;}
  const want=$('efIn').value.split(/[\s,，、;；]+/).map(x=>x.trim()).filter(Boolean),miss=[];let add=0;
  for(const w of want){const m=w.match(/^(.+?)(?:[-－](\d))?$/),num=m[1],qq=m[2]?+m[2]:null;const f=F.find(f=>f.num===num);if(!f||(qq!=null&&(qq<1||qq>4))){miss.push(w);continue;}
    const qs=qq!=null?[qq]:efQuad?[1,2,3,4]:[0];for(const q of qs){const k=f.id+'|'+q;if(!efSel.has(k)){efSel.set(k,{id:f.id,num:f.num,q});add++;}}}
  efSave();$('efIn').value='';schedule();toast((miss.length?`找不到：${miss.join('、')}。`:'')+`加入 ${add} 幅，共 ${efSel.size} 幅`,2500);};
$('efSave').onclick=()=>efExport(false);$('efShare').onclick=()=>efExport(true);
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
  const lk=localStorage.getItem('simplecad.lastKey');if(!(await cadIntent())&&lk)await openRecent(lk,true);
  schedule();
})();
window.__cad={get cmd(){return cmd;},get cur(){return cur;},get st(){return st;},get imp(){return imp;},get lts(){return lts;},schedule,zoomFit,shxFiles:()=>shxFiles,buildDXF,tm2ll,set view(v){st.view=v;},get view(){return st.view;}};
document.querySelectorAll('#penW [data-w]').forEach(b=>b.onclick=()=>{st.inkW=+b.dataset.w;fillPenW();saveSettings();buildPenBar();});

/* ---------- 程式版本、網頁程式自動更新（只有 APK；Bench 網頁版本來就是讀網路上最新的） ---------- */
{let webInfo=null,webPend=null;
  const updVer=()=>{const el=$('verInfo');if(!el||!webInfo)return;
    let t=`網頁程式 ${webInfo.web}（${webInfo.src==='update'?'自動更新':'APK 內建'}）／APK ${webInfo.apk}`;
    const pend=webPend&&webPend.st==='ready'?webPend.ver:webInfo.pending;if(pend)t+=`。新版 ${pend} 已下載，下次開 App 生效`;
    const need=webPend&&webPend.st==='needApk'?webPend.ver:webInfo.needApk;if(need)t+=`。新版 ${need} 要重新安裝 APK`;
    el.textContent=t;$('verApply').style.display=pend?'':'none';};
  if(window.CadNative&&CadNative.webInfo){
    try{webInfo=JSON.parse(CadNative.webInfo());}catch(_){}
    $('verSec').style.display='';updVer();
    if(webInfo&&webInfo.justUpdated)setTimeout(()=>toast(`已自動更新到 ${webInfo.web}`,3000),1500);
    if(webInfo&&webInfo.rolledBack)setTimeout(()=>toast('新版網頁程式開不起來，已退回原本的版本',4000),1500);
    window.__webUpd=r=>{webPend=r;updVer();toast(r.st==='ready'?`新版 ${r.ver} 已下載，下次開 App 生效（設定裡可以馬上套用）`:`新版 ${r.ver} 要重新安裝 APK`,4000);};
    $('verCheck').onclick=async()=>{$('verInfo').textContent='檢查中…';let r=null;try{r=await CadCall('Web','check',{});}catch(e){r={st:'err',msg:String(e.message||e)};}
      if(r.st==='ready'||r.st==='needApk')webPend=r;updVer();toast(r.st==='err'?'檢查失敗：'+r.msg:r.msg,3000);};
    $('verApply').onclick=()=>{if(confirm('重新載入，換成新版網頁程式？'))CadCall('Web','apply',{});};
    $('verReset').onclick=()=>{if(confirm('還原成 APK 內建的網頁程式？（圖和設定不受影響）'))CadCall('Web','reset',{});};
    // 跑到這裡代表程式載入正常；3 秒後回報，沒回報的新版下次開 App 會退回
    setTimeout(()=>{try{CadNative.webOk&&CadNative.webOk();}catch(_){}},3000);}
}
