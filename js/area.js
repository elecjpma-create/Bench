/* ---------- 區域檢查：地物相通、房屋未封閉、空白區 ----------
   邊界線打散後在交點、T 字接點互相接起來，切成一塊塊封閉區域（不必是 close 的聚合線），
   再看每一區裡的註記和圖例。純計算，不碰畫面；坐標請先減掉原點。 */
const AR_HOUSE=1,AR_ADD=2,AR_WALK=4,AR_ROAD=8,AR_WATER=16,AR_OTHER=32,AR_TEMP=64,AR_GATE=128,AR_STAIR=256,AR_FRAME=512;// HOUSE＝永久性房屋，TEMP＝建築中、臨時性（也要封閉）
const AR_TEMPC=new Set(['93120','93130','9310200','9310300']);
// 不當邊界也不當地物的圖層
const AR_IGN=/行道樹|防風林|獨立樹|流向|號誌|標誌|水管|油管|瓦斯管|輸送|配電|電信線|高壓|電桿|電力桿|電信桿|路燈|人孔|變壓器|交接箱|消防栓|曲線|標高|地名|編號|分棟|郵筒|電話亭|單線水|小水溝|纜車|索道|金爐|水塔|抽水站|變電所|噴泉|廣告|升旗|候車|獨立墓|GIS/;
const AR_KIND93=/墓地|堆積場|廢墟|游泳池|球場|運動場/;
const AR_KIND93C=new Set(['93523','93726','93902','93553','93555','93556']);
const AR_SINGLE=new Set(['95116','95153','94901','94902','9510110','9510503']);

/** 圖層角色：{b:邊界種類, a:地物代碼（圖塊、文字算這種地物）, land:散線也算地物, t:'house'|'add' 房屋文字層} 或 null */
function areaRole(name){
  const m=/^(a?)(\d{5,7})([A-Za-z]*)/i.exec(name);
  if(/^Q(-|$)/i.test(name))return{b:AR_OTHER};// 立製無法判定的線也算邊界
  if(!m)return/增建/.test(name)?(/TXT|註記/i.test(name)?{t:'add'}:{b:AR_ADD,t:'add'}):null;
  const code=m[2],suf=m[3].toUpperCase(),isTxt=suf==='TXT'||suf==='X';
  if(!isTxt&&/墓地|堆積場|廢墟|游泳池|球場|運動場|體育場/.test(name)&&!AR_IGN.test(name))return{b:AR_OTHER,a:code};
  if(AR_IGN.test(name)||AR_SINGLE.has(code)||code==='9310101')return null;
  if(!isTxt&&(/階梯/.test(name)||code==='93904'||code==='9390004'))return{b:AR_OTHER|AR_STAIR};// 階梯格子不用註記
  if(!isTxt&&(/寺廟|廟宇/.test(name)||code==='93612'))return{b:AR_OTHER,a:code,withH:code.length===7};// 卍；七碼可以和樓層註記同區
  if(code.startsWith('931')){
    if(isTxt)return{t:(code==='9310102'||/增建/.test(name))?'add':'house'};
    if(suf==='ADD'||code==='9310102'||/增建/.test(name))return{b:AR_ADD,t:'add'};
    if(code==='93111')return{b:AR_OTHER};
    return AR_TEMPC.has(code)||/建築中|臨時/.test(name)?{b:AR_TEMP,t:'temp'}:{b:AR_HOUSE,t:'house'};// 臨時性房屋上的 T（文字或圖塊）就是房屋註記
  }
  if(isTxt)return null;
  if(code.startsWith('97')){
    if(/地類界|田埂/.test(name)||['97921','97922','9790201','9790202'].includes(code))return{b:AR_OTHER};
    return{a:code,land:true};
  }
  if(code.startsWith('932'))return/門/.test(name)||code==='93270'||code==='9320700'?{b:AR_OTHER|AR_GATE,gb:true,gate:true}:{b:AR_OTHER};// 門：兩個門之間有一條看不見的地類界
  if(/停車場/.test(name)||code.startsWith('94229'))return/出入口/.test(name)||suf==='D'?{b:AR_OTHER|AR_GATE,gb:true}:{b:AR_OTHER,a:code};
  if(/分隔島|小徑/.test(name)||['94224','9421003','94216','94217','9420901','9420902'].includes(code))return{b:AR_OTHER};// 小徑（單線步道）也算分界
  if(code.startsWith('942'))return(/人行道/.test(name)||code==='94218'||code==='9421006')?{b:AR_WALK}:{b:AR_ROAD};
  if(code.startsWith('944'))return/橋|涵/.test(name)?{b:AR_OTHER,wing:true}:{b:AR_OTHER};// 橋、涵的 45° 小翅膀不算
  if(code.startsWith('95'))return/土坎/.test(name)||code==='95134'?{b:AR_OTHER}:{b:AR_WATER};
  if(code.startsWith('93'))return(AR_KIND93.test(name)||AR_KIND93C.has(code))?{b:AR_OTHER,a:code}:{b:AR_OTHER};
  return null;
}
const areaKindName=n=>n.replace(/^a?\d+[A-Za-z]*_?/,'')||n;


/** 前處理：兩個門之間補一條看不見的地類界；門、出入口線懸空的端點接到 1 公尺內最近的線 */
function areaPrep(lines,opt){
  const out=lines.slice(),G=opt.gates||[];
  if(G.length>1){const used=new Set();
    const nn=i=>{let b=-1,bd=15;for(let j=0;j<G.length;j++){if(j===i)continue;const d=Math.hypot(G[j][0]-G[i][0],G[j][1]-G[i][1]);if(d<bd){bd=d;b=j;}}return b;};
    for(let i=0;i<G.length;i++){const j=nn(i);if(j<0||nn(j)!==i||used.has(i))continue;used.add(i);used.add(j);out.push({p:[G[i][0],G[i][1],G[j][0],G[j][1]],r:AR_OTHER|AR_GATE});}}
  // 門、出入口線的端點
  const ends=[];for(const L of out)if(L.r&AR_GATE&&L.p.length>=4){const p=L.p;ends.push([p[0],p[1]],[p[p.length-2],p[p.length-1]]);}
  if(!ends.length)return out;
  const cs=4,grid=new Map(),segs=[];
  for(const L of out){if(L.r&AR_GATE)continue;const p=L.p;for(let i=2;i<p.length;i+=2){const k=segs.length;segs.push(p[i-2],p[i-1],p[i],p[i+1]);
    const i0=Math.floor(Math.min(p[i-2],p[i])/cs),i1=Math.floor(Math.max(p[i-2],p[i])/cs),j0=Math.floor(Math.min(p[i-1],p[i+1])/cs),j1=Math.floor(Math.max(p[i-1],p[i+1])/cs);
    if((i1-i0+1)*(j1-j0+1)>2500)continue;for(let a=i0;a<=i1;a++)for(let b=j0;b<=j1;b++){const key=a*1e7+b;let l=grid.get(key);if(!l)grid.set(key,l=[]);l.push(k);}}}
  for(const[x,y]of ends){let bd=1.0,bq=null;const a0=Math.floor((x-1)/cs),a1=Math.floor((x+1)/cs),b0=Math.floor((y-1)/cs),b1=Math.floor((y+1)/cs);
    for(let a=a0;a<=a1;a++)for(let b=b0;b<=b1;b++){const l=grid.get(a*1e7+b);if(!l)continue;for(const k of l){const ax=segs[k],ay=segs[k+1],dx=segs[k+2]-ax,dy=segs[k+3]-ay,l2=dx*dx+dy*dy;if(!l2)continue;
      let t=((x-ax)*dx+(y-ay)*dy)/l2;t=t<0?0:t>1?1:t;const qx=ax+dx*t,qy=ay+dy*t,d=Math.hypot(qx-x,qy-y);if(d<bd){bd=d;bq=[qx,qy];}}}
    if(bq&&bd>(opt.tol||0.01))out.push({p:[x,y,bq[0],bq[1]],r:AR_OTHER|AR_GATE});}
  return out;
}

/**
 * lines：[{p:[x0,y0,x1,y1,…], r:邊界種類}]；points：[{x,y,k:'H'（房屋）|地物名稱, add:是否為屋頂增建註記}]
 * 回傳 {marks:[{x,y,type,msg,ring}], st:統計}
 */
function areaCheck(lines,points,opt){
  opt=Object.assign({tol:0.01,minArea:0.05,thin:0.15,maxArea:1e5,maxMarks:5000},opt||{});
  const tol=opt.tol,t0=Date.now();
  lines=areaPrep(lines,opt);
  /* 1. 線段 */
  let n=0;for(const L of lines)n+=Math.max(0,L.p.length/2-1);
  const X0=new Float64Array(n),Y0=new Float64Array(n),X1=new Float64Array(n),Y1=new Float64Array(n),R=new Uint16Array(n);
  let ns=0;
  for(const L of lines){const p=L.p;for(let i=2;i<p.length;i+=2){const a=p[i-2],b=p[i-1],c=p[i],d=p[i+1];
    if(!(isFinite(a)&&isFinite(b)&&isFinite(c)&&isFinite(d)))continue;if(Math.abs(a-c)+Math.abs(b-d)<1e-9)continue;
    X0[ns]=a;Y0[ns]=b;X1[ns]=c;Y1[ns]=d;R[ns]=L.r;ns++;}}
  if(!ns)return{marks:[],st:{seg:0,ms:Date.now()-t0}};
  let bx0=Infinity,by0=Infinity,bx1=-Infinity,by1=-Infinity;
  for(let i=0;i<ns;i++){bx0=Math.min(bx0,X0[i],X1[i]);by0=Math.min(by0,Y0[i],Y1[i]);bx1=Math.max(bx1,X0[i],X1[i]);by1=Math.max(by1,Y0[i],Y1[i]);}
  /* 2. 格網：長線只登記它經過的格子 */
  const cs=Math.max(2,Math.sqrt((bx1-bx0+1)*(by1-by0+1)/ns)*2),NX=Math.ceil((bx1-bx0)/cs)+1,NY=Math.ceil((by1-by0)/cs)+1;
  const cellOf=(x,y)=>{let i=Math.floor((x-bx0)/cs),j=Math.floor((y-by0)/cs);i=i<0?0:i>=NX?NX-1:i;j=j<0?0:j>=NY?NY-1:j;return j*NX+i;};
  const cells=new Map(),add=(c,s)=>{let a=cells.get(c);if(!a)cells.set(c,a=[]);if(a[a.length-1]!==s)a.push(s);};
  for(let s=0;s<ns;s++){// 逐欄算線段經過的格子（含容許誤差），長線、斜線都不會漏格
    const ax=X0[s],ay=Y0[s],bx=X1[s],by=Y1[s],xl=Math.min(ax,bx)-tol,xr=Math.max(ax,bx)+tol;
    const yAt=x=>{if(Math.abs(bx-ax)<1e-12)return null;let t=(x-ax)/(bx-ax);t=t<0?0:t>1?1:t;return ay+(by-ay)*t;};
    const i0=Math.max(0,Math.floor((xl-bx0)/cs)),i1=Math.min(NX-1,Math.floor((xr-bx0)/cs));
    for(let i=i0;i<=i1;i++){const cx0=Math.max(xl,bx0+i*cs),cx1=Math.min(xr,bx0+(i+1)*cs);let ya=yAt(cx0-tol),yb=yAt(cx1+tol);
      if(ya===null){ya=ay;yb=by;}const lo=Math.min(ya,yb)-tol,hi=Math.max(ya,yb)+tol;
      const j0=Math.max(0,Math.floor((lo-by0)/cs)),j1=Math.min(NY-1,Math.floor((hi-by0)/cs));for(let j=j0;j<=j1;j++)add(j*NX+i,s);}
  }
  /* 3. 交點、T 字接點：在事件點所在的那一格處理，同一對線不會重複 */
  const splits=new Array(ns),tolSq=tol*tol;
  const putSplit=(s,t)=>{(splits[s]||(splits[s]=[])).push(t);};
  const onSeg=(px,py,s,cell)=>{// 端點落在 s 的中段
    const ax=X0[s],ay=Y0[s],dx=X1[s]-ax,dy=Y1[s]-ay,L2=dx*dx+dy*dy;let t=((px-ax)*dx+(py-ay)*dy)/L2;
    if(t<=0||t>=1)return;const qx=ax+dx*t-px,qy=ay+dy*t-py;if(qx*qx+qy*qy>tolSq)return;
    const L=Math.sqrt(L2);if(t*L<=tol||(1-t)*L<=tol)return;if(cellOf(px,py)!==cell)return;putSplit(s,t);};
  for(const[cell,a]of cells){if(a.length<2)continue;
    for(let ii=0;ii<a.length;ii++){const s=a[ii];const sx0=Math.min(X0[s],X1[s])-tol,sx1=Math.max(X0[s],X1[s])+tol,sy0=Math.min(Y0[s],Y1[s])-tol,sy1=Math.max(Y0[s],Y1[s])+tol;
      for(let jj=ii+1;jj<a.length;jj++){const u=a[jj];
        if(Math.max(X0[u],X1[u])<sx0||Math.min(X0[u],X1[u])>sx1||Math.max(Y0[u],Y1[u])<sy0||Math.min(Y0[u],Y1[u])>sy1)continue;
        onSeg(X0[s],Y0[s],u,cell);onSeg(X1[s],Y1[s],u,cell);onSeg(X0[u],Y0[u],s,cell);onSeg(X1[u],Y1[u],s,cell);
        const rx=X1[s]-X0[s],ry=Y1[s]-Y0[s],qx=X1[u]-X0[u],qy=Y1[u]-Y0[u],d=rx*qy-ry*qx;if(Math.abs(d)<1e-12)continue;
        const wx=X0[u]-X0[s],wy=Y0[u]-Y0[s],t=(wx*qy-wy*qx)/d,v=(wx*ry-wy*rx)/d;if(t<=0||t>=1||v<=0||v>=1)continue;
        const Ls=Math.hypot(rx,ry),Lu=Math.hypot(qx,qy);if(t*Ls<=tol||(1-t)*Ls<=tol||v*Lu<=tol||(1-v)*Lu<=tol)continue;
        if(cellOf(X0[s]+rx*t,Y0[s]+ry*t)!==cell)continue;putSplit(s,t);putSplit(u,v);}}}
  /* 4. 節點（容許誤差內併成一點）、邊（重複的線只算一次） */
  const nX=[],nY=[],nodeMap=new Map(),inv=1/tol;
  const node=(x,y)=>{const ix=Math.floor(x*inv),iy=Math.floor(y*inv);let best=-1,bd=tolSq;
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=nodeMap.get((ix+a)*4194304+(iy+b));if(!l)continue;for(const k of l){const dx=nX[k]-x,dy=nY[k]-y,dd=dx*dx+dy*dy;if(dd<=bd){bd=dd;best=k;}}}
    if(best>=0)return best;const k=nX.length;nX.push(x);nY.push(y);const key=ix*4194304+iy;let l=nodeMap.get(key);if(!l)nodeMap.set(key,l=[]);l.push(k);return k;};
  const eU=[],eV=[],eR=[],eMap=new Map();
  for(let s=0;s<ns;s++){const T=splits[s]?[0,...splits[s].sort((p,q)=>p-q),1]:[0,1];let prev=-1;
    for(const t of T){const k=node(X0[s]+(X1[s]-X0[s])*t,Y0[s]+(Y1[s]-Y0[s])*t);
      if(prev>=0&&k!==prev){const lo=Math.min(k,prev),hi=Math.max(k,prev),key=lo*4194304+hi;const e=eMap.get(key);
        if(e==null){eMap.set(key,eU.length);eU.push(lo);eV.push(hi);eR.push(R[s]);}else eR[e]|=R[s];}
      prev=k;}}
  const NN=nX.length,NE=eU.length,deg0=new Int32Array(NN);
  for(let e=0;e<NE;e++){deg0[eU[e]]++;deg0[eV[e]]++;}
  const aS=new Int32Array(NN+1);for(let v=0;v<NN;v++)aS[v+1]=aS[v]+deg0[v];
  const aE=new Int32Array(2*NE),fill=aS.slice(0,NN);
  for(let e=0;e<NE;e++){aE[fill[eU[e]]++]=e;aE[fill[eV[e]]++]=e;}
  const other=(e,v)=>eU[e]===v?eV[e]:eU[e];
  /* 5. 一直剪掉懸空的線；被剪掉的房屋線＝沒封閉 */
  const alive=new Uint8Array(NE).fill(1),deg=deg0.slice(),Q=[];
  for(let v=0;v<NN;v++)if(deg[v]===1)Q.push(v);
  const cutHouse=[];
  while(Q.length){const v=Q.pop();if(deg[v]!==1)continue;
    for(let k=aS[v];k<aS[v+1];k++){const e=aE[k];if(!alive[e])continue;alive[e]=0;if(eR[e]&(AR_HOUSE|AR_TEMP))cutHouse.push(e);
      const w=other(e,v);deg[v]--;deg[w]--;if(deg[w]===1)Q.push(w);break;}}
  const marks=[];
  const mark=m=>{if(marks.length<opt.maxMarks)marks.push(m);};
  {// 相連的一串沒封閉房屋線只標一次，標在懸空的那一端
    const par=new Map(),f=x=>{while(par.get(x)!==x){par.set(x,par.get(par.get(x)));x=par.get(x);}return x;};
    for(const e of cutHouse)for(const v of[eU[e],eV[e]])if(!par.has(v))par.set(v,v);
    for(const e of cutHouse){const a=f(eU[e]),b=f(eV[e]);if(a!==b)par.set(a,b);}
    const grp=new Map();
    for(const e of cutHouse){const r=f(eU[e]);let g=grp.get(r);if(!g)grp.set(r,g={end:-1,e});for(const v of[eU[e],eV[e]])if(deg0[v]===1&&g.end<0)g.end=v;}
    for(const g of grp.values()){const x=g.end>=0?nX[g.end]:(nX[eU[g.e]]+nX[eV[g.e]])/2,y=g.end>=0?nY[g.end]:(nY[eU[g.e]]+nY[eV[g.e]])/2;
      mark({x,y,type:'open',msg:'房屋線沒有封閉'});}
  }
  if(opt.openOnly)return{marks,st:{open:marks.length,ms:Date.now()-t0}};
  /* 6. 找面：每個節點的出邊依角度排，沿「左手邊」繞 */
  const hAng=new Float64Array(2*NE),pos=new Int32Array(2*NE).fill(-1),out=new Array(NN);
  for(let v=0;v<NN;v++){const L=[];for(let k=aS[v];k<aS[v+1];k++){const e=aE[k];if(!alive[e])continue;const h=eU[e]===v?2*e:2*e+1,w=other(e,v);hAng[h]=Math.atan2(nY[w]-nY[v],nX[w]-nX[v]);L.push(h);}
    if(!L.length)continue;L.sort((p,q)=>hAng[p]-hAng[q]);L.forEach((h,i)=>pos[h]=i);out[v]=L;}
  const hFrom=h=>(h&1)?eV[h>>1]:eU[h>>1],hTo=h=>(h&1)?eU[h>>1]:eV[h>>1];
  const faceOf=new Int32Array(2*NE).fill(-1),faces=[];
  for(let h0=0;h0<2*NE;h0++){if(!alive[h0>>1]||faceOf[h0]>=0)continue;
    const hs=[];let h=h0,area=0,guard=0;const fid=faces.length;
    do{faceOf[h]=fid;hs.push(h);const a=hFrom(h),b=hTo(h);area+=nX[a]*nY[b]-nX[b]*nY[a];
      const L=out[b],tw=h^1;h=L[(pos[tw]-1+L.length)%L.length];}while(h!==h0&&++guard<5e6);
    faces.push({hs,area:area/2});}
  /* 7. 有界面（逆時針、面積為正）的資料 */
  const F=[],f2F=new Int32Array(faces.length).fill(-1);
  for(let fi=0;fi<faces.length;fi++){const f=faces[fi];if(!(f.area>1e-9))continue;f2F[fi]=F.length;
    const ring=new Float64Array(f.hs.length*2);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,per=0;const rl={};
    f.hs.forEach((h,i)=>{const a=hFrom(h),b=hTo(h);ring[2*i]=nX[a];ring[2*i+1]=nY[a];x0=Math.min(x0,nX[a]);y0=Math.min(y0,nY[a]);x1=Math.max(x1,nX[a]);y1=Math.max(y1,nY[a]);
      const l=Math.hypot(nX[b]-nX[a],nY[b]-nY[a]);per+=l;const r=eR[h>>1];for(const bit of[1,2,4,8,16,32,64,128,256,512])if(r&bit)rl[bit]=(rl[bit]||0)+l;});
    F.push({ring,hs:f.hs,area:f.area,bb:[x0,y0,x1,y1],per,rl,kinds:new Map(),add:[],all:[]});}
  /* 8. 點落在哪一區：包含它的面裡面積最小的（洞裡的小區自然優先） */
  const fcs=Math.max(5,cs*2),FX=Math.ceil((bx1-bx0)/fcs)+1,FY=Math.ceil((by1-by0)/fcs)+1,fcells=new Map(),fbig=[];
  F.forEach((f,i)=>{const i0=Math.floor((f.bb[0]-bx0)/fcs),i1=Math.floor((f.bb[2]-bx0)/fcs),j0=Math.floor((f.bb[1]-by0)/fcs),j1=Math.floor((f.bb[3]-by0)/fcs);
    if((i1-i0+1)*(j1-j0+1)>400){fbig.push(i);return;}for(let j=j0;j<=j1;j++)for(let k=i0;k<=i1;k++){const c=j*FX+k;let a=fcells.get(c);if(!a)fcells.set(c,a=[]);a.push(i);}});
  const inRing=(r,x,y)=>{let c=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const yi=r[i+1],yj=r[j+1];if((yi>y)!==(yj>y)&&x<(r[j]-r[i])*(y-yi)/(yj-yi)+r[i])c=!c;}return c;};
  const locate=(x,y)=>{const i=Math.floor((x-bx0)/fcs),j=Math.floor((y-by0)/fcs);let best=-1,ba=Infinity;
    const test=k=>{const f=F[k];if(f.area>=ba||x<f.bb[0]||x>f.bb[2]||y<f.bb[1]||y>f.bb[3])return;if(inRing(f.ring,x,y)){best=k;ba=f.area;}};
    if(i>=0&&j>=0&&i<FX&&j<FY){const a=fcells.get(j*FX+i);if(a)for(const k of a)test(k);}for(const k of fbig)test(k);return best;};
  let inside=0;
  const locP=p=>{if(!(p.w>0&&p.h>0)||p.w>0.6||p.h>0.6)return locate(p.x,p.y);// 圖例跨在線上時，看它大部分落在哪一區
    const c=locate(p.x,p.y),v=new Map();for(const a of[-0.8,0,0.8])for(const b of[-0.8,0,0.8]){const k=locate(p.x+a*p.w,p.y+b*p.h);v.set(k,(v.get(k)||0)+1);}
    let best=c,bn=v.get(c)||0;for(const[k,n]of v)if(k>=0&&n>bn){best=k;bn=n;}return best;};
  for(const p of points){const k=locP(p);if(k<0)continue;inside++;const f=F[k];
    if(p.add)f.add.push(p);else if(p.k){f.all.push(p);if(!f.kinds.has(p.k))f.kinds.set(p.k,p);}}
  if(opt.sub){opt.debug.dbg={F};return null;}
  /* 8b. 懸空端點歸到所在的區，並量它離最近的別條邊界線多遠（缺口） */
  const gapR=opt.gapMax||3;
  const nearest=(x,y,v)=>{let best=Infinity,bx=x,by=y;const i0=Math.max(0,Math.floor((x-gapR-bx0)/cs)),i1=Math.min(NX-1,Math.floor((x+gapR-bx0)/cs)),j0=Math.max(0,Math.floor((y-gapR-by0)/cs)),j1=Math.min(NY-1,Math.floor((y+gapR-by0)/cs));
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const a=cells.get(j*NX+i);if(!a)continue;for(const s of a){const ax=X0[s],ay=Y0[s],dx=X1[s]-ax,dy=Y1[s]-ay,l2=dx*dx+dy*dy;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=t<0?0:t>1?1:t;
      const qx=ax+dx*t,qy=ay+dy*t,d=Math.hypot(qx-x,qy-y);if(d<=tol)continue;// 自己這條或已接上的
      if(d<best){best=d;bx=qx;by=qy;}}}return best<=gapR?{d:best,x2:bx,y2:by}:null;};
  for(let v=0;v<NN;v++){if(deg0[v]!==1)continue;const k=locate(nX[v],nY[v]);if(k<0)continue;(F[k].ends||(F[k].ends=[])).push(v);}
  const nearK=(x,y)=>{// 最近的幾條不同線上的點（不只最近那條，避免補到旁邊平行的線）
    const L=[];const i0=Math.max(0,Math.floor((x-gapR-bx0)/cs)),i1=Math.min(NX-1,Math.floor((x+gapR-bx0)/cs)),j0=Math.max(0,Math.floor((y-gapR-by0)/cs)),j1=Math.min(NY-1,Math.floor((y+gapR-by0)/cs));const seen=new Set();
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const a=cells.get(j*NX+i);if(!a)continue;for(const s of a){if(seen.has(s))continue;seen.add(s);const ax=X0[s],ay=Y0[s],dx=X1[s]-ax,dy=Y1[s]-ay,l2=dx*dx+dy*dy;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=t<0?0:t>1?1:t;
      const qx=ax+dx*t,qy=ay+dy*t,d=Math.hypot(qx-x,qy-y);if(d<=tol||d>gapR)continue;L.push({d,x2:qx,y2:qy});}}
    L.sort((a,b)=>a.d-b.d);const out=[];for(const c of L){if(out.some(o=>Math.hypot(o.x2-c.x2,o.y2-c.y2)<0.05))continue;out.push(c);if(out.length>=4)break;}return out;};
  /* 8c. 找真正讓兩區相通的缺口：把候選缺口補起來，看兩種屬性（或地物和道路）有沒有被分開；凸出去的小段補了也分不開就不算 */
  const findGap=(f,mode)=>{
    const C=[];for(const v of f.ends||[])for(const n of nearK(nX[v],nY[v]))C.push({x:nX[v],y:nY[v],x2:n.x2,y2:n.y2,d:n.d});
    // 沒有端點的缺口：線的轉角離另一條線很近但沒碰到（例如柵欄轉角擦過房屋線）
    {const seenV=new Set();for(const h of f.hs){const v=hFrom(h);if(seenV.has(v))continue;seenV.add(v);const n=nearK(nX[v],nY[v])[0];if(n&&n.d<=2)C.push({x:nX[v],y:nY[v],x2:n.x2,y2:n.y2,d:n.d});}}
    if(!C.length)return null;C.sort((a,b)=>a.d-b.d);if(C.length>60)C.length=60;
    const seg=e=>({p:[nX[eU[e]],nY[eU[e]],nX[eV[e]],nY[eV[e]]],r:eR[e]});
    const base=[];for(const h of f.hs)base.push(seg(h>>1));
    {// 區域裡面的線（懸空的、島狀的）也要放進來
      const i0=Math.max(0,Math.floor((f.bb[0]-bx0)/cs)),i1=Math.min(NX-1,Math.floor((f.bb[2]-bx0)/cs)),j0=Math.max(0,Math.floor((f.bb[1]-by0)/cs)),j1=Math.min(NY-1,Math.floor((f.bb[3]-by0)/cs));const seen=new Set();
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const a=cells.get(j*NX+i);if(!a)continue;for(const q of a){if(seen.has(q))continue;seen.add(q);const mx=(X0[q]+X1[q])/2,my=(Y0[q]+Y1[q])/2;
        if(mx<f.bb[0]||mx>f.bb[2]||my<f.bb[1]||my>f.bb[3])continue;if(inRing(f.ring,mx,my))base.push({p:[X0[q],Y0[q],X1[q],Y1[q]],r:R[q]});}}}
    let full=true;// 先找能把每一種都分開的缺口組合，找不到才退而求其次
    const ok=SF=>{if(mode==='mix'){let mx=0;for(const g of SF)mx=Math.max(mx,g.kinds.size);return full?mx<=1:mx<f.kinds.size;}
      const g=SF.find(g=>g.kinds.size);if(!g)return false;return((g.rl[AR_ROAD]||0)+(g.rl[AR_WALK]||0))<g.per*0.5&&g.area<f.area*0.9;};
    const test=set=>{const d={};areaCheck(base.concat(set.map(c=>({p:[c.x,c.y,c.x2,c.y2],r:AR_OTHER}))),f.all,{tol,sub:true,debug:d});return!!(d.dbg&&ok(d.dbg.F));};
    if(!test(C)){if(mode!=='mix'||f.kinds.size<3)return null;full=false;if(!test(C))return null;}// 全部補起來都分不開，就沒有缺口
    for(const c of C)if(test([c]))return Object.assign({all:[c]},c);
    // 不只一個缺口：逐一拿掉不需要的
    if(C.length<2)return null;
    let set=C.slice();for(let i=set.length-1;i>=0&&set.length>1;i--){const t=set.slice(0,i).concat(set.slice(i+1));if(test(t))set=t;}
    return Object.assign({all:set},set[0]);};
  const pathOf=(f,c,mode)=>{const mx=c?(c.x+c.x2)/2:null,my=c?(c.y+c.y2)/2:null;
    if(mode==='mix'){const ks=[...f.kinds.keys()];
      if(!c){const a=f.kinds.get(ks[0]),b=f.kinds.get(ks[1]);return[a.x,a.y,b.x,b.y];}
      const P=ks.map(k=>{let b=null,bd=Infinity;for(const p of f.all)if(p.k===k){const d=Math.hypot(p.x-mx,p.y-my);if(d<bd){bd=d;b=p;}}return b;}).sort((a,b)=>Math.hypot(a.x-mx,a.y-my)-Math.hypot(b.x-mx,b.y-my));
      return[P[0].x,P[0].y,mx,my,P[1].x,P[1].y];}
    let A=null,bd=Infinity;for(const p of f.all){const d=Math.hypot(p.x-mx,p.y-my);if(d<bd){bd=d;A=p;}}
    const dx=mx-A.x,dy=my-A.y,L=Math.hypot(dx,dy)||1;return[A.x,A.y,mx,my,mx+dx/L*3,my+dy/L*3];};
  const gapTxt=d=>d<0.1?d.toFixed(3):d.toFixed(2);
  /* 8d. 接邊：圖框兩側屬性要一樣、碰到圖框的範圍線對面要接著畫 */
  const edgeMarks=[];
  if(eR.some(r=>r&AR_FRAME)){
    const FB=[];for(const L of lines)if(L.r&AR_FRAME){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<L.p.length;i+=2){x0=Math.min(x0,L.p[i]);x1=Math.max(x1,L.p[i]);y0=Math.min(y0,L.p[i+1]);y1=Math.max(y1,L.p[i+1]);}if(x1-x0>50&&y1-y0>50)FB.push([x0,y0,x1,y1]);}
    // 已出圖的圖幅：格子裡除了圖框以外還有東西（圖號、範圍線不在輸入裡）
    const pub=FB.map(()=>false);for(const L of lines){if(L.r&AR_FRAME)continue;const x=L.p[0],y=L.p[1];FB.forEach((b,i)=>{if(!pub[i]&&x>b[0]&&x<b[2]&&y>b[1]&&y<b[3])pub[i]=true;});}
    for(const p of points)FB.forEach((b,i)=>{if(!pub[i]&&p.x>b[0]&&p.x<b[2]&&p.y>b[1]&&p.y<b[3])pub[i]=true;});
    const inFr=(x,y)=>FB.some((b,i)=>pub[i]&&x>b[0]&&x<b[2]&&y>b[1]&&y<b[3]);
    const both=(x,y,dx,dy)=>{const L=Math.hypot(dx,dy)||1,nx=-dy/L*0.5,ny=dx/L*0.5;return inFr(x+nx,y+ny)&&inFr(x-nx,y-ny);};/* 兩側都已出圖才比 */
    // 剛好停在圖框上的線端（差 2mm 內）才算「中斷」；停在圖框外幾公分、或越過一小段才換線的不算
    const onFr=(x,y)=>FB.some(b=>(Math.abs(x-b[0])<0.002||Math.abs(x-b[2])<0.002)&&y>=b[1]-0.002&&y<=b[3]+0.002||(Math.abs(y-b[1])<0.002||Math.abs(y-b[3])<0.002)&&x>=b[0]-0.002&&x<=b[2]+0.002);
    const exact=new Set();for(const L of lines){if(L.r&(AR_FRAME|AR_ADD))continue;const p=L.p,n=p.length;for(const[x,y]of[[p[0],p[1]],[p[n-2],p[n-1]]])if(onFr(x,y))exact.add(Math.round(x*10)+','+Math.round(y*10));}
    const isExact=(x,y)=>{const a=Math.round(x*10),b=Math.round(y*10);for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)if(exact.has((a+i)+','+(b+j)))return true;return false;};
    const seenP=new Set(),cat=r=>r&(AR_HOUSE|AR_TEMP)?'房屋線':r&AR_ADD?'增建線':r&(AR_ROAD|AR_WALK)?'道路線':r&AR_WATER?'水涯線':'範圍線';
    const R0=30;// 屬性只比圖框邊附近 30m 內的圖例，遠處缺口造成的不算
    for(let e=0;e<NE;e++){if(!alive[e]||!(eR[e]&AR_FRAME))continue;const a=f2F[faceOf[2*e]],b=f2F[faceOf[2*e+1]];if(a<0||b<0||a===b)continue;
      const mx=(nX[eU[e]]+nX[eV[e]])/2,my=(nY[eU[e]]+nY[eV[e]])/2;if(!both(mx,my,nX[eV[e]]-nX[eU[e]],nY[eV[e]]-nY[eU[e]]))continue;
      const near=f=>{const m=new Map();for(const p of f.all){const d=Math.hypot(p.x-mx,p.y-my);if(d<R0&&(!m.has(p.k)||d<m.get(p.k).d))m.set(p.k,{p,d});}return m;};
      const A=near(F[a]),B=near(F[b]);if(!A.size||!B.size)continue;if([...A.keys()].some(k=>B.has(k)))continue;
      const key=[...A.keys()].sort().join()+'|'+[...B.keys()].sort().join()+'|'+Math.round(mx/20)+','+Math.round(my/20);if(seenP.has(key))continue;seenP.add(key);
      const nm=m=>[...m.keys()].map(k=>k==='H'?'房屋':k).join('＋'),pa=[...A.values()].sort((x,y)=>x.d-y.d)[0].p,pb=[...B.values()].sort((x,y)=>x.d-y.d)[0].p;
      edgeMarks.push({x:mx,y:my,type:'edge',msg:`接邊：圖框兩側屬性不同（${nm(A)}｜${nm(B)}）`,path:[pa.x,pa.y,mx,my,pb.x,pb.y]});}
    for(let v=0;v<NN;v++){let fd=null;const side=[[],[]];
      for(let k=aS[v];k<aS[v+1];k++){const e=aE[k];if(eR[e]&AR_FRAME&&!fd){const w=other(e,v);fd=[nX[w]-nX[v],nY[w]-nY[v]];}}
      if(!fd||!both(nX[v],nY[v],fd[0],fd[1]))continue;
      for(let k=aS[v];k<aS[v+1];k++){const e=aE[k];if(eR[e]&(AR_FRAME|AR_ADD))continue;/* 增建交圖時關掉，不比 */const w=other(e,v),c=fd[0]*(nY[w]-nY[v])-fd[1]*(nX[w]-nX[v]),L=Math.hypot(fd[0],fd[1])*Math.hypot(nX[w]-nX[v],nY[w]-nY[v]);if(!L||Math.abs(c)/L<0.05)continue;side[c>0?0:1].push(cat(eR[e]));}
      if(!side[0].length&&!side[1].length)continue;
      if(!side[0].length||!side[1].length){if(!isExact(nX[v],nY[v]))continue;const s=side[0].length?side[0]:side[1];edgeMarks.push({x:nX[v],y:nY[v],type:'edge',msg:`接邊：${s[0]}碰到圖框，對面沒有接著畫（中斷）`});continue;}
      const h0=side[0].includes('房屋線'),h1=side[1].includes('房屋線');if(h0!==h1)edgeMarks.push({x:nX[v],y:nY[v],type:'edge',msg:'接邊：圖框兩側的線種類不同（一邊是房屋線）'});}
  }
  /* 9. 判斷 */
  const inner=f=>{// 區域裡的一點：重心不在裡面就取過重心那條水平線最寬的一段中點
    const r=f.ring;let cx=0,cy=0,a=0;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const c=r[j]*r[i+1]-r[i]*r[j+1];a+=c;cx+=(r[j]+r[i])*c;cy+=(r[j+1]+r[i+1])*c;}
    cx/=3*a;cy/=3*a;if(inRing(r,cx,cy))return[cx,cy];const xs=[];
    for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const yi=r[i+1],yj=r[j+1];if((yi>cy)!==(yj>cy))xs.push(r[i]+(r[j]-r[i])*(cy-yi)/(yj-yi));}
    xs.sort((p,q)=>p-q);let bw=-1,bx=cx;for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>bw){bw=xs[i+1]-xs[i];bx=(xs[i]+xs[i+1])/2;}return[bx,cy];};
  const cnt={mix:0,road:0,addout:0,empty:0,open:marks.length,edge:0};
  for(const f of F){const rl=b=>f.rl[b]||0;
    if(opt.keep&&f.all.length&&!f.all.some(p=>opt.keep(p.x,p.y)))continue;// 作業範圍外的不用找
    if(f.kinds.has('H')&&opt.withHouse)for(const k of opt.withHouse)f.kinds.delete(k);// 七碼寺廟（卍）可以和樓層註記同區
    if(f.kinds.size>1){const names=[...f.kinds.keys()].map(k=>k==='H'?'房屋':k),g=findGap(f,'mix');
      if(g)mark({x:g.x,y:g.y,type:'mix',msg:`一區兩種屬性：${names.join('＋')}（缺口 ${g.all.map(c=>gapTxt(c.d)).join('、')}m）`,ring:f.ring,gap:g.all.flatMap(c=>[c.x,c.y,c.x2,c.y2]),path:pathOf(f,g,'mix')});
      else{const cntK=new Map();for(const p of f.all)cntK.set(p.k,(cntK.get(p.k)||0)+1);const mk=[...cntK].sort((x,y)=>x[1]-y[1])[0][0],a=f.all.find(p=>p.k===mk);// 標在比較少的那種
        mark({x:a.x,y:a.y,type:'mix',msg:'一區兩種屬性：'+names.join('＋')+'（找不到 3m 內的缺口：可能少畫地類界，或圖例壓在線上）',ring:f.ring,path:pathOf(f,null,'mix')});}cnt.mix++;continue;}
    if(f.kinds.size&&(f.ends||[]).length&&rl(AR_ROAD)+rl(AR_WALK)>=f.per*0.5){const g=findGap(f,'road');
      if(g){const nm=[...f.kinds.keys()].map(k=>k==='H'?'房屋':k).join('＋');mark({x:g.x,y:g.y,type:'road',msg:`${nm}和道路／人行道相通（缺口 ${g.all.map(c=>gapTxt(c.d)).join('、')}m）`,ring:f.ring,gap:g.all.flatMap(c=>[c.x,c.y,c.x2,c.y2]),path:pathOf(f,g,'road')});cnt.road++;continue;}}
    if(f.add.length&&!f.kinds.has('H')&&(f.kinds.size||rl(AR_HOUSE)+rl(AR_TEMP)+rl(AR_ADD)<f.per*0.5)){const p=f.add[0];
      mark({x:p.x,y:p.y,type:'addout',msg:'增建註記不在房屋／增建範圍裡'+(f.kinds.size?'（和'+[...f.kinds.keys()][0]+'同區）':''),ring:f.ring});cnt.addout++;continue;}
    if(f.kinds.size||f.add.length)continue;
    if(f.area<opt.minArea||f.area>opt.maxArea||2*f.area/f.per<opt.thin)continue;
    // 只抓永久性房屋之間（或房屋裡）的空白：碰到增建線、臨時性／建築中房屋的都略過
    if(rl(AR_ADD)>0||rl(AR_TEMP)>0||rl(AR_GATE)>0||rl(AR_STAIR)>0||rl(AR_WALK)+rl(AR_ROAD)>=f.per*0.2||rl(AR_HOUSE)<f.per*0.5)continue;
    const c=inner(f);mark({x:c[0],y:c[1],type:'empty',msg:`沒有屬性的區域（${f.area<10?f.area.toFixed(1):Math.round(f.area)} m²）`,ring:f.ring});cnt.empty++;}
  if(opt.debug)opt.debug.dbg={nX,nY,deg0,eU,eV,eR,alive,F};
  for(const m of edgeMarks){if(marks.some(q=>q.type==='edge'&&Math.hypot(q.x-m.x,q.y-m.y)<1))continue;mark(m);cnt.edge++;}
  return{marks,st:Object.assign(cnt,{seg:ns,node:NN,edge:NE,face:F.length,pts:points.length,inside,ms:Date.now()-t0})};
}
if(typeof module!=='undefined')module.exports={areaRole,areaCheck,areaKindName,AR_HOUSE,AR_ADD,AR_WALK,AR_ROAD,AR_WATER,AR_OTHER,AR_TEMP};
