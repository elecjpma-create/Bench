const $=id=>document.getElementById(id);
const cv=$('c');let ctx=cv.getContext('2d');const mainCtx=ctx;
let W=0,H=0,DPR=1;
/* ---------- 顏色（AutoCAD 索引色） ---------- */
function hsv2hex(h,s,v){const f=n=>{const k=(n+h/60)%6;return v-v*s*Math.max(0,Math.min(k,4-k,1));};const to=x=>Math.round(x*255).toString(16).padStart(2,'0');return'#'+to(f(5))+to(f(3))+to(f(1));}
const ACI_BASE={1:'#ff0000',2:'#ffff00',3:'#00ff00',4:'#00ffff',5:'#0000ff',6:'#ff00ff',7:'#ffffff',8:'#808080',9:'#c0c0c0',250:'#333333',251:'#505050',252:'#696969',253:'#828282',254:'#bebebe',255:'#ffffff'};
function aciHex(i){i=Math.abs(i|0);if(ACI_BASE[i])return ACI_BASE[i];if(i>=10&&i<=249){const h=Math.floor((i-10)/10)*15,k=(i-10)%10;return hsv2hex(h,k%2?.5:1,[1,1,.8,.8,.6,.6,.5,.5,.3,.3][k]);}return'#ffffff';}
// 7 號色：黑底顯示白、白底顯示黑
function colorFor(c){if(st.bg==='white'){if(c==='#ffffff')return'#000000';if(c==='#ffff00')return'#b8a000';}return c;}

/* ---------- 內建線型（取自 acad.lin 常用定義） ---------- */
const BUILTIN=`*BORDER,Border __ __ . __ __ . __ __ .
A,.5,-.25,.5,-.25,0,-.25
*CENTER,Center ____ _ ____ _ ____ _
A,1.25,-.25,.25,-.25
*DASHDOT,Dash dot __ . __ . __ . __
A,.5,-.25,0,-.25
*DASHED,Dashed __ __ __ __ __
A,.5,-.25
*DIVIDE,Divide ____ . . ____ . . ____
A,.5,-.25,0,-.25,0,-.25
*DOT,Dot . . . . . . . . . .
A,0,-.25
*HIDDEN,Hidden __ __ __ __ __
A,.25,-.125
*PHANTOM,Phantom ______  __  __  ______
A,1.25,-.25,.25,-.25,.25,-.25
*GAS_LINE,Gas line ----GAS----GAS----
A,.5,-.2,["GAS",STANDARD,S=.1,R=0.0,X=-0.1,Y=-.05],-.25
*HOT_WATER_SUPPLY,Hot water supply ---- HW ---- HW ----
A,.5,-.2,["HW",STANDARD,S=.1,R=0.0,X=-0.1,Y=-.05],-.2`;

const COLORS=['#ffffff','#ff5252','#ffd54a','#5cff8a','#4fe0ff','#4f7dff','#ff5cff','#ff9f40','#9aa1ab'];
const OSN=[['end','端點'],['mid','中點'],['cen','圓心'],['qua','象限點'],['int','交點'],['app','外觀交點'],['per','垂足'],['ins','插入點'],['nod','節點'],['nea','最近點']];
const SNAPNAME=Object.fromEntries(OSN);
// 沒存過設定時的預設鎖點
const OSM_DEF={end:true,mid:true,cen:true,qua:true,int:true,app:false,per:true,ins:true,nod:true,nea:true};


/* ---------- 線型檔解析 ---------- */
function splitTop(s){const out=[];let d=0,q=false,b='';for(const ch of s){if(ch==='"')q=!q;if(!q){if(ch==='[')d++;if(ch===']')d--;}if(ch===','&&d===0&&!q){out.push(b.trim());b='';}else b+=ch;}if(b.trim())out.push(b.trim());return out;}
function parsePattern(s){
  const els=[];
  for(const t of splitTop(s)){
    if(t[0]==='['){
      const parts=splitTop(t.replace(/^\[|\]$/g,''));
      const el={k:'shape',s:1,r:0,abs:false,up:false,x:0,y:0};
      const f=parts[0]||'';
      if(/^".*"$/.test(f)){el.k='text';el.str=f.slice(1,-1);}else{el.name=f.trim();el.file=(parts[1]||'').trim();}
      for(const p of parts.slice(1)){
        const m=p.match(/^([SRAUXY])\s*=\s*([-+]?[\d.]+(?:e[-+]?\d+)?)/i);if(!m)continue;
        const key=m[1].toUpperCase(),v=parseFloat(m[2]);
        if(key==='S')el.s=v;else if(key==='R')el.r=v;else if(key==='A'){el.r=v;el.abs=true;}else if(key==='U'){el.r=v;el.up=true;}else if(key==='X')el.x=v;else if(key==='Y')el.y=v;
      }
      els.push(el);
    }else{const v=parseFloat(t);if(!isNaN(v))els.push({k:'len',v});}
  }
  return els;
}
function finishLT(lt){lt.total=lt.els.reduce((a,e)=>a+(e.k==='len'?Math.abs(e.v):0),0);lt.hasText=lt.els.some(e=>e.k==='text');lt.hasShape=lt.els.some(e=>e.k==='shape');return lt;}
function parseLin(text){
  const out=[];const lines=text.replace(/^﻿/,'').split(/\r?\n/);let cur=null;
  for(let i=0;i<lines.length;i++){
    let l=lines[i].trim();if(!l||l.startsWith(';;'))continue;
    if(l[0]==='*'){const c=l.indexOf(',');cur={name:l.slice(1).split(/[,\s]/)[0].trim().toUpperCase(),desc:c<0?'':l.slice(c+1).trim()};continue;}
    if(cur&&/^A\s*,/i.test(l)){
      while(l.endsWith(',')&&i+1<lines.length)l+=lines[++i].trim();
      cur.els=parsePattern(l.replace(/^A\s*,/i,''));
      if(cur.els.length)out.push(finishLT(cur));cur=null;
    }
  }
  return out;
}
function mergeLT(list){for(const lt of list){const i=lts.findIndex(x=>x.name===lt.name);if(i>=0)lts[i]=lt;else lts.push(lt);}}
function getLT(n){return lts.find(x=>x.name===(n||'').toUpperCase())||lts[0];}

/* ---------- 幾何工具 ---------- */
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const midp=(a,b)=>[(a[0]+b[0])/2,(a[1]+b[1])/2];
function closestOnSeg(p,a,b){const dx=b[0]-a[0],dy=b[1]-a[1],L=dx*dx+dy*dy;if(!L)return a.slice();let t=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/L;t=Math.max(0,Math.min(1,t));return[a[0]+t*dx,a[1]+t*dy];}
function segSeg(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12)return[];const q=[c[0]-a[0],c[1]-a[1]],t=(q[0]*s[1]-q[1]*s[0])/den,u=(q[0]*r[1]-q[1]*r[0])/den,e=1e-9;if(t<-e||t>1+e||u<-e||u>1+e)return[];return[[a[0]+t*r[0],a[1]+t*r[1]]];}
function segCirc(a,b,o,R){const dx=b[0]-a[0],dy=b[1]-a[1],fx=a[0]-o[0],fy=a[1]-o[1],A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-R*R,D=B*B-4*A*C;if(D<0||!A)return[];const q=Math.sqrt(D);return[(-B-q)/(2*A),(-B+q)/(2*A)].filter(t=>t>=-1e-9&&t<=1+1e-9).map(t=>[a[0]+t*dx,a[1]+t*dy]);}
function circCirc(o1,r1,o2,r2){const d=dist(o1,o2);if(!d||d>r1+r2||d<Math.abs(r1-r2))return[];const a=(r1*r1-r2*r2+d*d)/(2*d),h=Math.sqrt(Math.max(0,r1*r1-a*a)),ux=(o2[0]-o1[0])/d,uy=(o2[1]-o1[1])/d,px=o1[0]+a*ux,py=o1[1]+a*uy;return[[px-h*uy,py+h*ux],[px+h*uy,py-h*ux]];}
function inters(e1,e2){
  if(e1.t==='line'&&e2.t==='line')return segSeg(e1.a,e1.b,e2.a,e2.b);
  if(e1.t==='line'&&e2.t==='circle')return segCirc(e1.a,e1.b,e2.o,e2.r);
  if(e1.t==='circle'&&e2.t==='line')return segCirc(e2.a,e2.b,e1.o,e1.r);
  if(e1.t==='circle'&&e2.t==='circle')return circCirc(e1.o,e1.r,e2.o,e2.r);
  return[];
}
function dms(az){let d=Math.floor(az),mf=(az-d)*60,m=Math.floor(mf),s=Math.round((mf-m)*60);if(s===60){s=0;m++;}if(m===60){m=0;d++;}if(d>=360)d-=360;return d+'°'+String(m).padStart(2,'0')+"'"+String(s).padStart(2,'0')+'"';}
function azimuth(a,b){let az=Math.atan2(b[0]-a[0],b[1]-a[1])*180/Math.PI;if(az<0)az+=360;return az;}

/* ---------- 視圖 ---------- */
const TAU=Math.PI*2;
function sweepOf(a0,a1){let s=((a1-a0)%TAU+TAU)%TAU;return s||TAU;}
function inRange(a,a0,a1){const x=((a-a0)%TAU+TAU)%TAU;return x<=sweepOf(a0,a1)+1e-9;}
function arcEnds(e){return[[e.o[0]+e.r*Math.cos(e.a0),e.o[1]+e.r*Math.sin(e.a0)],[e.o[0]+e.r*Math.cos(e.a1),e.o[1]+e.r*Math.sin(e.a1)]];}
function charW(ch){return ch.charCodeAt(0)>255?1.05:0.62;}
function textRect(e){
  if(e.rc)return e.rc;
  if(e.vert){const n=[...e.lines.join('')].length;return e.rc=[-0.1*e.h,1.1*e.h,-n*1.25*e.h,0.1*e.h];}
  let wmax=0;for(const l of e.lines){let w=0;for(const ch of l)w+=charW(ch);wmax=Math.max(wmax,w);}
  const wid=wmax*e.h*(e.wf||1),x0=-wid*[0,.5,1][e.ha||0];
  return e.rc=[x0,x0+wid,-(e.y0+(e.lines.length-1)*e.ls)-0.25*e.h,-e.y0+e.h];
}
function textLocal(e,w){const dx=w[0]-e.p[0],dy=w[1]-e.p[1],c=Math.cos(e.rot),s=Math.sin(e.rot);return[dx*c+dy*s,-dx*s+dy*c];}
function polyLen(pts,closed){let L=0;for(let i=1;i<pts.length;i++)L+=dist(pts[i-1],pts[i]);if(closed&&pts.length>2)L+=dist(pts[pts.length-1],pts[0]);return L;}
function polyArea(pts){let a=0;for(let i=0;i<pts.length;i++){const p=pts[i],q=pts[(i+1)%pts.length];a+=p[0]*q[1]-q[0]*p[1];}return Math.abs(a)/2;}
function entBox(e){
  if(e.bb)return e.bb;
  let pts;
  if(e.t==='line'||e.t==='dim')pts=[e.a,e.b];
  else if(e.t==='circle'||e.t==='arc')pts=[[e.o[0]-e.r,e.o[1]-e.r],[e.o[0]+e.r,e.o[1]+e.r]];
  else if(e.t==='point')pts=[e.p];
  else if(e.t==='text'){const r=textRect(e),c=Math.cos(e.rot),s=Math.sin(e.rot);pts=[[r[0],r[2]],[r[1],r[2]],[r[0],r[3]],[r[1],r[3]]].map(([x,y])=>[e.p[0]+x*c-y*s,e.p[1]+x*s+y*c]);}
  else if(e.t==='fill')pts=e.rings.flat();
  else pts=e.pts;
  let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(const p of pts){if(p[0]<x0)x0=p[0];if(p[1]<y0)y0=p[1];if(p[0]>x1)x1=p[0];if(p[1]>y1)y1=p[1];}
  return[x0,y0,x1,y1];
}

/* ---------- SHX 形狀檔 ---------- */
const SHX_DX=[1,1,1,.5,0,-.5,-1,-1,-1,-1,-1,-.5,0,.5,1,1],SHX_DY=[0,.5,1,1,1,1,1,.5,0,-.5,-1,-1,-1,-1,-1,-.5];
let shxFiles={};// 檔名(大寫) -> {name, byName, byNum, b64}
function parseShx(bytes,fname){
  let i=0;while(i<bytes.length&&bytes[i]!==0x1a)i++;
  const head=new TextDecoder('latin1').decode(bytes.subarray(0,i));i++;
  const dv=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  const f={name:fname.toUpperCase().replace(/^.*[\\/]/,''),byName:{},byNum:{},type:'shapes',bytes};
  const mk=(num,b)=>{let z=0;while(z<b.length&&b[z]!==0)z++;
    const nm=new TextDecoder('big5').decode(b.subarray(0,z)).trim().toUpperCase();
    const sh={num,name:nm,code:b.subarray(z+1),polys:null};f.byNum[num]=sh;if(nm&&!f.byName[nm])f.byName[nm]=sh;return sh;};
  if(/unifont/i.test(head)){
    f.type='unifont';const n=dv.getUint32(i,true),dl=dv.getUint16(i+4,true);i+=6;
    const info=bytes.subarray(i,i+dl);i+=dl;let z=0;while(z<info.length&&info[z]!==0)z++;
    f.above=info[z+1]||1;f.below=info[z+2]||0;f.isFont=true;
    for(let k=0;k<n&&i+4<=bytes.length;k++){const num=dv.getUint16(i,true),len=dv.getUint16(i+2,true);i+=4;mk(num,bytes.subarray(i,i+len));i+=len;}
  }else if(/bigfont/i.test(head)){
    f.type='bigfont';const n=dv.getUint16(i+2,true),nr=dv.getUint16(i+4,true);i+=6+nr*4;
    f.idx=new Map();
    for(let k=0;k<n&&i+8<=bytes.length;k++){const num=dv.getUint16(i,true),len=dv.getUint16(i+2,true),off=dv.getUint32(i+4,true);i+=8;if(len&&off)f.idx.set(num,[off,len]);}
    const z0=f.idx.get(0);if(z0){const b=bytes.subarray(z0[0],z0[0]+z0[1]);let z=0;while(z<b.length&&b[z]!==0)z++;f.above=b[z+1]||1;}else f.above=1;
    f.isFont=true;
  }else if(/shapes/i.test(head)){
    const n=dv.getUint16(i+4,true);i+=6;
    const idx=[];for(let k=0;k<n;k++){idx.push([dv.getUint16(i,true),dv.getUint16(i+2,true)]);i+=4;}
    for(const[num,len]of idx){mk(num,bytes.subarray(i,i+len));i+=len;}
    const z0=f.byNum[0];if(z0&&z0.code.length>=2){f.isFont=true;f.above=z0.code[0]||1;f.below=z0.code[1]||0;}
  }else throw new Error('不是 SHX 檔');
  return f;
}
function shxShape(file,num){
  if(file.type!=='bigfont')return file.byNum[num];
  if(!file.cache)file.cache=new Map();
  if(file.cache.has(num))return file.cache.get(num);
  const ix=file.idx.get(num);let sh=null;
  if(ix){const b=file.bytes.subarray(ix[0],ix[0]+ix[1]);let z=0;while(z<b.length&&b[z]!==0)z++;sh={num,name:'',code:b.subarray(z+1),polys:null};}
  file.cache.set(num,sh);return sh;
}
const s8=v=>v>127?v-256:v;
function shxVert(sh,file){
  if(sh.vpolys)return sh.vpolys;
  const r=shxRun(sh,file,false,true);sh.vpolys=r.polys;sh.vadv=[r.adv,r.advY];return sh.vpolys;
}
function shxPolys(sh,file){
  if(sh.polys)return sh.polys;
  let r=shxRun(sh,file,false);
  // 有些形狀檔開頭抬筆後就沒再下筆（AutoCAD 仍會畫出），這種情況第一次移動後自動下筆
  if(!r.polys.length&&!file.isFont)r=shxRun(sh,file,true);
  sh.polys=r.polys;sh.adv=r.adv;
  return sh.polys;
}
function shxRun(sh,file,autoPen,vert){
  const S={x:0,y:0,pen:true,sc:1,stack:[],polys:[],cur:null,moved:false};
  const lineTo=(nx,ny)=>{if(autoPen&&!S.pen&&S.moved){S.pen=true;S.cur=null;}S.moved=true;if(S.pen){if(!S.cur){S.cur=[[S.x,S.y]];S.polys.push(S.cur);}S.cur.push([nx,ny]);}S.x=nx;S.y=ny;};
  const arc=(cx,cy,r,a0,sw)=>{const n=Math.max(4,Math.ceil(Math.abs(sw)/(Math.PI/16)));for(let k=1;k<=n;k++){const a=a0+sw*k/n;lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));}};
  const bulge=(dx,dy,bg)=>{dx*=S.sc;dy*=S.sc;const b=bg/127;if(!b){lineTo(S.x+dx,S.y+dy);return;}
    const th=4*Math.atan(b),c=Math.hypot(dx,dy),r=c/(2*Math.sin(th/2)),h=r*Math.cos(th/2),cx=S.x+dx/2-dy/c*h,cy=S.y+dy/2+dx/c*h,a0=Math.atan2(S.y-cy,S.x-cx);arc(cx,cy,Math.abs(r),a0,th);};
  function run(code,depth){
    let i=0;
    const step=()=>{
      const b=code[i++];
      if(b===undefined||b===0)return false;
      if(b>=0x10){const L=(b>>4)*S.sc,d=b&15;lineTo(S.x+SHX_DX[d]*L,S.y+SHX_DY[d]*L);return true;}
      switch(b){
        case 1:S.pen=true;S.cur=null;break;
        case 2:S.pen=false;S.cur=null;break;
        case 3:S.sc/=code[i++]||1;break;
        case 4:S.sc*=code[i++];break;
        case 5:S.stack.push([S.x,S.y]);break;
        case 6:{const p=S.stack.pop();if(p){S.x=p[0];S.y=p[1];}S.cur=null;break;}
        case 7:{
          if(file.type==='unifont'){const n=(code[i]<<8)|code[i+1];i+=2;const sub=shxShape(file,n);if(sub&&depth<8)run(sub.code,depth+1);}
          else if(file.type==='bigfont'){let n=code[i++];
            if(n===0){n=(code[i]<<8)|code[i+1];i+=2;const ox=code[i++],oy=code[i++],w=code[i++],h=code[i++];const sub=shxShape(file,n);
              if(sub&&depth<8){const sx=S.x,sy=S.y,sc=S.sc,pen=S.pen;S.x+=ox*sc;S.y+=oy*sc;S.sc=sc*(h||file.above)/(file.above||1);S.cur=null;run(sub.code,depth+1);S.x=sx;S.y=sy;S.sc=sc;S.pen=pen;S.cur=null;}}
            else{n=(n<<8)|code[i++];const sub=shxShape(file,n);if(sub&&depth<8)run(sub.code,depth+1);}}
          else{const n=code[i++],sub=file.byNum[n];if(sub&&depth<8)run(sub.code,depth+1);}
          break;}
        case 8:{const dx=s8(code[i++]),dy=s8(code[i++]);lineTo(S.x+dx*S.sc,S.y+dy*S.sc);break;}
        case 9:for(;;){const dx=s8(code[i++]),dy=s8(code[i++]);if(!dx&&!dy)break;lineTo(S.x+dx*S.sc,S.y+dy*S.sc);if(i>=code.length)break;}break;
        // 八分圓弧的方向位元組是「正負號＋數值」：最高位元代表順時針，不是二補數
        case 10:{const r=code[i++]*S.sc,o=code[i++],cw=(o&0x80)!==0,oo=o&0x7f,s=(oo>>4)&7,c=(oo&7)||8,a0=s*Math.PI/4,sw=c*Math.PI/4*(cw?-1:1);
          arc(S.x-r*Math.cos(a0),S.y-r*Math.sin(a0),r,a0,sw);break;}
        case 11:{const so=code[i++],eo=code[i++],r=(code[i++]*256+code[i++])*S.sc,o=code[i++],cw=(o&0x80)!==0,oo=o&0x7f,s=(oo>>4)&7,c=(oo&7)||8,u=Math.PI/4,dir=cw?-1:1;
          const a0=(s*u+dir*so*u/256),a1=eo?((s+dir*(c-1))*u+dir*eo*u/256):((s+dir*c)*u);arc(S.x-r*Math.cos(a0),S.y-r*Math.sin(a0),r,a0,a1-a0);break;}
        case 12:{const dx=s8(code[i++]),dy=s8(code[i++]),bg=s8(code[i++]);bulge(dx,dy,bg);break;}
        case 13:for(;;){const dx=s8(code[i++]),dy=s8(code[i++]);if(!dx&&!dy)break;const bg=s8(code[i++]);bulge(dx,dy,bg);if(i>=code.length)break;}break;
        case 14:{if(vert)break;// 只有直書才執行下一個指令：橫書時跳過
          const save={x:S.x,y:S.y,pen:S.pen,sc:S.sc,stack:S.stack.slice(),n:S.polys.length,cur:S.cur,cl:S.cur?S.cur.length:0};
          step();S.x=save.x;S.y=save.y;S.pen=save.pen;S.sc=save.sc;S.stack=save.stack;S.polys.length=save.n;S.cur=save.cur;if(S.cur)S.cur.length=save.cl;break;}
      }
      return true;
    };
    let guard=0;while(i<code.length&&guard++<20000)if(!step())break;
  }
  try{run(sh.code,0);}catch(_){}
  return{polys:S.polys.filter(p=>p.length>1),adv:S.x,advY:S.y};
}
function findShape(el){
  const files=Object.values(shxFiles);if(!files.length)return null;
  const want=(el.file||'').toUpperCase().replace(/^.*[\\/]/,'').replace(/\.SHX$/,'');
  const named=files.filter(f=>want&&f.name.replace(/\.SHX$/,'')===want);
  // 指定了檔名就只找那個檔；沒指定檔名時，只有一個形狀檔才敢猜
  const order=want?(named.length?named:(el.name&&!/^\d+$/.test(el.name)?files:[])):(files.length===1||el.name?files:[]);
  for(const f of order){
    let sh=null;
    if(el.name)sh=f.byName[String(el.name).toUpperCase()];
    if(!sh&&el.num!=null)sh=f.byNum[el.num];
    if(!sh&&el.name&&/^\d+$/.test(el.name))sh=f.byNum[+el.name];
    if(sh)return[sh,f];
  }
  return null;
}
function drawShapeEl(el,p,k){
  const hit=findShape(el);if(!hit)return;
  const sc=(el.s||1)*k;if(Math.abs(sc)<0.02)return;
  const polys=shxPolys(hit[0],hit[1]);if(!polys.length)return;
  let ux=p.ux,uy=p.uy;if(el.abs){ux=1;uy=0;}
  const r=(el.r||0)*Math.PI/180,cr=Math.cos(r),sr=Math.sin(r);
  if(el.up){/* 保持正向：方向朝左時翻轉 */const a=Math.atan2(uy,ux)-r;if(Math.cos(a)<0){ux=-ux;uy=-uy;}}
  const nx=uy,ny=-ux,ox=p.x+ux*(el.x||0)*k+nx*(el.y||0)*k,oy=p.y+uy*(el.x||0)*k+ny*(el.y||0)*k;
  ctx.beginPath();
  for(const pl of polys){pl.forEach(([x,y],j)=>{const X=(x*cr-y*sr)*sc,Y=(x*sr+y*cr)*sc,sx=ox+ux*X+nx*Y,sy=oy+uy*X+ny*Y;j?ctx.lineTo(sx,sy):ctx.moveTo(sx,sy);});}
  ctx.stroke();
}
function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=0x8000)s+=String.fromCharCode.apply(null,bytes.subarray(i,i+0x8000));return btoa(s);}
function unb64(s){const t=atob(s),u=new Uint8Array(t.length);for(let i=0;i<t.length;i++)u[i]=t.charCodeAt(i);return u;}
function idb(){return new Promise((res,rej)=>{try{const r=indexedDB.open('simplecad',2);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('shx'))d.createObjectStore('shx');if(!d.objectStoreNames.contains('files'))d.createObjectStore('files');};r.onsuccess=()=>res(r.result);r.onerror=()=>rej(r.error);}catch(e){rej(e);}});}
async function idbPut(k,v){try{const d=await idb();await new Promise(r=>{const t=d.transaction('shx','readwrite');t.objectStore('shx').put(v,k);t.oncomplete=t.onerror=()=>r();});}catch(_){}}
function addShx(bytes,fname){const f=parseShx(bytes,fname);shxFiles[f.name]=f;idbPut(f.name,bytes.slice().buffer);return f;}
async function loadShxStore(){
  try{const o=JSON.parse(localStorage.getItem('simplecad.shx')||'{}');for(const[k,v]of Object.entries(o)){try{addShx(unb64(v),k);}catch(_){}}localStorage.removeItem('simplecad.shx');}catch(_){}
  try{const d=await idb();await new Promise(r=>{const t=d.transaction('shx','readonly'),c=t.objectStore('shx').openCursor();
    c.onsuccess=()=>{const cur=c.result;if(!cur){r();return;}try{const f=parseShx(new Uint8Array(cur.value),cur.key);shxFiles[f.name]=f;}catch(_){}cur.continue();};c.onerror=()=>r();});}catch(_){}
  schedule();
}

/* ---------- 線型繪製 ---------- */
function makePath(pts){const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+dist(pts[i-1],pts[i]));return{pts,cum,L:cum[cum.length-1]};}
function at(P,d){let lo=0,hi=P.cum.length-1;while(hi-lo>1){const m=(lo+hi)>>1;if(P.cum[m]<=d)lo=m;else hi=m;}
  const a=P.pts[lo],b=P.pts[hi],seg=(P.cum[hi]-P.cum[lo])||1,t=Math.max(0,Math.min(1,(d-P.cum[lo])/seg));
  return{x:a[0]+(b[0]-a[0])*t,y:a[1]+(b[1]-a[1])*t,i:lo,ux:(b[0]-a[0])/seg,uy:(b[1]-a[1])/seg};}
function strokeSolid(pts){ctx.beginPath();ctx.moveTo(pts[0][0],pts[0][1]);for(let i=1;i<pts.length;i++)ctx.lineTo(pts[i][0],pts[i][1]);ctx.stroke();}
function strokeLT(pts,lt,k,color){
  ctx.strokeStyle=color;ctx.fillStyle=color;ctx.lineCap='round';ctx.lineJoin='round';
  const P=makePath(pts);if(P.L<=0)return;
  const tot=lt&&lt.total?lt.total*k:0;
  if(!tot||tot<2.5||P.L/tot>5000){strokeSolid(pts);return;}
  const els=lt.els,texts=[],shapes=[];let d=0,i=0;
  ctx.beginPath();
  while(d<P.L){
    const el=els[i];i=(i+1)%els.length;
    if(el.k==='len'){
      const len=el.v*k;
      if(len>0){const d1=Math.min(P.L,d+len),a=at(P,d);ctx.moveTo(a.x,a.y);for(let j=a.i+1;j<P.pts.length&&P.cum[j]<d1;j++)ctx.lineTo(P.pts[j][0],P.pts[j][1]);const b=at(P,d1);ctx.lineTo(b.x,b.y);d=d1;}
      else if(len<0)d-=len;
      else{const a=at(P,d);ctx.moveTo(a.x,a.y);ctx.lineTo(a.x+0.01,a.y);}
    }else if(el.k==='text')texts.push([el,at(P,d)]);
    else if(el.k==='shape')shapes.push([el,at(P,d)]);
  }
  ctx.stroke();
  for(const[el,p]of shapes)drawShapeEl(el,p,k);
  for(const[el,p]of texts){
    const size=el.s*k;if(size<3)continue;
    const nx=p.uy,ny=-p.ux;
    ctx.save();ctx.translate(p.x+p.ux*el.x*k+nx*el.y*k,p.y+p.uy*el.x*k+ny*el.y*k);
    let rot=el.abs?-el.r*Math.PI/180:Math.atan2(p.uy,p.ux)-el.r*Math.PI/180;
    if(el.up&&Math.cos(rot)<0)rot+=Math.PI;
    ctx.rotate(rot);ctx.font=size.toFixed(1)+'px sans-serif';ctx.textAlign='left';ctx.textBaseline='alphabetic';ctx.fillText(el.str,0,0);ctx.restore();
  }
}

/* ---------- 物件繪製 ---------- */
function circlePts(o,r){const s=st.view.s,n=Math.max(36,Math.min(720,Math.ceil(r*s*0.6)));const pts=[];for(let i=0;i<=n;i++){const t=i/n*Math.PI*2;pts.push(toS([o[0]+r*Math.cos(t),o[1]+r*Math.sin(t)]));}return pts;}
function arcSPts(e){const sw=sweepOf(e.a0,e.a1),n=Math.max(8,Math.min(720,Math.ceil(e.r*st.view.s*sw*0.1)));const pts=[];for(let i=0;i<=n;i++){const t=e.a0+sw*i/n;pts.push(toS([e.o[0]+e.r*Math.cos(t),e.o[1]+e.r*Math.sin(t)]));}return pts;}
function visible(e){const b=e.bb||entBox(e),p0=toS([b[0],b[3]]),p1=toS([b[2],b[1]]),m=60;return !(p1[0]<-m||p0[0]>W+m||p1[1]<-m||p0[1]>H+m);}
const FONT='"Noto Sans TC","PingFang TC","Microsoft JhengHei",sans-serif';
function drawEnt(e,col,width,solid,ltName){
  const k=st.view.s*st.ltscale*(e.lts||1);ctx.lineWidth=width||(e.imp?1:1.5);
  const lt=solid?null:getLT(ltName!==undefined?ltName:e.lt);
  switch(e.t){
    case'line':strokeLT([toS(e.a),toS(e.b)],lt,k,col);break;
    case'circle':strokeLT(circlePts(e.o,e.r),lt,k,col);break;
    case'arc':strokeLT(arcSPts(e),lt,k,col);break;
    case'pline':{const b=entBox(e);if((b[2]-b[0])*st.view.s<0.8&&(b[3]-b[1])*st.view.s<0.8){ctx.fillStyle=col;const q=toS(e.pts[0]);ctx.fillRect(q[0],q[1],1,1);break;}
      const p=e.pts.map(toS);if(e.closed)p.push(p[0]);strokeLT(p,lt,k,col);break;}
    case'point':{const q=toS(e.p),r=width>2?4:1.5;ctx.fillStyle=col;ctx.fillRect(q[0]-r,q[1]-r,2*r,2*r);break;}
    case'text':drawText(e,col,width>2);break;
    case'fill':{ctx.beginPath();for(const ring of e.rings){ring.forEach((p,i)=>{const q=toS(p);i?ctx.lineTo(q[0],q[1]):ctx.moveTo(q[0],q[1]);});ctx.closePath();}
      if(width>2){ctx.strokeStyle=col;ctx.stroke();}else{ctx.fillStyle=col;ctx.fill('evenodd');}break;}
    case'dim':drawDim(e,col,width);break;
    case'ink':drawInk(e,col,width);break;
  }
}
/* ---------- SHX 字型 ---------- */
let big5Map=null;
function big5Code(ch){
  if(!big5Map){big5Map=new Map();const dec=new TextDecoder('big5');const buf=new Uint8Array(2);
    for(let a=0x81;a<=0xFE;a++)for(let b=0x40;b<=0xFE;b++){if(b>0x7E&&b<0xA1)continue;buf[0]=a;buf[1]=b;const c=dec.decode(buf);if(c.length===1&&c!=='\uFFFD'&&!big5Map.has(c))big5Map.set(c,(a<<8)|b);}}
  return big5Map.get(ch);
}
function fontFile(n){if(!n)return null;n=String(n).toUpperCase().replace(/^.*[\\/]/,'');if(!/\.SHX$/.test(n))n+='.SHX';const f=shxFiles[n];return f&&f.isFont?f:null;}
function glyph(f,code,vert){const sh=shxShape(f,code);if(!sh)return null;if(vert){shxVert(sh,f);return{polys:sh.vpolys,adv:sh.vadv[0],advY:sh.vadv[1]};}shxPolys(sh,f);return{polys:sh.polys,adv:sh.adv,advY:0};}
function textGlyphs(e,line){
  const main=fontFile(e.font),big=fontFile(e.big);
  if(!main&&!big)return null;
  const V=!!e.vert,out=[];let x=0,y=0;
  for(const ch of line){
    const u=ch.codePointAt(0);let g=null,f=null;
    if(u<0x80||!big){f=main||big;g=f&&glyph(f,u,V);}
    if(!g&&big){const b=big5Code(ch);if(b!=null){g=glyph(big,b,V);f=big;}}
    if(!g&&main&&main.type==='unifont'){g=glyph(main,u,V);f=main;}
    const k=f?1/(f.above||1):0;
    if(!g){if(V)y-=1.2;else x+=u<0x80?0.6:1;continue;}
    if(V&&Math.abs(g.advY||0)<1e-9){// 字型沒有直書指令：置中往下排
      out.push({polys:g.polys,x:x-(g.adv||0)*k/2,y:y-1,k});y-=1.25;continue;}
    out.push({polys:g.polys,x,y,k});x+=(g.adv||0)*k;y+=(g.advY||0)*k;
  }
  return{glyphs:out,w:V?0:x};
}
function drawShxText(e,col,hl){
  const lines=e._sg||(e._sg=e.lines.map(l=>textGlyphs(e,l)));
  if(lines.some(l=>!l))return false;
  const s=st.view.s,q=toS(e.p),h=e.h,wf=e.wf||1;
  ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(-e.rot);ctx.scale(s,-s);
  ctx.strokeStyle=col;ctx.lineWidth=(hl?4:1)/s;ctx.lineCap='round';ctx.lineJoin='round';ctx.beginPath();
  lines.forEach((L,i)=>{const base=e.vert?0:-(e.y0+i*e.ls),x0=e.vert?-i*e.ls:-L.w*h*wf*[0,.5,1][e.ha||0];
    for(const g of L.glyphs){const kx=g.k*h*wf,ky=g.k*h,ox=x0+g.x*h*wf,oy=base+g.y*h;
      for(const pl of g.polys){pl.forEach(([x,y],j)=>{const X=ox+x*kx,Y=oy+y*ky;j?ctx.lineTo(X,Y):ctx.moveTo(X,Y);});}}});
  ctx.stroke();ctx.restore();return true;
}
function drawText(e,col,hl){
  const s=st.view.s,hp=e.h*s;
  if(hp>=1.5&&(e.font||e.big)&&drawShxText(e,col,hl))return;
  if(hp<1.5){if(hp>0.3){const r=textRect(e),q=toS(e.p);ctx.fillStyle=col;ctx.globalAlpha=.35;ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(-e.rot);ctx.fillRect(r[0]*s,-r[3]*s,(r[1]-r[0])*s,(r[3]-r[2])*s);ctx.restore();ctx.globalAlpha=1;}return;}
  const q=toS(e.p);ctx.save();ctx.translate(q[0],q[1]);ctx.rotate(-e.rot);if(e.wf&&e.wf!==1)ctx.scale(e.wf,1);
  if(e.vert){ctx.font=(hp*1.1).toFixed(1)+'px '+FONT;ctx.textAlign='center';ctx.textBaseline='top';ctx.fillStyle=col;let yy=0;for(const ch of e.lines.join('')){ctx.fillText(ch,hp*0.5,yy);yy+=hp*1.25;}ctx.restore();return;}
  ctx.font=(hp*1.2).toFixed(1)+'px '+FONT;ctx.textAlign=['left','center','right'][e.ha||0];ctx.textBaseline='alphabetic';
  if(hl){ctx.strokeStyle=col;ctx.lineWidth=5;ctx.lineJoin='round';e.lines.forEach((l,i)=>ctx.strokeText(l,0,(e.y0+i*e.ls)*s));}
  else{ctx.fillStyle=col;e.lines.forEach((l,i)=>ctx.fillText(l,0,(e.y0+i*e.ls)*s));}
  ctx.restore();
}
function drawInk(e,col,width){
  const p=e.pts.map(toS);ctx.strokeStyle=col;ctx.lineCap='round';ctx.lineJoin='round';
  ctx.lineWidth=Math.max(1,e.w*st.view.s)+(width&&width>2?4:0);
  ctx.beginPath();ctx.moveTo(p[0][0],p[0][1]);
  if(p.length<3){for(let i=1;i<p.length;i++)ctx.lineTo(p[i][0],p[i][1]);}
  else{for(let i=1;i<p.length-1;i++){ctx.quadraticCurveTo(p[i][0],p[i][1],(p[i][0]+p[i+1][0])/2,(p[i][1]+p[i+1][1])/2);}ctx.lineTo(p[p.length-1][0],p[p.length-1][1]);}
  ctx.stroke();
}
function dimGeom(e){
  const A=toS(e.a),B=toS(e.b),dx=B[0]-A[0],dy=B[1]-A[1],L=Math.hypot(dx,dy);if(L<1)return null;
  const ux=dx/L,uy=dy/L,nx=uy,ny=-ux,off=e.off*st.view.s;
  return{A,B,ux,uy,nx,ny,off,A2:[A[0]+nx*off,A[1]+ny*off],B2:[B[0]+nx*off,B[1]+ny*off]};
}
function drawDim(e,col,width){
  const g=dimGeom(e);if(!g)return;const{A,B,A2,B2,ux,uy,nx,ny,off}=g;
  ctx.strokeStyle=col;ctx.fillStyle=col;ctx.lineWidth=width&&width>2?width:1;ctx.lineCap='butt';
  ctx.beginPath();
  if(Math.abs(off)>3){const sg=Math.sign(off);
    ctx.moveTo(A[0]+nx*sg*3,A[1]+ny*sg*3);ctx.lineTo(A2[0]+nx*sg*5,A2[1]+ny*sg*5);
    ctx.moveTo(B[0]+nx*sg*3,B[1]+ny*sg*3);ctx.lineTo(B2[0]+nx*sg*5,B2[1]+ny*sg*5);}
  ctx.moveTo(A2[0],A2[1]);ctx.lineTo(B2[0],B2[1]);
  const hp=e.h?e.h*st.view.s:0,tk=hp?Math.max(2,Math.min(hp*0.5,40)):5;
  const tx=(ux+nx)/Math.SQRT2*tk,ty=(uy+ny)/Math.SQRT2*tk;
  for(const P of[A2,B2]){ctx.moveTo(P[0]-tx,P[1]-ty);ctx.lineTo(P[0]+tx,P[1]+ty);}
  ctx.stroke();
  let ang=Math.atan2(uy,ux);if(Math.cos(ang)<-1e-6)ang+=Math.PI;
  const m=midp(A2,B2);ctx.save();ctx.translate(m[0],m[1]);ctx.rotate(ang);
  if(hp&&hp<4){ctx.restore();return;}// 字太小就不畫字
  ctx.font=(hp?Math.min(hp,200):13)+'px system-ui,sans-serif';ctx.textAlign='center';ctx.textBaseline='bottom';ctx.fillText(fmt(dist(e.a,e.b)),0,hp?-hp*0.4:-3);ctx.restore();
}
function drawSnapMark(s){
  const[x,y]=toS(s.p),r=6;ctx.strokeStyle='#ffcc00';ctx.lineWidth=2;ctx.lineCap='butt';ctx.beginPath();
  switch(s.kind){
    case'end':ctx.rect(x-r,y-r,2*r,2*r);break;
    case'mid':ctx.moveTo(x,y-r-1);ctx.lineTo(x+r+1,y+r);ctx.lineTo(x-r-1,y+r);ctx.closePath();break;
    case'cen':ctx.arc(x,y,r,0,Math.PI*2);break;
    case'qua':ctx.moveTo(x,y-r-1);ctx.lineTo(x+r+1,y);ctx.lineTo(x,y+r+1);ctx.lineTo(x-r-1,y);ctx.closePath();break;
    case'nod':ctx.arc(x,y,r,0,Math.PI*2);ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y+r);ctx.moveTo(x+r,y-r);ctx.lineTo(x-r,y+r);break;
    case'ins':ctx.rect(x-r,y-r,2*r,2*r);ctx.moveTo(x-r,y);ctx.lineTo(x+r,y);ctx.moveTo(x,y-r);ctx.lineTo(x,y+r);break;
    case'int':ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y+r);ctx.moveTo(x+r,y-r);ctx.lineTo(x-r,y+r);break;
    case'app':ctx.rect(x-r,y-r,2*r,2*r);ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y+r);ctx.moveTo(x+r,y-r);ctx.lineTo(x-r,y+r);break;
    case'per':ctx.moveTo(x-r,y-r);ctx.lineTo(x-r,y+r);ctx.lineTo(x+r,y+r);ctx.moveTo(x-r,y);ctx.lineTo(x,y);ctx.lineTo(x,y+r);break;
    default:ctx.moveTo(x-r,y-r);ctx.lineTo(x+r,y-r);ctx.lineTo(x-r,y+r);ctx.lineTo(x+r,y+r);ctx.closePath();
  }
  ctx.stroke();
  ctx.font='12px system-ui,sans-serif';ctx.fillStyle='#ffcc00';ctx.textAlign='left';ctx.textBaseline='top';ctx.fillText(SNAPNAME[s.kind]||'',x+10,y+8);
}
function entInfo(e){
  const ly=e.imp?`［${e.ly}］`:'';
  if(e.t==='line'){const L=dist(e.a,e.b);return`${ly}直線　長 ${fmt(L)}　方位角 ${dms(azimuth(e.a,e.b))}　線型 ${e.lt}`;}
  if(e.t==='circle')return`${ly}圓　半徑 ${fmt(e.r)}　直徑 ${fmt(2*e.r)}　周長 ${fmt(2*Math.PI*e.r)}　面積 ${fmt(Math.PI*e.r*e.r)}`;
  if(e.t==='arc'){const sw=sweepOf(e.a0,e.a1);return`${ly}弧　半徑 ${fmt(e.r)}　弧長 ${fmt(e.r*sw)}　圓心角 ${(sw*180/Math.PI).toFixed(4)}°`;}
  if(e.t==='pline'){const L=polyLen(e.pts,e.closed),cv=e.kv&&e.kv.length!==e.pts.length;return`${ly}${e.spl?'雲形線':'聚合線'}　長 ${cv?'≈':''}${fmt(L)}`+(e.closed?`　面積 ${cv?'≈':''}${fmt(polyArea(e.pts))}`:'')+`　頂點 ${e.kv?e.kv.length:e.pts.length}`;}
  if(e.t==='text')return`${ly}文字「${e.lines.join(' ')}」　字高 ${fmt(e.h)}`;
  if(e.t==='point')return`${ly}點　X ${fmt(e.p[0])}　Y ${fmt(e.p[1])}`;
  if(e.t==='fill')return`${ly}填充　面積 ${fmt(e.rings.reduce((a,r)=>a+polyArea(r),0))}`;
  if(e.t==='dim')return`尺寸標註　${fmt(dist(e.a,e.b))}　方位角 ${dms(azimuth(e.a,e.b))}`;
  return'手寫筆跡';
}
/* ---------- 鎖點 ---------- */
const near=(e,w,tol)=>{const b=e.bb||entBox(e);return w[0]>=b[0]-tol&&w[0]<=b[2]+tol&&w[1]>=b[1]-tol&&w[1]<=b[3]+tol;};
function findSnap(w,tol,base){
  const O=st.osm;let best=null,bd=tol,nr=null,nd=tol;const prims=[];
  const cand=(p,kind)=>{const d=dist(p,w);if(d<bd){bd=d;best={p,kind};}};
  const segTest=(a,b)=>{const q=closestOnSeg(w,a,b),d=dist(q,w);if(d<tol){prims.push({t:'line',a,b,d});if(O.nea&&d<nd){nd=d;nr={p:q,kind:'nea'};}}};
  const circTest=(e,arc)=>{const d0=dist(w,e.o),d=Math.abs(d0-e.r);if(d<tol&&d0>0){const ang=Math.atan2(w[1]-e.o[1],w[0]-e.o[0]);if(arc&&!inRange(ang,e.a0,e.a1))return;prims.push({t:'circle',o:e.o,r:e.r,arc:arc?[e.a0,e.a1]:null,d});if(O.nea&&d<nd){nd=d;nr={p:[e.o[0]+(w[0]-e.o[0])/d0*e.r,e.o[1]+(w[1]-e.o[1])/d0*e.r],kind:'nea'};}}};
  for(const e of snapEnts(w,tol)){
    if(e.t==='ink'||e.t==='fill')continue;
    if(e.t!=='circle'&&e.t!=='arc'&&!near(e,w,tol))continue;
    switch(e.t){
      case'line':if(O.end){cand(e.a,'end');cand(e.b,'end');}if(O.mid)cand(midp(e.a,e.b),'mid');segTest(e.a,e.b);break;
      case'circle':if(O.cen)cand(e.o,'cen');if(!near(e,w,tol))break;if(O.qua)for(const[a,b]of[[1,0],[0,1],[-1,0],[0,-1]])cand([e.o[0]+a*e.r,e.o[1]+b*e.r],'qua');circTest(e,false);break;
      case'arc':{if(O.cen)cand(e.o,'cen');if(!near(e,w,tol))break;const[p0,p1]=arcEnds(e);if(O.end){cand(p0,'end');cand(p1,'end');}
        if(O.mid){const m=e.a0+sweepOf(e.a0,e.a1)/2;cand([e.o[0]+e.r*Math.cos(m),e.o[1]+e.r*Math.sin(m)],'mid');}
        if(O.qua)for(let q=0;q<4;q++){const a=q*Math.PI/2;if(inRange(a,e.a0,e.a1))cand([e.o[0]+e.r*Math.cos(a),e.o[1]+e.r*Math.sin(a)],'qua');}
        circTest(e,true);break;}
      case'pline':{const P=e.pts,n=P.length,kv=e.kv;
        if(O.end){if(!kv)P.forEach(p=>cand(p,'end'));else if(kv.length)kv.forEach(i=>cand(P[i],'end'));else if(!e.closed){cand(P[0],'end');cand(P[n-1],'end');}}
        if(O.mid&&kv&&kv.length){for(let j=0;j<kv.length;j++){const i=kv[j],i2=j+1<kv.length?kv[j+1]:(e.closed?n:-1);if(i2===i+1)cand(midp(P[i],P[i2%n]),'mid');}}
        else if(O.mid&&!kv)for(let i=0;i+1<n+(e.closed?1:0);i++)cand(midp(P[i],P[(i+1)%n]),'mid');
        for(let i=0;i+1<n;i++)segTest(P[i],P[i+1]);if(e.closed&&n>2)segTest(P[n-1],P[0]);break;}
      case'point':if(O.nod)cand(e.p,'nod');break;
      case'text':if(O.ins)cand(e.p,'ins');break;
      case'dim':if(O.end){cand(e.a,'end');cand(e.b,'end');}break;
    }
  }
  if(O.int&&prims.length>1)for(let i=0;i<prims.length;i++)for(let j=i+1;j<prims.length;j++)for(const p of inters(prims[i],prims[j])){
    if(prims[i].arc&&!inRange(Math.atan2(p[1]-prims[i].o[1],p[0]-prims[i].o[0]),...prims[i].arc))continue;
    if(prims[j].arc&&!inRange(Math.atan2(p[1]-prims[j].o[1],p[0]-prims[j].o[0]),...prims[j].arc))continue;
    cand(p,'int');}
  // 外觀交點：線段延長、圓弧補成整圓後的交點（兩條線差一點沒接上時用）
  if(O.app&&prims.length>1)for(let i=0;i<prims.length;i++)for(let j=i+1;j<prims.length;j++)for(const p of intersExt(prims[i],prims[j]))cand(p,'app');
  // 垂足：從上一點往游標下的線（含延長線）或圓作垂線
  let pr=null,pd=Infinity;
  if(O.per&&base)for(const q of prims){
    let F=[];
    if(q.t==='line'){const dx=q.b[0]-q.a[0],dy=q.b[1]-q.a[1],L=dx*dx+dy*dy;if(L>0){const t=((base[0]-q.a[0])*dx+(base[1]-q.a[1])*dy)/L;F=[[q.a[0]+t*dx,q.a[1]+t*dy]];}}
    else{const d0=dist(base,q.o);if(d0>1e-12){const ux=(base[0]-q.o[0])/d0,uy=(base[1]-q.o[1])/d0;F=[[q.o[0]+ux*q.r,q.o[1]+uy*q.r],[q.o[0]-ux*q.r,q.o[1]-uy*q.r]];
      if(q.arc)F=F.filter(p=>inRange(Math.atan2(p[1]-q.o[1],p[0]-q.o[0]),...q.arc));}}
    for(const p of F){if(dist(p,base)<1e-9)continue;cand(p,'per');
      // 游標在線上但離垂足遠：沒開最近點時仍然鎖垂足
      const k=q.d+dist(p,w)*1e-6;if(k<pd){pd=k;pr={p,kind:'per'};}}
  }
  // 有開最近點：離垂足近才鎖垂足，其他地方鎖最近點（同 AutoCAD）
  return best||nr||pr;
}
function lineLine(a,b,c,d){const r=[b[0]-a[0],b[1]-a[1]],s=[d[0]-c[0],d[1]-c[1]],den=r[0]*s[1]-r[1]*s[0];if(Math.abs(den)<1e-12*Math.hypot(...r)*Math.hypot(...s))return[];const t=((c[0]-a[0])*s[1]-(c[1]-a[1])*s[0])/den;return[[a[0]+t*r[0],a[1]+t*r[1]]];}
function lineCircFull(a,b,o,R){const dx=b[0]-a[0],dy=b[1]-a[1],fx=a[0]-o[0],fy=a[1]-o[1],A=dx*dx+dy*dy,B=2*(fx*dx+fy*dy),C=fx*fx+fy*fy-R*R,D=B*B-4*A*C;if(D<0||!A)return[];const q=Math.sqrt(D);return[(-B-q)/(2*A),(-B+q)/(2*A)].map(t=>[a[0]+t*dx,a[1]+t*dy]);}
function intersExt(e1,e2){
  if(e1.t==='line'&&e2.t==='line')return lineLine(e1.a,e1.b,e2.a,e2.b);
  if(e1.t==='line')return lineCircFull(e1.a,e1.b,e2.o,e2.r);
  if(e2.t==='line')return lineCircFull(e2.a,e2.b,e1.o,e1.r);
  return circCirc(e1.o,e1.r,e2.o,e2.r);
}
/* ---------- 選取 ---------- */
function rectDist(r,x,y){const dx=Math.max(r[0]-x,0,x-r[1]),dy=Math.max(r[2]-y,0,y-r[3]);return Math.hypot(dx,dy);}
function hitDist(e,w){
  switch(e.t){
    case'line':return dist(closestOnSeg(w,e.a,e.b),w);
    case'circle':return Math.abs(dist(w,e.o)-e.r);
    case'arc':{const a=Math.atan2(w[1]-e.o[1],w[0]-e.o[0]);if(inRange(a,e.a0,e.a1))return Math.abs(dist(w,e.o)-e.r);const[p,q]=arcEnds(e);return Math.min(dist(w,p),dist(w,q));}
    case'point':return dist(w,e.p);
    case'text':{const l=textLocal(e,w);return rectDist(textRect(e),l[0],l[1]);}
    case'fill':{let m=Infinity;for(const r of e.rings)for(let i=0;i<r.length;i++)m=Math.min(m,dist(closestOnSeg(w,r[i],r[(i+1)%r.length]),w));return m;}
    case'dim':{const n=[-(e.b[1]-e.a[1]),e.b[0]-e.a[0]],L=Math.hypot(n[0],n[1])||1,a2=[e.a[0]+n[0]/L*e.off,e.a[1]+n[1]/L*e.off],b2=[e.b[0]+n[0]/L*e.off,e.b[1]+n[1]/L*e.off];return Math.min(dist(closestOnSeg(w,a2,b2),w),dist(closestOnSeg(w,e.a,e.b),w));}
  }
  const P=e.pts;let m=P.length===1?dist(w,P[0]):Infinity;for(let i=1;i<P.length;i++)m=Math.min(m,dist(closestOnSeg(w,P[i-1],P[i]),w));if(e.closed&&P.length>2)m=Math.min(m,dist(closestOnSeg(w,P[P.length-1],P[0]),w));return m;
}
