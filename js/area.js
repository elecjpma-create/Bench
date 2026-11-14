/* ---------- 區域檢查（規格：docs/Bench_QA_SPEC_v1.1 ＋ docs/區域檢查補充與待辦.md） ----------
   邊界線打散後在交點、T 字接點互相接起來，切成一塊塊封閉區域（不必是 close 的聚合線），
   再看每一區裡的註記和圖例。純計算，不碰畫面；坐標請先減掉原點。
   ・圖框永遠不當地物邊界（G02）；接邊另外用「區域被圖框切開的兩側」和「線和圖框的交點」比對。
   ・房屋封閉只用房屋線（永久／臨時／建築中；七碼屋頂增建算永久），不借其他線、不借增建線。
   ・樓層衝突用房屋線自己圍出的區域判斷（分棟線、增建線都不算分界）。 */
const AR_HOUSE=1,AR_ADD=2,AR_WALK=4,AR_ROAD=8,AR_WATER=16,AR_OTHER=32,AR_TEMP=64,AR_GATE=128,AR_STAIR=256,AR_FRAME=512,AR_FREE=1024,AR_LB=2048,AR_ELEV=4096,AR_WALL=8192;// LB＝地類界、田埂（不得自由線存在）；ELEV＝高架道路；WALL＝牆系（圍牆、柵欄…，臨時性房屋可借來封閉）
// HOUSE＝永久性房屋，TEMP＝建築中、臨時性（也要封閉）；FREE＝可以單獨懸空的線（圍牆、柵欄、籬、駁坎、土坎、堤…），端點不當缺口
const AR_TEMPC=new Set(['93120','93130','9310200','9310300']);
// 不當邊界也不當地物的圖層
const AR_IGN=/行道樹|防風林|流向|號誌|標誌|水管|油管|瓦斯管|輸送|配電|電信線|高壓|電桿|電線桿|電力桿|電信桿|路燈|人孔|變壓器|交接箱|消防栓|曲線|標高|地名|編號|分棟|郵筒|電話亭|單線水|小水溝|纜車|索道|噴泉|廣告|候車|獨立墓|GIS|註記|線號|等界|接邊|問題/;
// 可單獨存在的附屬設施：圖塊＝圖例（不算主要地物），用該圖層直接畫的散線＝範圍線
const AR_FAC=/水塔|金爐|油槽|儲存槽|貯存槽|變壓箱座|電信箱座|交換箱|瞭望|亭$|煙囪|紀念碑|紀念像/;// 紀念碑、紀念像：可單獨存在，底座大時可用自身圖層畫範圍
// 大型設施：要被範圍線包起來（哪一層的線都可以）並有自己的圖例（圖例算主要地物）
const AR_BIGFAC=/變電所|變電站|變壓站|抽水站|升旗|司令臺|司令台|捷運站出入口|地下道出入口|水池|濕地|魚池|養殖池|游泳池|加油站|牌樓|牌坊/;
const AR_KIND93=/墓地|堆積場|堆置場|廢墟|游泳池|球場|運動場|體育場/;
const AR_KIND93C=new Set(['93523','93726','93902','93553','93555','93556']);
const AR_SINGLE=new Set(['95116','95153','94901','94902','9510110','9510503']);
const AR_FREEN=/圍牆|牆|圍籬|垣|柵欄|欄|網|籬|駁坎|擋土牆|土坎|堤/;

/** 圖層角色：{b:邊界種類, a:地物代碼（圖塊、文字算這種地物）, land:散線也算地物, t:'house'|'add'|'temp' 房屋文字層, fac:附屬設施} 或 null */
function areaRole(name){
  const m=/^(a?)(\d{5,7})([A-Za-z]*)/i.exec(name);
  if(/^Q(-|$)/i.test(name))return{b:AR_OTHER};// 立製無法判定的線也算邊界
  if(!m)return/增建/.test(name)?(/TXT|註記/i.test(name)?{t:'add'}:{b:AR_ADD,t:'add'}):null;
  const code=m[2],suf=m[3].toUpperCase(),isTxt=suf==='TXT'||suf==='X';
  if(code.startsWith('931')){
    if(isTxt)return{t:(code==='9310102'||/增建/.test(name))?'add':'house'};
    if(suf==='ADD'||code==='9310102'||/增建/.test(name))return{b:AR_ADD,t:'add'};
    if(code==='93111')return{b:AR_OTHER};
    return AR_TEMPC.has(code)||/建築中|臨時/.test(name)?{b:AR_TEMP,t:'temp'}:{b:AR_HOUSE,t:'house'};// 臨時性房屋上的 T（文字或圖塊）就是房屋註記
  }
  if(isTxt)return/加油站/.test(name)?{a:code,big:true}:null;
  if(/獨立樹/.test(name))return{fac:true};// 獨立樹：可和其他地物共存，也可單獨在一個封閉區（人行道、欄杆、地類界、駁坎圍起來的）
  if(/高架/.test(name))return{b:AR_ROAD|AR_ELEV};// 高架道路：當邊界，橋頭懸空不報；平面道路不可跨越
  if(AR_BIGFAC.test(name))return{b:AR_OTHER,a:code,big:true};
  if(AR_FAC.test(name))return{b:AR_OTHER,fac:true};
  if(AR_KIND93.test(name)&&!AR_IGN.test(name))return{b:AR_OTHER,a:code};
  if(AR_IGN.test(name)||AR_SINGLE.has(code)||code==='9310101')return null;
  if(/階梯/.test(name)||code==='93904'||code==='9390004')return{b:AR_OTHER|AR_STAIR};// 階梯格子不用註記
  if(/寺廟|廟宇/.test(name)||code==='93612')return{b:AR_OTHER,a:code,withH:code.length===7};// 卍；七碼可以和樓層註記同區
  if(code.startsWith('97')){
    if(/地類界|田埂/.test(name)||['97920','97921','97922','9790201','9790202'].includes(code))return{b:AR_OTHER|AR_LB};
    return{a:code,land:true};
  }
  if(code.startsWith('932'))return/門/.test(name)||code==='93270'||code==='9320700'?{b:AR_OTHER|AR_GATE,gb:true,gate:true}:{b:AR_OTHER|AR_FREE|AR_WALL};// 門：兩個門之間有一條看不見的地類界
  if(/停車場/.test(name)||code.startsWith('94229'))return/出入口/.test(name)||suf==='D'?{b:AR_OTHER|AR_GATE,gb:true}:{b:AR_OTHER,a:code};
  if(/分隔島|小徑/.test(name)||['94224','9421003','94216','94217','9420901','9420902'].includes(code))return{b:AR_OTHER};// 小徑（單線步道）也算分界
  if(code.startsWith('942'))return(/人行道/.test(name)||code==='94218'||code==='9421006')?{b:AR_WALK}:{b:AR_ROAD};
  if(AR_FREEN.test(name)||code==='94436'||code==='94433'||code==='95134')return{b:AR_OTHER|AR_FREE};
  if(code.startsWith('944'))return/橋|涵/.test(name)?{b:AR_OTHER,wing:true}:{b:AR_OTHER};// 橋、涵的 45° 小翅膀不算
  if(code.startsWith('95'))return{b:AR_WATER};
  if(code.startsWith('93'))return(AR_KIND93.test(name)||AR_KIND93C.has(code))?{b:AR_OTHER,a:code}:{b:AR_OTHER};
  return null;
}
const areaKindName=n=>n.replace(/^a?\d+[A-Za-z]*_?/,'')||n;
// 同義名稱：圃＝花圃、球場＝體育場
const areaSyn=n=>n==='圃'?'花圃':n==='球場'||n==='運動場'?'體育場':n;

/** 前處理：兩個門之間補一條看不見的地類界；門、出入口線懸空的端點接到 1 公尺內最近的線 */
function areaPrep(lines,opt){
  const out=lines.slice(),G=opt.gates||[];
  if(G.length>1){const used=new Set();
    const nn=i=>{let b=-1,bd=15;for(let j=0;j<G.length;j++){if(j===i)continue;const d=Math.hypot(G[j][0]-G[i][0],G[j][1]-G[i][1]);if(d<bd){bd=d;b=j;}}return b;};
    for(let i=0;i<G.length;i++){const j=nn(i);if(j<0||nn(j)!==i||used.has(i))continue;used.add(i);used.add(j);out.push({p:[G[i][0],G[i][1],G[j][0],G[j][1]],r:AR_OTHER|AR_GATE});}}
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

/* ---------- 拓樸：線段→交點打斷→節點→邊 ---------- */
function arGraph(lines,tol){
  let n=0;for(const L of lines)n+=Math.max(0,L.p.length/2-1);
  const X0=new Float64Array(n),Y0=new Float64Array(n),X1=new Float64Array(n),Y1=new Float64Array(n),R=new Uint16Array(n),SL=new Int32Array(n);
  let ns=0;
  lines.forEach((L,li)=>{const p=L.p;for(let i=2;i<p.length;i+=2){const a=p[i-2],b=p[i-1],c=p[i],d=p[i+1];
    if(!(isFinite(a)&&isFinite(b)&&isFinite(c)&&isFinite(d)))continue;if(Math.abs(a-c)+Math.abs(b-d)<1e-9)continue;
    X0[ns]=a;Y0[ns]=b;X1[ns]=c;Y1[ns]=d;R[ns]=L.r;SL[ns]=li;ns++;}});
  const G={ns,X0,Y0,X1,Y1,R,SL,tol};
  if(!ns)return G;
  let bx0=Infinity,by0=Infinity,bx1=-Infinity,by1=-Infinity;
  for(let i=0;i<ns;i++){bx0=Math.min(bx0,X0[i],X1[i]);by0=Math.min(by0,Y0[i],Y1[i]);bx1=Math.max(bx1,X0[i],X1[i]);by1=Math.max(by1,Y0[i],Y1[i]);}
  // 格網：長線只登記它經過的格子
  const cs=Math.max(2,Math.sqrt((bx1-bx0+1)*(by1-by0+1)/ns)*2),NX=Math.ceil((bx1-bx0)/cs)+1,NY=Math.ceil((by1-by0)/cs)+1;
  const cellOf=(x,y)=>{let i=Math.floor((x-bx0)/cs),j=Math.floor((y-by0)/cs);i=i<0?0:i>=NX?NX-1:i;j=j<0?0:j>=NY?NY-1:j;return j*NX+i;};
  const cells=new Map(),add=(c,s)=>{let a=cells.get(c);if(!a)cells.set(c,a=[]);if(a[a.length-1]!==s)a.push(s);};
  for(let s=0;s<ns;s++){
    const ax=X0[s],ay=Y0[s],bx=X1[s],by=Y1[s],xl=Math.min(ax,bx)-tol,xr=Math.max(ax,bx)+tol;
    const yAt=x=>{if(Math.abs(bx-ax)<1e-12)return null;let t=(x-ax)/(bx-ax);t=t<0?0:t>1?1:t;return ay+(by-ay)*t;};
    const i0=Math.max(0,Math.floor((xl-bx0)/cs)),i1=Math.min(NX-1,Math.floor((xr-bx0)/cs));
    for(let i=i0;i<=i1;i++){const cx0=Math.max(xl,bx0+i*cs),cx1=Math.min(xr,bx0+(i+1)*cs);let ya=yAt(cx0-tol),yb=yAt(cx1+tol);
      if(ya===null){ya=ay;yb=by;}const lo=Math.min(ya,yb)-tol,hi=Math.max(ya,yb)+tol;
      const j0=Math.max(0,Math.floor((lo-by0)/cs)),j1=Math.min(NY-1,Math.floor((hi-by0)/cs));for(let j=j0;j<=j1;j++)add(j*NX+i,s);}
  }
  // 交點、T 字接點：在事件點所在的那一格處理，同一對線不會重複
  const splits=new Array(ns),tolSq=tol*tol;
  const putSplit=(s,t)=>{(splits[s]||(splits[s]=[])).push(t);};
  const onSeg=(px,py,s,cell)=>{
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
  // 節點（容許誤差內併成一點）、邊（重複的線只算一次）
  const nX=[],nY=[],nodeMap=new Map(),inv=1/tol;
  const node=(x,y)=>{const ix=Math.floor(x*inv),iy=Math.floor(y*inv);let best=-1,bd=tolSq;
    for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=nodeMap.get((ix+a)*4194304+(iy+b));if(!l)continue;for(const k of l){const dx=nX[k]-x,dy=nY[k]-y,dd=dx*dx+dy*dy;if(dd<=bd){bd=dd;best=k;}}}
    if(best>=0)return best;const k=nX.length;nX.push(x);nY.push(y);const key=ix*4194304+iy;let l=nodeMap.get(key);if(!l)nodeMap.set(key,l=[]);l.push(k);return k;};
  const eU=[],eV=[],eR=[],eL=[],eMap=new Map();
  for(let s=0;s<ns;s++){const T=splits[s]?[0,...splits[s].sort((p,q)=>p-q),1]:[0,1];let prev=-1;
    for(const t of T){const k=node(X0[s]+(X1[s]-X0[s])*t,Y0[s]+(Y1[s]-Y0[s])*t);
      if(prev>=0&&k!==prev){const lo=Math.min(k,prev),hi=Math.max(k,prev),key=lo*4194304+hi;const e=eMap.get(key);
        if(e==null){eMap.set(key,eU.length);eU.push(lo);eV.push(hi);eR.push(R[s]);eL.push(SL[s]);}else eR[e]|=R[s];}
      prev=k;}}
  const NN=nX.length,NE=eU.length,deg0=new Int32Array(NN);
  for(let e=0;e<NE;e++){deg0[eU[e]]++;deg0[eV[e]]++;}
  const aS=new Int32Array(NN+1);for(let v=0;v<NN;v++)aS[v+1]=aS[v]+deg0[v];
  const aE=new Int32Array(2*NE),fill=aS.slice(0,NN);
  for(let e=0;e<NE;e++){aE[fill[eU[e]]++]=e;aE[fill[eV[e]]++]=e;}
  const nearSeg=(x,y,d)=>{const a=cells.get(cellOf(x,y));if(!a)return null;let b=null,bd=d;
    for(const s of a){const ax=X0[s],ay=Y0[s],dx=X1[s]-ax,dy=Y1[s]-ay,l2=dx*dx+dy*dy;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=t<0?0:t>1?1:t;const q=Math.hypot(ax+dx*t-x,ay+dy*t-y);if(q<=bd){bd=q;const l=Math.sqrt(l2);b={d:q,nx:-dy/l,ny:dx/l};}}return b;};
  return Object.assign(G,{nearSeg,bx0,by0,bx1,by1,cs,NX,NY,cellOf,cells,nX,nY,eU,eV,eR,eL,NN,NE,deg0,aS,aE,other:(e,v)=>eU[e]===v?eV[e]:eU[e]});
}
/** 一直剪掉懸空的線，回傳 {alive, cut:被剪掉的邊} */
function arPrune(G){
  const{NN,NE,aS,aE,deg0}=G,alive=new Uint8Array(NE).fill(1),deg=deg0.slice(),Q=[],cut=[];
  for(let v=0;v<NN;v++)if(deg[v]===1)Q.push(v);
  while(Q.length){const v=Q.pop();if(deg[v]!==1)continue;
    for(let k=aS[v];k<aS[v+1];k++){const e=aE[k];if(!alive[e])continue;alive[e]=0;cut.push(e);
      const w=G.other(e,v);deg[v]--;deg[w]--;if(deg[w]===1)Q.push(w);break;}}
  return{alive,cut};
}
const arInRing=(r,x,y)=>{let c=false;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const yi=r[i+1],yj=r[j+1];if((yi>y)!==(yj>y)&&x<(r[j]-r[i])*(y-yi)/(yj-yi)+r[i])c=!c;}return c;};
/** 找面：每個節點的出邊依角度排，沿「左手邊」繞；回傳有界面 F 與 locate(x,y) */
function arFaces(G,alive){
  const{NN,NE,aS,aE,eU,eV,eR,nX,nY}=G;
  const hAng=new Float64Array(2*NE),pos=new Int32Array(2*NE).fill(-1),out=new Array(NN);
  for(let v=0;v<NN;v++){const L=[];for(let k=aS[v];k<aS[v+1];k++){const e=aE[k];if(!alive[e])continue;const h=eU[e]===v?2*e:2*e+1,w=G.other(e,v);hAng[h]=Math.atan2(nY[w]-nY[v],nX[w]-nX[v]);L.push(h);}
    if(!L.length)continue;L.sort((p,q)=>hAng[p]-hAng[q]);L.forEach((h,i)=>pos[h]=i);out[v]=L;}
  const hFrom=h=>(h&1)?eV[h>>1]:eU[h>>1],hTo=h=>(h&1)?eU[h>>1]:eV[h>>1];
  const faceOf=new Int32Array(2*NE).fill(-1),faces=[];
  for(let h0=0;h0<2*NE;h0++){if(!alive[h0>>1]||faceOf[h0]>=0)continue;
    const hs=[];let h=h0,area=0,guard=0;const fid=faces.length;
    do{faceOf[h]=fid;hs.push(h);const a=hFrom(h),b=hTo(h);area+=nX[a]*nY[b]-nX[b]*nY[a];
      const L=out[b],tw=h^1;h=L[(pos[tw]-1+L.length)%L.length];}while(h!==h0&&++guard<5e6);
    faces.push({hs,area:area/2});}
  const F=[],f2F=new Int32Array(faces.length).fill(-1);
  for(let fi=0;fi<faces.length;fi++){const f=faces[fi];if(!(f.area>1e-9))continue;f2F[fi]=F.length;
    const ring=new Float64Array(f.hs.length*2);let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity,per=0;const rl={};
    f.hs.forEach((h,i)=>{const a=hFrom(h),b=hTo(h);ring[2*i]=nX[a];ring[2*i+1]=nY[a];x0=Math.min(x0,nX[a]);y0=Math.min(y0,nY[a]);x1=Math.max(x1,nX[a]);y1=Math.max(y1,nY[a]);
      const l=Math.hypot(nX[b]-nX[a],nY[b]-nY[a]);per+=l;const r=eR[h>>1];for(let bit=1;bit<=AR_WALL;bit<<=1)if(r&bit)rl[bit]=(rl[bit]||0)+l;});
    F.push({id:F.length,ring,hs:f.hs,area:f.area,bb:[x0,y0,x1,y1],per,rl,kinds:new Map(),add:[],all:[],fl:[],fac:[]});}
  // 點落在哪一區：包含它的面裡面積最小的（洞裡的小區自然優先）
  const{bx0,by0,bx1,by1,cs}=G,fcs=Math.max(5,cs*2),FX=Math.ceil((bx1-bx0)/fcs)+1,FY=Math.ceil((by1-by0)/fcs)+1,fcells=new Map(),fbig=[];
  F.forEach((f,i)=>{const i0=Math.floor((f.bb[0]-bx0)/fcs),i1=Math.floor((f.bb[2]-bx0)/fcs),j0=Math.floor((f.bb[1]-by0)/fcs),j1=Math.floor((f.bb[3]-by0)/fcs);
    if((i1-i0+1)*(j1-j0+1)>400){fbig.push(i);return;}for(let j=j0;j<=j1;j++)for(let k=i0;k<=i1;k++){const c=j*FX+k;let a=fcells.get(c);if(!a)fcells.set(c,a=[]);a.push(i);}});
  const locate=(x,y)=>{const i=Math.floor((x-bx0)/fcs),j=Math.floor((y-by0)/fcs);let best=-1,ba=Infinity;
    const test=k=>{const f=F[k];if(f.area>=ba||x<f.bb[0]||x>f.bb[2]||y<f.bb[1]||y>f.bb[3])return;if(arInRing(f.ring,x,y)){best=k;ba=f.area;}};
    if(i>=0&&j>=0&&i<FX&&j<FY){const a=fcells.get(j*FX+i);if(a)for(const k of a)test(k);}for(const k of fbig)test(k);return best;};
  return{F,f2F,faceOf,locate,hFrom,hTo};
}
/** 點放進區域：圖例跨在線上時，看它大部分落在哪一區 */
function arPlace(T,points,G){
  const{F,locate}=T;let inside=0;
  for(const p of points){if(G&&p._x==null){p._x=1;const n=G&&G.nearSeg?G.nearSeg(p.x,p.y,0.001):null;
      if(n){// 插入點剛好壓在線上：往文字中心（沒有就往線的一側）偏 1mm
        let dx=p.cx!=null?p.cx-p.x:n.nx,dy=p.cx!=null?p.cy-p.y:n.ny;const l=Math.hypot(dx,dy)||1;p.x+=dx/l*0.001;p.y+=dy/l*0.001;}}
    const k=locate(p.x,p.y);p._f=k;if(k<0)continue;inside++;const f=F[k];// 圖例一律以插入點為準
    if(p.add)f.add.push(p);else if(p.fac)f.fac.push(p);else if(p.k){f.all.push(p);if(p.fl)f.fl.push(p);if(!f.kinds.has(p.k))f.kinds.set(p.k,p);}}
  return inside;
}
/** 只要分區（找缺口時試補線用） */
function arSplit(lines,points,tol){const G=arGraph(lines,tol);if(!G.ns)return[];const P=arPrune(G),T=arFaces(G,P.alive);arPlace(T,points.map(p=>Object.assign({},p)));return T.F;}

/** 相連的一串被剪掉的邊只標一次，標在懸空的那一端 */
function arChains(G,edges,ok){
  const{eU,eV,nX,nY,deg0}=G,par=new Map(),f=x=>{while(par.get(x)!==x){par.set(x,par.get(par.get(x)));x=par.get(x);}return x;};
  const E=edges.filter(e=>!ok||ok(e));
  for(const e of E)for(const v of[eU[e],eV[e]])if(!par.has(v))par.set(v,v);
  for(const e of E){const a=f(eU[e]),b=f(eV[e]);if(a!==b)par.set(a,b);}
  const grp=new Map();
  for(const e of E){const r=f(eU[e]);let g=grp.get(r);if(!g)grp.set(r,g={ends:[],e,es:[]});g.es.push(e);for(const v of[eU[e],eV[e]])if(deg0[v]===1)g.ends.push(v);}
  return[...grp.values()].map(g=>{const v=g.ends[0];return{x:v!=null?nX[v]:(nX[eU[g.e]]+nX[eV[g.e]])/2,y:v!=null?nY[v]:(nY[eU[g.e]]+nY[eV[g.e]])/2,ends:g.ends,es:g.es};});
}
const arInner=f=>{// 區域裡的一點：重心不在裡面就取過重心那條水平線最寬的一段中點
  const r=f.ring;let cx=0,cy=0,a=0;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const c=r[j]*r[i+1]-r[i]*r[j+1];a+=c;cx+=(r[j]+r[i])*c;cy+=(r[j+1]+r[i+1])*c;}
  cx/=3*a;cy/=3*a;if(arInRing(r,cx,cy))return[cx,cy];const xs=[];
  for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const yi=r[i+1],yj=r[j+1];if((yi>cy)!==(yj>cy))xs.push(r[i]+(r[j]-r[i])*(cy-yi)/(yj-yi));}
  xs.sort((p,q)=>p-q);let bw=-1,bx=cx;for(let i=0;i+1<xs.length;i+=2)if(xs[i+1]-xs[i]>bw){bw=xs[i+1]-xs[i];bx=(xs[i]+xs[i+1])/2;}return[bx,cy];};
/** 多邊形和矩形取交集（Sutherland–Hodgman），回傳 {area, bb} */
function arClipBox(ring,b){
  let P=[];for(let i=0;i<ring.length;i+=2)P.push([ring[i],ring[i+1]]);
  const cl=(P,inn,cut)=>{const o=[];for(let i=0;i<P.length;i++){const a=P[i],c=P[(i+1)%P.length],ia=inn(a),ic=inn(c);if(ia)o.push(a);if(ia!==ic)o.push(cut(a,c));}return o;};
  const lx=(v,a,c)=>{const t=(v-a[0])/(c[0]-a[0]);return[v,a[1]+(c[1]-a[1])*t];},ly=(v,a,c)=>{const t=(v-a[1])/(c[1]-a[1]);return[a[0]+(c[0]-a[0])*t,v];};
  P=cl(P,p=>p[0]>=b[0],(a,c)=>lx(b[0],a,c));if(P.length)P=cl(P,p=>p[0]<=b[2],(a,c)=>lx(b[2],a,c));
  if(P.length)P=cl(P,p=>p[1]>=b[1],(a,c)=>ly(b[1],a,c));if(P.length)P=cl(P,p=>p[1]<=b[3],(a,c)=>ly(b[3],a,c));
  if(P.length<3)return{area:0,bb:null};let A=0,x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
  for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length];A+=p[0]*q[1]-q[0]*p[1];x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);y0=Math.min(y0,p[1]);y1=Math.max(y1,p[1]);}
  return{area:Math.abs(A)/2,bb:[x0,y0,x1,y1]};
}

/**
 * lines：[{p:[x0,y0,x1,y1,…], r:邊界種類, ly:圖層, nm:地物名稱, k7:七碼, nw:新圖}]
 * points：[{x,y,k:'H'（房屋）|地物名稱, fl:樓層, add:增建註記, tx:文字, fac:附屬設施}]
 * opt：{tol, gates, withHouse, keep(x,y), frames:[[x0,y0,x1,y1]], pub:[bool], newCells, over, posTol}
 * 回傳 {marks:[{x,y,type,msg,ring,gap,path}], st:統計}
 */
function areaCheck(lines,points,opt){
  opt=Object.assign({tol:0.01,minArea:0.05,thin:0.15,maxArea:1e5,maxMarks:8000,over:0.2,posTol:0.3},opt||{});
  const tol=opt.tol,t0=Date.now(),marks=[],mark=m=>{if(marks.length<opt.maxMarks)marks.push(m);};
  const keep=opt.keep||(()=>true);
  const frameL=lines.filter(L=>L.r&AR_FRAME);
  lines=areaPrep(lines.filter(L=>!(L.r&AR_FRAME)),opt);// 圖框永遠不當邊界（G02）
  /* ---- 圖框、已出圖 ---- */
  let FB=opt.frames;if(!FB){FB=[];for(const L of frameL){let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<L.p.length;i+=2){x0=Math.min(x0,L.p[i]);x1=Math.max(x1,L.p[i]);y0=Math.min(y0,L.p[i+1]);y1=Math.max(y1,L.p[i+1]);}if(x1-x0>50&&y1-y0>50)FB.push([x0,y0,x1,y1]);}}
  {const seen=new Set();FB=FB.filter(b=>{const k=b.map(v=>Math.round(v)).join();if(seen.has(k))return false;seen.add(k);return true;});}
  // 已出圖（E01/E02）：圖幅內新圖層的線夠多，不是只有一個圖例或一條線深入幾公分
  const NC=20,newLen=new Map();
  for(const L of lines){if(!L.nw)continue;const p=L.p;for(let i=2;i<p.length;i+=2){const l=Math.hypot(p[i]-p[i-2],p[i+1]-p[i-1]);if(!(l>0))continue;
    const k=Math.floor((p[i]+p[i-2])/2/NC)+','+Math.floor((p[i+1]+p[i-1])/2/NC);newLen.set(k,(newLen.get(k)||0)+l);}}
  const sheetNew=FB.map(b=>{let s=0;for(const[k,l]of newLen){const[i,j]=k.split(',').map(Number),x=(i+.5)*NC,y=(j+.5)*NC;if(x>b[0]&&x<b[2]&&y>b[1]&&y<b[3])s+=l;}return s;});
  const pub=opt.pub||sheetNew.map(s=>s>=(opt.pubLen||1000));
  const cellNew=(x,y)=>{const i=Math.floor(x/NC),j=Math.floor(y/NC);let s=0;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)s+=newLen.get((i+a)+','+(j+b))||0;return s>=15;};
  const boxAt=(x,y)=>{for(let i=0;i<FB.length;i++){const b=FB[i];if(x>b[0]&&x<b[2]&&y>b[1]&&y<b[3])return i;}return-1;};
  const nearFrame=(x,y,d)=>FB.some(b=>(Math.abs(x-b[0])<d||Math.abs(x-b[2])<d)&&y>b[1]-d&&y<b[3]+d||(Math.abs(y-b[1])<d||Math.abs(y-b[3])<d)&&x>b[0]-d&&x<b[2]+d);
  const cnt={};const put=(m)=>{cnt[m.type]=(cnt[m.type]||0)+1;mark(m);};

  /* ---- 1. 一般拓樸（不含圖框） ---- */
  const G=arGraph(lines,tol);
  if(!G.ns)return{marks:[],st:{seg:0,ms:Date.now()-t0}};
  const{nX,nY,eU,eV,eR,deg0,aS,aE,NN,NE,X0,Y0,X1,Y1,R,cells,bx0,by0,NX,NY,cs}=G;
  const P=arPrune(G),alive=P.alive;
  // 高架道路的線段（格網），用來判斷「碰到高架」
  const EV=[],EG=new Map(),EC=10;
  for(const L of lines){if(!(L.r&AR_ELEV))continue;const p=L.p;for(let i=2;i<p.length;i+=2){const k=EV.length;EV.push([p[i-2],p[i-1],p[i],p[i+1]]);
    const i0=Math.floor(Math.min(p[i-2],p[i])/EC),i1=Math.floor(Math.max(p[i-2],p[i])/EC),j0=Math.floor(Math.min(p[i-1],p[i+1])/EC),j1=Math.floor(Math.max(p[i-1],p[i+1])/EC);
    if((i1-i0+1)*(j1-j0+1)>400)continue;for(let a=i0;a<=i1;a++)for(let b=j0;b<=j1;b++){const q=a*1e7+b;let l=EG.get(q);if(!l)EG.set(q,l=[]);l.push(k);}}}
  const evNear=(x,y)=>{const l=EG.get(Math.floor(x/EC)*1e7+Math.floor(y/EC));if(!l)return[];return l;};
  const nearElev=(x,y,d)=>{for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=EG.get((Math.floor(x/EC)+a)*1e7+Math.floor(y/EC)+b);if(!l)continue;for(const k of l){const[ax,ay,cx,cy]=EV[k],dx=cx-ax,dy=cy-ay,l2=dx*dx+dy*dy;if(!l2)continue;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=t<0?0:t>1?1:t;if(Math.hypot(ax+dx*t-x,ay+dy*t-y)<=d)return true;}}return false;};
  const freeEnd=v=>!nearFrame(nX[v],nY[v],0.5)&&!nearElev(nX[v],nY[v],0.3);// 碰到圖框、高架的端點都不算懸空
  // 平面道路、人行道不可跨越高架道路（要在高架處中斷）
  if(EV.length){const seen=[];for(const L of lines){if(!(L.r&(AR_ROAD|AR_WALK))||(L.r&AR_ELEV))continue;const p=L.p;
    for(let i=2;i<p.length;i+=2){const ax=p[i-2],ay=p[i-1],rx=p[i]-ax,ry=p[i+1]-ay,Ls=Math.hypot(rx,ry);if(Ls<1e-6)continue;const cand=new Set();
      const i0=Math.floor(Math.min(ax,p[i])/EC),i1=Math.floor(Math.max(ax,p[i])/EC),j0=Math.floor(Math.min(ay,p[i+1])/EC),j1=Math.floor(Math.max(ay,p[i+1])/EC);
      if((i1-i0+1)*(j1-j0+1)>400)continue;for(let a=i0;a<=i1;a++)for(let b=j0;b<=j1;b++){const l=EG.get(a*1e7+b);if(l)for(const k of l)cand.add(k);}
      for(const k of cand){const[bx,by,cx,cy]=EV[k],qx=cx-bx,qy=cy-by,d=rx*qy-ry*qx;if(Math.abs(d)<1e-12)continue;const wx=bx-ax,wy=by-ay,t=(wx*qy-wy*qx)/d,v=(wx*ry-wy*rx)/d;
        const Lq=Math.hypot(qx,qy);if(t<0||t>1||v<0||v>1||v*Lq<=tol||(1-v)*Lq<=tol)continue;
        const x=ax+rx*t,y=ay+ry*t;if(Math.hypot(x-p[0],y-p[1])<=0.3||Math.hypot(x-p[p.length-2],y-p[p.length-1])<=0.3)continue;// 停在高架線上（線的頭尾）是正常的if(seen.some(q=>Math.hypot(q[0]-x,q[1]-y)<1))continue;seen.push([x,y]);
        put({x,y,type:'elevcross',msg:`平面${L.nm||'道路'}跨越高架道路（應在高架處中斷）`});}}}}
  // 自由線：道路、人行道懸空要報（圖框邊、作業範圍外、碰到高架的不算；高架道路自己的橋頭不算）
  for(const c of arChains(G,P.cut,e=>(eR[e]&(AR_ROAD|AR_WALK))&&!(eR[e]&~(AR_ROAD|AR_WALK)))){
    const ends=c.ends.filter(freeEnd);if(!ends.length)continue;const v=ends[0];
    put({x:nX[v],y:nY[v],type:'roadfree',msg:'道路／人行道線懸空（不可單獨存在，須搭接其他範圍線）'});}
  // 地類界、田埂也不得以自由線存在
  for(const c of arChains(G,P.cut,e=>eR[e]===(AR_OTHER|AR_LB))){
    const ends=c.ends.filter(freeEnd);if(!ends.length)continue;const v=ends[0];
    put({x:nX[v],y:nY[v],type:'lbfree',msg:'地類界懸空（不得以自由線存在，須搭接其他範圍線）'});}
  // 增建線懸空（B02）
  const addFree=arChains(G,P.cut,e=>eR[e]===AR_ADD&&!lines[G.eL[e]].k7);
  for(const c of addFree){const ends=c.ends.filter(freeEnd);if(!ends.length)continue;put({x:nX[ends[0]],y:nY[ends[0]],type:'addline',msg:'增建線有自由端點（突出房屋、沒有接住）'});}
  const T=arFaces(G,alive),F=T.F,{f2F,faceOf,locate,hFrom}=T;
  const inside=arPlace(T,points,G);

  /* ---- 2. 房屋拓樸：只用房屋線（不借其他線、不借增建線；七碼屋頂增建算永久） ---- */
  const hR=L=>L.r&(AR_HOUSE|AR_TEMP)?L.r&(AR_HOUSE|AR_TEMP):L.k7?AR_HOUSE:AR_ADD;
  const hAll=lines.filter(L=>L.r&(AR_HOUSE|AR_TEMP|AR_ADD)).map(L=>({p:L.p,r:hR(L)}));
  const GA=arGraph(hAll,tol);let TA=null;
  if(GA.ns){const PA=arPrune(GA);// 房屋未封閉：只算房屋線和增建線，不借圍牆、道路、地類界、圖框
    for(const c of arChains(GA,PA.cut,e=>GA.eR[e]&AR_HOUSE))put({x:c.x,y:c.y,type:'open',msg:'永久性房屋線沒有封閉（只能用房屋線，不借圍牆、道路、地類界或圖框）'});
    TA=arFaces(GA,PA.alive);}
  {// 臨時性、建築中房屋：可以和牆系線（圍牆、柵欄…）接成封閉
    const GW=arGraph(hAll.concat(lines.filter(L=>(L.r&AR_WALL)&&!(L.r&(AR_HOUSE|AR_TEMP|AR_ADD))).map(L=>({p:L.p,r:AR_OTHER}))),tol);
    if(GW.ns){const PW=arPrune(GW);for(const c of arChains(GW,PW.cut,e=>(GW.eR[e]&AR_TEMP)&&!(GW.eR[e]&AR_HOUSE)))put({x:c.x,y:c.y,type:'open',msg:'臨時性／建築中房屋線沒有封閉（可借牆系線，不借道路、地類界或圖框）'});}}
  const hLines=hAll.filter(L=>L.r!==AR_ADD);
  const GH=arGraph(hLines,tol);let TH=null;
  if(GH.ns){const PH=arPrune(GH);
    // 關掉增建線（五碼）後才出現的缺口（B03）
    const openA=marks.filter(m=>m.type==='open');
    for(const c of arChains(GH,PH.cut,e=>GH.eR[e]&AR_HOUSE)){if(openA.some(m=>c.ends.some(v=>Math.hypot(GH.nX[v]-m.x,GH.nY[v]-m.y)<0.05)||Math.hypot(c.x-m.x,c.y-m.y)<0.05))continue;
      if(c.es.every(e=>{const x=(GH.nX[GH.eU[e]]+GH.nX[GH.eV[e]])/2,y=(GH.nY[GH.eU[e]]+GH.nY[GH.eV[e]])/2;return openA.some(m=>Math.hypot(x-m.x,y-m.y)<0.05);}))continue;
      put({x:c.x,y:c.y,type:'openadd',msg:'關掉增建線後，房屋線沒有封閉（房屋要用房屋線自己封閉）'});}
    TH=arFaces(GH,PH.alive);
    // 樓層（H01–H04、B04）：房屋線自己圍出的區域裡只能有一種永久樓層
    const fps=points.filter(p=>p.fl);for(const p of fps){const k=TH.locate(p.x,p.y);p._h=k;}
    const byF=new Map();for(const p of fps){if(p._h<0){if(TA&&TA.locate(p.x,p.y)>=0)continue;/* 靠增建線才圍得起來的房屋：已列關增建後缺口 */put({x:p.x,y:p.y,type:'floorout',msg:`樓層註記 ${p.fl} 不在永久房屋範圍內`});continue;}let a=byF.get(p._h);if(!a)byF.set(p._h,a=[]);a.push(p);}
    const flR=p=>{const m=/(\d+)R/i.exec(p.fl);return m?m[1]+'R':null;};// 只比地上樓層（R）；地下室（B）等可以同區
    for(const[k,a0]of byF){const a=a0.filter(flR);const s=new Map();for(const p of a)s.set(flR(p),(s.get(flR(p))||0)+1);if(s.size<2)continue;
      const mk=[...s].sort((x,y)=>x[1]-y[1])[0][0],p=a.find(q=>flR(q)===mk),o=a.slice().sort((x,y)=>Math.hypot(x.x-p.x,x.y-p.y)-Math.hypot(y.x-p.x,y.y-p.y)).find(q=>flR(q)!==mk);
      // 有增建線時分得開＝五碼關增建後才衝突（B04）；連增建線都分不開＝永久樓層衝突（H01–H03）
      const sep=TA&&TA.locate(p.x,p.y)!==TA.locate(o.x,o.y);
      const ty=sep?'flooradd':'floor',msg=sep?`關掉增建線後樓層衝突：${[...s.keys()].join('＋')}（不同樓層要用永久房屋線分開，增建線不能代替）`:`永久樓層衝突：${[...s.keys()].join('＋')} 在同一個房屋封閉區（分棟線不算分界）`;
      const d=Math.hypot(o.x-p.x,o.y-p.y);put({x:p.x,y:p.y,type:ty,msg,ring:TH.F[k].ring,path:d<=60?[p.x,p.y,o.x,o.y]:null});}
    // 增建線越出永久房屋（B02，五碼）：房屋區＝房屋線圍出、裡面有房屋註記的區（被一圈房屋圍起來的空地不算）
    const hasH=new Set();for(const p of points)if(p.k==='H'||p.add){const k=TH.locate(p.x,p.y);if(k>=0)hasH.add(k);}
    {const out=[];for(const L of lines){if(!(L.r&AR_ADD)||L.k7||(L.r&(AR_HOUSE|AR_TEMP)))continue;const p=L.p;
      for(let i=2;i<p.length;i+=2){const dx=p[i]-p[i-2],dy=p[i+1]-p[i-1],l=Math.hypot(dx,dy);if(l<0.3)continue;const mx=(p[i]+p[i-2])/2,my=(p[i+1]+p[i-1])/2,nx=-dy/l*0.05,ny=dx/l*0.05;
        if(!hasH.has(TH.locate(mx+nx,my+ny))&&!hasH.has(TH.locate(mx-nx,my-ny)))out.push([mx,my]);}}
      const used=new Set();for(let i=0;i<out.length;i++){if(used.has(i))continue;used.add(i);for(let j=i+1;j<out.length;j++)if(!used.has(j)&&Math.hypot(out[j][0]-out[i][0],out[j][1]-out[i][1])<3)used.add(j);
        put({x:out[i][0],y:out[i][1],type:'addline',msg:'增建線越出永久房屋範圍'});}}
  }

  /* ---- 3. 增建線找不到增建註記（B01）：相連的一組增建線，圍到的各區裡至少一區要有增建註記
     （增建線旁邊沒加蓋、維持原樓層的區塊本來就沒有增建註記，所以不逐段要求兩側） ---- */
  {const ae=[];for(let e=0;e<NE;e++)if(alive[e]&&eR[e]===AR_ADD&&!lines[G.eL[e]].k7)ae.push(e);
    for(const c of arChains(G,ae)){let ok=false;
      for(const e of c.es){const x0=nX[eU[e]],y0=nY[eU[e]],x1=nX[eV[e]],y1=nY[eV[e]],l=Math.hypot(x1-x0,y1-y0);if(l<1e-6)continue;
        const mx=(x0+x1)/2,my=(y0+y1)/2,nx=-(y1-y0)/l*0.02,ny=(x1-x0)/l*0.02;// 往兩邊各偏 2cm 找區（島狀的增建框外側也找得到）
        for(const k of[locate(mx+nx,my+ny),locate(mx-nx,my-ny)])if(k>=0&&F[k].add.length){ok=true;break;}if(ok)break;}
      if(ok)continue;const e=c.es[Math.floor(c.es.length/2)];
      put({x:(nX[eU[e]]+nX[eV[e]])/2,y:(nY[eU[e]]+nY[eV[e]])/2,type:'addside',msg:'增建線找不到增建註記（這組增建線圍到的區域都沒有增建註記）'});}}

  /* ---- 4. 一區兩種屬性、和道路相通、增建註記位置、空白區 ---- */
  const gapR=opt.gapMax||3;
  // 懸空端點歸到所在的區（柵欄、牆、駁坎、土坎等可懸空的線，端點不當缺口）
  for(let v=0;v<NN;v++){if(deg0[v]!==1)continue;let fr=false;for(let k=aS[v];k<aS[v+1];k++)if(eR[aE[k]]&AR_FREE)fr=true;if(fr)continue;const k=locate(nX[v],nY[v]);if(k<0)continue;(F[k].ends||(F[k].ends=[])).push(v);}
  const nearK=(x,y)=>{// 最近的幾條不同線上的點
    const L=[];const i0=Math.max(0,Math.floor((x-gapR-bx0)/cs)),i1=Math.min(NX-1,Math.floor((x+gapR-bx0)/cs)),j0=Math.max(0,Math.floor((y-gapR-by0)/cs)),j1=Math.min(NY-1,Math.floor((y+gapR-by0)/cs));const seen=new Set();
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const a=cells.get(j*NX+i);if(!a)continue;for(const s of a){if(seen.has(s))continue;seen.add(s);const ax=X0[s],ay=Y0[s],dx=X1[s]-ax,dy=Y1[s]-ay,l2=dx*dx+dy*dy;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=t<0?0:t>1?1:t;
      const qx=ax+dx*t,qy=ay+dy*t,d=Math.hypot(qx-x,qy-y);if(d<=tol||d>gapR)continue;L.push({d,x2:qx,y2:qy});}}
    L.sort((a,b)=>a.d-b.d);const out=[];for(const c of L){if(out.some(o=>Math.hypot(o.x2-c.x2,o.y2-c.y2)<0.05))continue;out.push(c);if(out.length>=4)break;}return out;};
  const findGap=(f,mode)=>{
    const C=[];for(const v of f.ends||[])for(const n of nearK(nX[v],nY[v]))C.push({x:nX[v],y:nY[v],x2:n.x2,y2:n.y2,d:n.d});
    {const seenV=new Set();for(const h of f.hs){const v=hFrom(h);if(seenV.has(v))continue;seenV.add(v);const n=nearK(nX[v],nY[v])[0];if(n&&n.d<=2)C.push({x:nX[v],y:nY[v],x2:n.x2,y2:n.y2,d:n.d});}}
    if(!C.length)return null;C.sort((a,b)=>a.d-b.d);if(C.length>60)C.length=60;
    const seg=e=>({p:[nX[eU[e]],nY[eU[e]],nX[eV[e]],nY[eV[e]]],r:eR[e]});
    const base=[];for(const h of f.hs)base.push(seg(h>>1));
    {const i0=Math.max(0,Math.floor((f.bb[0]-bx0)/cs)),i1=Math.min(NX-1,Math.floor((f.bb[2]-bx0)/cs)),j0=Math.max(0,Math.floor((f.bb[1]-by0)/cs)),j1=Math.min(NY-1,Math.floor((f.bb[3]-by0)/cs));const seen=new Set();
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const a=cells.get(j*NX+i);if(!a)continue;for(const q of a){if(seen.has(q))continue;seen.add(q);const mx=(X0[q]+X1[q])/2,my=(Y0[q]+Y1[q])/2;
        if(mx<f.bb[0]||mx>f.bb[2]||my<f.bb[1]||my>f.bb[3])continue;if(arInRing(f.ring,mx,my))base.push({p:[X0[q],Y0[q],X1[q],Y1[q]],r:R[q]});}}}
    let full=true;
    const ok=SF=>{if(mode==='mix'){let mx=0;for(const g of SF)mx=Math.max(mx,g.kinds.size);return full?mx<=1:mx<f.kinds.size;}
      const g=SF.find(g=>g.kinds.size);if(!g)return false;return((g.rl[AR_ROAD]||0)+(g.rl[AR_WALK]||0))<g.per*0.5&&g.area<f.area*0.9;};
    const test=set=>ok(arSplit(base.concat(set.map(c=>({p:[c.x,c.y,c.x2,c.y2],r:AR_OTHER}))),f.all,tol));
    if(!test(C)){if(mode!=='mix'||f.kinds.size<3)return null;full=false;if(!test(C))return null;}
    for(const c of C)if(test([c]))return Object.assign({all:[c]},c);
    if(C.length<2)return null;
    let set=C.slice();for(let i=set.length-1;i>=0&&set.length>1;i--){const t=set.slice(0,i).concat(set.slice(i+1));if(test(t))set=t;}
    return Object.assign({all:set},set[0]);};
  // 指示線：從缺口附近的地物經缺口指到另一側；不拉到遠處無關地物（超過 30m 就只畫缺口兩側各 3m）
  const LMAX=30;
  const pathOf=(f,c,mode)=>{const mx=c?(c.x+c.x2)/2:null,my=c?(c.y+c.y2)/2:null;
    const near=k=>{let b=null,bd=Infinity;for(const p of f.all)if(k==null||p.k===k){const d=Math.hypot(p.x-mx,p.y-my);if(d<bd){bd=d;b=p;}}return b;};
    const clip=(p)=>{const dx=p.x-mx,dy=p.y-my,L=Math.hypot(dx,dy);return L<=LMAX?[p.x,p.y]:[mx+dx/L*3,my+dy/L*3];};
    if(mode==='mix'){const ks=[...f.kinds.keys()];
      if(!c){const a=f.kinds.get(ks[0]),b=f.kinds.get(ks[1]);return Math.hypot(a.x-b.x,a.y-b.y)<=LMAX?[a.x,a.y,b.x,b.y]:null;}
      const Pk=ks.map(near).sort((a,b)=>Math.hypot(a.x-mx,a.y-my)-Math.hypot(b.x-mx,b.y-my));
      return[...clip(Pk[0]),mx,my,...clip(Pk[1])];}
    const A=near(null),dx=mx-A.x,dy=my-A.y,L=Math.hypot(dx,dy)||1;return[...clip(A),mx,my,mx+dx/L*3,my+dy/L*3];};
  const gapTxt=d=>d<0.1?d.toFixed(3):d.toFixed(2);
  const mixF=new Set();
  const vegF=new Set((opt.veg||[]).map(v=>locate(v.x,v.y)));// 植被圖層畫的範圍線不當邊界；那一區的兩種屬性已由「植被圖層畫範圍線」報
  for(const f of F){const rl=b=>f.rl[b]||0;
    if(f.all.length&&!f.all.some(p=>keep(p.x,p.y)))continue;// 作業範圍外的不用找
    if(f.kinds.has('H')&&opt.withHouse)for(const k of opt.withHouse)f.kinds.delete(k);// 七碼寺廟（卍）可以和樓層註記同區
    if(f.kinds.size>1&&opt.bigKinds){const big=[...f.kinds.keys()].filter(k=>opt.bigKinds.has(k));
      if(big.length){mixF.add(f.id);const oth=[...f.kinds.keys()].filter(k=>!opt.bigKinds.has(k)).map(k=>k==='H'?'房屋':k),p=f.kinds.get(big[0]);
        const g=findGap(f,'mix');
        if(g)put({x:g.x,y:g.y,type:'facility',msg:`大型設施沒有用範圍線包起來：${big.join('、')}（和${oth.join('、')}同區，缺口 ${g.all.map(c=>gapTxt(c.d)).join('、')}m）`,ring:f.ring,gap:g.all.flatMap(c=>[c.x,c.y,c.x2,c.y2]),path:pathOf(f,g,'mix')});
        else put({x:p.x,y:p.y,type:'facility',msg:`大型設施沒有用範圍線包起來：${big.join('、')}（和${oth.join('、')}同區）`,ring:f.ring});continue;}}
    if(f.kinds.size>1&&vegF.has(f.id)){mixF.add(f.id);continue;}
    if(f.kinds.size>1){mixF.add(f.id);const names=[...f.kinds.keys()].map(k=>k==='H'?'房屋':k),g=findGap(f,'mix');
      if(g)put({x:g.x,y:g.y,type:'mix',msg:`一區兩種屬性：${names.join('＋')}（缺口 ${g.all.map(c=>gapTxt(c.d)).join('、')}m）`,ring:f.ring,gap:g.all.flatMap(c=>[c.x,c.y,c.x2,c.y2]),path:pathOf(f,g,'mix')});
      else{// 找不到缺口：先找插入點跑到範圍外的圖例（離邊界 1m 內，線的另一側是同種地物或沒有地物）
        const r=f.ring,stray=[];
        for(const p of f.all){let bd=1.0,bq=null;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const ax=r[j],ay=r[j+1],dx=r[i]-ax,dy=r[i+1]-ay,l2=dx*dx+dy*dy;if(!l2)continue;
            let t=((p.x-ax)*dx+(p.y-ay)*dy)/l2;t=t<0?0:t>1?1:t;const qx=ax+dx*t,qy=ay+dy*t,d=Math.hypot(qx-p.x,qy-p.y);if(d<bd){bd=d;bq=[qx,qy];}}
          if(!bq||bd<1e-6)continue;const ux=(bq[0]-p.x)/bd,uy=(bq[1]-p.y)/bd,k=locate(bq[0]+ux*0.05,bq[1]+uy*0.05);if(k<0||k===f.id)continue;const o=F[k];
          if(o.kinds.has(p.k)||!o.kinds.size)stray.push({p,d:bd,same:o.kinds.has(p.k)});}
        for(const s of stray)put({x:s.p.x,y:s.p.y,type:'stray',msg:`圖例插入點跑到範圍外：${s.p.k==='H'?'房屋':s.p.k}（${s.d<0.01?'壓在邊界線上':'離邊界 '+gapTxt(s.d)+'m'}，線的另一側${s.same?'是同種地物':'沒有地物'}）`,ring:f.ring});
        const rest=new Set(f.all.filter(p=>!stray.some(s=>s.p===p)).map(p=>p.k));if(stray.length&&rest.size<=1)continue;
        const cntK=new Map();for(const p of f.all)cntK.set(p.k,(cntK.get(p.k)||0)+1);const mk=[...cntK].sort((x,y)=>x[1]-y[1])[0][0],a=f.all.find(p=>p.k===mk);
        put({x:a.x,y:a.y,type:'mix',msg:'一區兩種屬性：'+names.join('＋')+'（找不到 3m 內的缺口：可能少畫地類界，或圖例壓在線上）',ring:f.ring,path:pathOf(f,null,'mix')});}continue;}
    if(f.kinds.size&&(f.ends||[]).length&&rl(AR_ROAD)+rl(AR_WALK)>=f.per*0.5){const g=findGap(f,'road');
      if(g){mixF.add(f.id);const nm=[...f.kinds.keys()].map(k=>k==='H'?'房屋':k).join('＋');put({x:g.x,y:g.y,type:'road',msg:`${nm}和道路／人行道相通（缺口 ${g.all.map(c=>gapTxt(c.d)).join('、')}m）`,ring:f.ring,gap:g.all.flatMap(c=>[c.x,c.y,c.x2,c.y2]),path:pathOf(f,g,'road')});continue;}}
    if(f.add.length&&!f.kinds.has('H')&&(f.kinds.size||rl(AR_HOUSE)+rl(AR_TEMP)+rl(AR_ADD)<f.per*0.5)){const p=f.add[0];
      put({x:p.x,y:p.y,type:'addout',msg:'增建註記不在房屋／增建範圍裡'+(f.kinds.size?'（和'+[...f.kinds.keys()][0]+'同區）':''),ring:f.ring});continue;}
    if(f.kinds.size||f.add.length||f.fac.length)continue;
    if(f.area<opt.minArea||f.area>opt.maxArea||2*f.area/f.per<opt.thin)continue;
    if(rl(AR_ADD)>0||rl(AR_TEMP)>0||rl(AR_GATE)>0||rl(AR_STAIR)>0||rl(AR_WALK)+rl(AR_ROAD)>=f.per*0.2||rl(AR_HOUSE)<f.per*0.5)continue;
    const c=arInner(f);put({x:c[0],y:c[1],type:'empty',msg:`沒有屬性的區域（${f.area<10?f.area.toFixed(1):Math.round(f.area)} m²）`,ring:f.ring});}

  /* ---- 5. 接邊：圖框切開的區域，兩側都要有屬性且一致（E09，不看距離，以拓樸為準） ---- */
  if(FB.length){
    const sig=(f,b)=>{const k=new Set(),fl=new Set(),ad=new Set();let n=0;
      for(const p of f.all){if(!(p.x>b[0]&&p.x<b[2]&&p.y>b[1]&&p.y<b[3]))continue;n++;if(p.fl)fl.add(p.fl);else if(p.k!=='H')k.add(p.k);else k.add('房屋');}
      for(const p of f.add){if(!(p.x>b[0]&&p.x<b[2]&&p.y>b[1]&&p.y<b[3]))continue;n++;ad.add(p.tx||'增建');}
      return{n,k,fl,ad,txt:[...k,...fl,...[...ad].map(x=>'增建'+x)].join('＋')};};
    const eq=(a,b)=>a.size===b.size&&[...a].every(x=>b.has(x));
    const crossPt=(f,ba,bb)=>{// 兩幅交界上、在區域裡的一點
      let x0,y0,x1,y1;if(Math.abs(ba[2]-bb[0])<1||Math.abs(ba[0]-bb[2])<1){const x=Math.abs(ba[2]-bb[0])<1?ba[2]:ba[0];x0=x1=x;y0=Math.max(ba[1],bb[1],f.bb[1]);y1=Math.min(ba[3],bb[3],f.bb[3]);}
      else{const y=Math.abs(ba[3]-bb[1])<1?ba[3]:ba[1];y0=y1=y;x0=Math.max(ba[0],bb[0],f.bb[0]);x1=Math.min(ba[2],bb[2],f.bb[2]);}
      const L=Math.hypot(x1-x0,y1-y0),n=Math.min(400,Math.max(2,Math.ceil(L/0.25))),ins=[];
      for(let i=0;i<=n;i++){const x=x0+(x1-x0)*i/n,y=y0+(y1-y0)*i/n;if(arInRing(f.ring,x,y)&&locate(x,y)===f.id)ins.push([x,y]);}
      return ins.length?ins[Math.floor(ins.length/2)]:null;};
    for(const f of F){if(mixF.has(f.id))continue;// 已判為相通的先不比，避免連帶誤報
      const rl=b=>f.rl[b]||0;
      const parts=[];for(let i=0;i<FB.length;i++){const b=FB[i];if(b[2]<f.bb[0]||b[0]>f.bb[2]||b[3]<f.bb[1]||b[1]>f.bb[3])continue;
        const c=arClipBox(f.ring,b);if(!c.bb||c.area<=0)continue;if(c.bb[2]-c.bb[0]<opt.over||c.bb[3]-c.bb[1]<opt.over)continue;// 合理越界的細條不算
        parts.push({i,b,c});}
      if(parts.length<2)continue;
      const S=parts.map(p=>Object.assign(p,{s:sig(f,p.b)}));
      if(!S.some(p=>p.s.n))continue;// 兩側都沒有屬性：不是接邊的問題（空白區另外檢查）
      if(rl(AR_ROAD)+rl(AR_WALK)>=f.per*0.3&&!f.kinds.size&&!f.add.length)continue;// 道路、人行道本來就免註記
      for(let a=0;a<S.length;a++)for(let b=a+1;b<S.length;b++){const A=S[a],B=S[b];
        const adj=(A.b[2]===B.b[0]||A.b[0]===B.b[2])&&A.b[1]<B.b[3]&&B.b[1]<A.b[3]||(A.b[3]===B.b[1]||A.b[1]===B.b[3])&&A.b[0]<B.b[2]&&B.b[0]<A.b[2];if(!adj)continue;
        if(!pub[A.i]||!pub[B.i])continue;// 兩側都已出圖才比（E01）
        const q=crossPt(f,A.b,B.b);if(!q||!keep(q[0],q[1]))continue;
        if(!cellNew(q[0],q[1]))continue;
        if(!A.s.n||!B.s.n){const has=A.s.n?A:B;put({x:q[0],y:q[1],type:'edge',msg:`接邊：圖框切開的區域只有一側有屬性（${has.s.txt}｜無）`,ring:f.ring});continue;}
        if(eq(A.s.k,B.s.k)&&eq(A.s.fl,B.s.fl)&&eq(A.s.ad,B.s.ad))continue;
        put({x:q[0],y:q[1],type:'edge',msg:`接邊：圖框兩側屬性不同（${A.s.txt}｜${B.s.txt}）`,ring:f.ring});}}
  }

  /* ---- 6. 接邊：線和圖框的交點逐線比對（E03–E08） ---- */
  if(FB.length){
    // 圖框邊（兩幅共用的只算一次）
    const FE=[],fk=new Set();
    for(let i=0;i<FB.length;i++){const b=FB[i];for(const[v,ax,a0,a1]of[[b[0],0,b[1],b[3]],[b[2],0,b[1],b[3]],[b[1],1,b[0],b[2]],[b[3],1,b[0],b[2]]]){
      const k=ax+':'+Math.round(v*100)+':'+Math.round(a0*100);if(fk.has(k))continue;fk.add(k);
      const mid=(a0+a1)/2,pA=ax?boxAt(mid,v-1):boxAt(v-1,mid),pB=ax?boxAt(mid,v+1):boxAt(v+1,mid);if(pA<0||pB<0||!pub[pA]||!pub[pB])continue;FE.push({ax,v,a0,a1});}}
    const band=1.5,over=opt.over,posTol=opt.posTol,found=[];
    const nmOf=L=>areaSyn(L.nm||'');
    for(const fe of FE){const ends=[[],[]],thru=[];// ends[0]：從負側來、停在框邊的線端；ends[1]：正側
      const U=(x,y)=>fe.ax?[x,y-fe.v]:[y,x-fe.v];// [沿框位置, 到框距離]
      lines.forEach((L,li)=>{if(L.r&(AR_ADD|AR_GATE))return;const p=L.p,n=p.length/2;if(n<2)return;
        let lo=Infinity,hi=-Infinity,smin=Infinity,smax=-Infinity;for(let i=0;i<p.length;i+=2){const[s,d]=U(p[i],p[i+1]);lo=Math.min(lo,d);hi=Math.max(hi,d);smin=Math.min(smin,s);smax=Math.max(smax,s);}
        if(lo>band||hi<-band||smax<fe.a0-band||smin>fe.a1+band)return;
        // 穿過框邊的
        for(let i=2;i<p.length;i+=2){const[s0,d0]=U(p[i-2],p[i-1]),[s1,d1]=U(p[i],p[i+1]);if((d0<0)!==(d1<0)&&d0!==d1){const s=s0+(s1-s0)*(0-d0)/(d1-d0);if(s>fe.a0&&s<fe.a1)thru.push({s,li,L,d0,d1});}}
        // 停在框邊附近的線端
        if(hi-lo<=over&&Math.abs(lo)<=over)return;// 整條都貼在框邊（接頭小段）
        for(const[ei,st]of[[0,1],[n-1,-1]]){const[s,d]=U(p[2*ei],p[2*ei+1]);if(Math.abs(d)>over||s<fe.a0-over||s>fe.a1+over)continue;
          let ej=ei+st;while(ej>0&&ej<n-1&&Math.hypot(p[2*ej]-p[2*ei],p[2*ej+1]-p[2*ei+1])<0.3)ej+=st;// 方向看離端點 0.3m 以外的點，不被極短的小段帶偏
          const[s2,d2]=U(p[2*ej],p[2*ej+1]),ds=s2-s,dd=d2-d,l=Math.hypot(ds,dd);if(l<1e-6)continue;
          if(Math.abs(dd)/l<0.2)continue;// 沿著框邊走的線（舊圖裁切封口）不比
          ends[dd<0?0:1].push({s,x:p[2*ei],y:p[2*ei+1],li,L,dir:[ds/l,dd/l]});}});
      const mk=(x,y,msg,path)=>{if(found.some(q=>Math.hypot(q.x-x,q.y-y)<1))return;found.push({x,y});const q=fe.ax?[x,fe.v]:[fe.v,y];put({x,y,type:'edge',msg,path});};
      const P2=(s)=>fe.ax?[s,fe.v]:[fe.v,s];
      const used=[new Set(),new Set()];
      // 成對：位置差在 posTol 內、方向接得上（E03、E06：逐線比對，不硬配）
      const pairs=[];for(const a of ends[0])for(const b of ends[1]){const ds=Math.abs(a.s-b.s);if(ds>posTol)continue;const dot=a.dir[0]*b.dir[0]+a.dir[1]*b.dir[1];if(dot>-0.5)continue;pairs.push({a,b,ds});}
      pairs.sort((x,y)=>x.ds-y.ds);
      const many=(side,s)=>ends[side].filter(e=>Math.abs(e.s-s)<=posTol).length+thru.filter(t=>Math.abs(t.s-s)<=posTol).length>1;
      for(const{a,b,ds}of pairs){if(used[0].has(a)||used[1].has(b))continue;used[0].add(a);used[1].add(b);
        if(many(0,a.s)||many(1,b.s))continue;// 框邊剛好是好幾條線的接點：不硬配成一對比種類（E06）
        const na=nmOf(a.L),nb=nmOf(b.L);if(na&&nb&&na!==nb&&!na.includes(nb)&&!nb.includes(na)){const q=P2((a.s+b.s)/2);
          if(keep(q[0],q[1]))mk(q[0],q[1],`接邊：圖框兩側線的種類不同（${na}｜${nb}）`,[a.x,a.y,q[0],q[1],b.x,b.y]);}}
      for(const side of[0,1])for(const a of ends[side]){if(used[side].has(a))continue;
        // 對面有線剛好在這個位置（不是停在框邊而是轉彎或本來就穿過）就不算中斷
        const q=P2(a.s);if(!keep(q[0],q[1])||!cellNew(q[0],q[1]))continue;
        if(thru.some(t=>Math.abs(t.s-a.s)<=posTol&&t.li!==a.li))continue;
        let near=false;for(const L of lines){if(L===a.L||(L.r&(AR_ADD|AR_GATE)))continue;const p=L.p;for(let i=2;i<p.length&&!near;i+=2){const[s0,d0]=U(p[i-2],p[i-1]),[s1,d1]=U(p[i],p[i+1]);
          // 對面那一側、框邊 posTol 內有其他線的端點或線段經過
          const sgn=side?-1:1;for(const[s,d]of[[s0,d0],[s1,d1]])if(Math.abs(s-a.s)<=posTol&&d*sgn>=-over&&d*sgn<=band)near=true;}if(near)break;}
        if(near)continue;
        mk(q[0],q[1],`接邊：${nmOf(a.L)||'範圍線'}碰到圖框，對面沒有接著畫（中斷）`,[a.x,a.y,q[0],q[1]]);}
    }
  }
  for(const v of opt.veg||[])put({x:v.x,y:v.y,type:'veg',msg:`用植被圖層（${v.nm}）畫範圍線：範圍應改用地類界等範圍類圖層`});
  if(opt.debug)opt.debug.dbg={G,F,GH,TH};
  return{marks,st:Object.assign(cnt,{seg:G.ns,node:NN,graphEdges:NE,face:F.length,pts:points.length,inside,frames:FB.length,pub:pub.filter(Boolean).length,ms:Date.now()-t0})};
}
if(typeof module!=='undefined')module.exports={areaRole,areaCheck,areaKindName,areaSyn,AR_HOUSE,AR_ADD,AR_WALK,AR_ROAD,AR_WATER,AR_OTHER,AR_TEMP,AR_FRAME,AR_FREE};
