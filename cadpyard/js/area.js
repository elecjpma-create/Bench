/* ---------- 區域檢查（規格：docs/Bench_QA_SPEC_v1.1 ＋ docs/區域檢查補充與待辦.md） ----------
   邊界線打散後在交點、T 字接點互相接起來，切成一塊塊封閉區域（不必是 close 的聚合線），
   再看每一區裡的註記和圖例。純計算，不碰畫面；坐標請先減掉原點。
   ・圖框永遠不當地物邊界（G02）；接邊另外用「區域被圖框切開的兩側」和「線和圖框的交點」比對。
   ・房屋封閉只用房屋線（永久／臨時／建築中；七碼屋頂增建算永久），不借其他線、不借增建線。
   ・樓層衝突用房屋線自己圍出的區域判斷（分棟線、增建線都不算分界）。 */
const AR_HOUSE=1,AR_ADD=2,AR_WALK=4,AR_ROAD=8,AR_WATER=16,AR_OTHER=32,AR_TEMP=64,AR_GATE=128,AR_STAIR=256,AR_FRAME=512,AR_FREE=1024,AR_LB=2048,AR_ELEV=4096,AR_WALL=8192,AR_Q=16384;// Q＝立製無法判定的線（看不清楚時用來封閉房屋等）// LB＝地類界、田埂（不得自由線存在）；ELEV＝高架道路；WALL＝牆系（圍牆、柵欄…，臨時性房屋可借來封閉）
// HOUSE＝永久性房屋，TEMP＝建築中、臨時性（也要封閉）；FREE＝可以單獨懸空的線（圍牆、柵欄、籬、駁坎、土坎、堤…），端點不當缺口
const AR_TEMPC=new Set(['93120','93130','9310200','9310300']);
// 不當邊界也不當地物的圖層
const AR_IGN=/行道樹|防風林|流向|號誌|標誌|水管|油管|瓦斯管|輸送|配電|電信線|高壓|電桿|電線桿|電力桿|電信桿|路燈|人孔|變壓器|交接箱|消防栓|曲線|標高|地名|編號|分棟|郵筒|電話亭|單線水|小水溝|纜車|索道|噴泉|廣告|獨立墓|GIS|註記|線號|等界|接邊|問題/;
// 可單獨存在的附屬設施：圖塊＝圖例（不算主要地物），用該圖層直接畫的散線＝範圍線
const AR_FAC=/水塔|金爐|油槽|儲存槽|貯存槽|變壓箱座|電信箱座|交換箱|瞭望|亭$|煙囪|紀念碑|紀念像|候車/;// 候車站＝候車亭（七碼用公車車頭圖例）// 紀念碑、紀念像：可單獨存在，底座大時可用自身圖層畫範圍
// 大型設施：要被範圍線包起來（哪一層的線都可以）並有自己的圖例（圖例算主要地物）
const AR_BIGFAC=/變電所|變電站|變壓站|抽水站|升旗|司令臺|司令台|捷運站出入口|地下道出入口|水池|濕地|魚池|養殖池|游泳池|加油站|牌樓|牌坊/;
const AR_KIND93=/墓地|堆積場|堆置場|廢墟|游泳池|球場|運動場|體育場|兒童遊樂|遊戲場|遊樂場|遊戲區/;// 兒童遊樂設施＝遊戲場、遊樂場、兒童遊樂區
const AR_KIND93C=new Set(['93523','93726','93902','93553','93555','93556']);
const AR_SINGLE=new Set(['95116','95153','94901','94902','9510110','9510503']);
const AR_FREEN=/圍牆|牆|圍籬|垣|柵欄|欄|網|籬|駁坎|擋土牆|土坎|堤/;

/** 圖層角色：{b:邊界種類, a:地物代碼（圖塊、文字算這種地物）, land:散線也算地物, t:'house'|'add'|'temp' 房屋文字層, fac:附屬設施} 或 null */
function areaRole(name){
  const m=/^(a?)(\d{5,7})([A-Za-z]*)/i.exec(name);
  if(/^Q(-|$)/i.test(name))return{b:AR_OTHER|AR_Q};// 立製無法判定的線也算邊界；房屋接在 Q 線上不算未封閉
  if(!m)return/增建/.test(name)?(/TXT|註記/i.test(name)?{t:'add'}:{b:AR_ADD,t:'add'}):null;
  const code=m[2],suf=m[3].toUpperCase(),isTxt=suf==='TXT'||suf==='X';
  if(code.startsWith('931')&&(code==='9310101'||/分棟|分戶/.test(name)))return null;// 分棟線＝分戶線（七碼 9310101）檢查前排除：不當邊界
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
  if(AR_SINGLE.has(code)||/小水溝|單線水|暗溝|溝、渠/.test(name))return{b:AR_OTHER|AR_FREE,ditch:true};// 單線水溝（五碼小水溝＝七碼單線水，寬 1m 以下）：是範圍線、可懸空中斷，常和地類界、田埂圍出水田果園；另外用來認「水溝接進水體」
  if(AR_IGN.test(name)||code==='9310101')return null;
  if(/階梯/.test(name)||code==='93904'||code==='9390004')return{b:AR_OTHER|AR_STAIR};// 階梯格子不用註記
  if(/寺廟|廟宇/.test(name)||code==='93612')return{b:AR_OTHER,a:code,withH:code.length===7};// 卍；七碼可以和樓層註記同區
  if(code.startsWith('97')){
    if(/地類界|田埂/.test(name)||['97920','97921','97922','9790201','9790202'].includes(code))return{b:AR_OTHER|AR_LB};
    return{a:code,land:true};
  }
  if(code.startsWith('932'))return/門/.test(name)||code==='93270'||code==='9320700'?{b:AR_OTHER|AR_GATE,gb:true,gate:true}:{b:AR_OTHER|AR_FREE|AR_WALL};// 門：兩個門之間有一條看不見的地類界
  if(/停車場/.test(name)||code.startsWith('94229'))return/出入口/.test(name)||suf==='D'?{b:AR_OTHER|AR_GATE,gb:true}:{b:AR_OTHER,a:code};
  if(/分隔島|小徑/.test(name)||['94224','9421003','94216','94217','9420901','9420902'].includes(code))return{b:AR_OTHER};// 小徑（單線步道）也算分界
  if(/陸橋|無障礙坡道/.test(name)||code==='9421007')return{b:AR_OTHER|AR_FREE};// 無障礙坡道不會封閉// 行人陸橋：橋頭小線段本來就懸空，不當道路
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
/* 容差只用在懸空線頭（2026-11-19）：交點、併點都用嚴格容差 AR_EXACT；
   使用者設定的容差 tol 只拿來把「嚴格容差下沒碰到任何東西的開放線端點」接到附近的點或線（加一小段接線）。
   這樣已經封閉的範圍不會因為旁邊的線差幾 mm 就被切出細條。 */
const AR_EXACT=0.001;
function arGraph(lines,tol){
  const loose=tol;tol=Math.min(tol,AR_EXACT);
  let n=0;for(const L of lines)n+=Math.max(0,L.p.length/2-1);n+=lines.length*2;
  const X0=new Float64Array(n),Y0=new Float64Array(n),X1=new Float64Array(n),Y1=new Float64Array(n),R=new Uint16Array(n),SL=new Int32Array(n);
  let ns=0;const ENDS=[];
  lines.forEach((L,li)=>{const p=L.p;const s0=ns;for(let i=2;i<p.length;i+=2){const a=p[i-2],b=p[i-1],c=p[i],d=p[i+1];
    if(!(isFinite(a)&&isFinite(b)&&isFinite(c)&&isFinite(d)))continue;if(Math.abs(a-c)+Math.abs(b-d)<1e-9)continue;
    X0[ns]=a;Y0[ns]=b;X1[ns]=c;Y1[ns]=d;R[ns]=L.r;SL[ns]=li;ns++;}
    if(loose>tol&&ns>s0&&!L.noSnap){const s1=ns-1,len=k=>Math.hypot(X1[k]-X0[k],Y1[k]-Y0[k]);
      if(Math.hypot(X0[s0]-X1[s1],Y0[s0]-Y1[s1])>tol){
        // 線頭附近（容差長度內）自己的小碎段和下一段都算自己的線頭，不當成「碰到東西」
        let c=0;const a=[s0];for(let k=s0;k<s1&&(c+=len(k))<=loose;)a.push(++k);
        c=0;const b=[s1];for(let k=s1;k>s0&&(c+=len(k))<=loose;)b.push(--k);
        ENDS.push([X0[s0],Y0[s0],a,li]);ENDS.push([X1[s1],Y1[s1],b,li]);}}});
  const G={ns,X0,Y0,X1,Y1,R,SL,tol,loose};
  if(!ns)return G;
  let bx0=Infinity,by0=Infinity,bx1=-Infinity,by1=-Infinity;
  for(let i=0;i<ns;i++){bx0=Math.min(bx0,X0[i],X1[i]);by0=Math.min(by0,Y0[i],Y1[i]);bx1=Math.max(bx1,X0[i],X1[i]);by1=Math.max(by1,Y0[i],Y1[i]);}
  // 格網：長線只登記它經過的格子
  const cs=Math.max(2,Math.sqrt((bx1-bx0+1)*(by1-by0+1)/ns)*2),NX=Math.ceil((bx1-bx0)/cs)+1,NY=Math.ceil((by1-by0)/cs)+1;
  const cellOf=(x,y)=>{let i=Math.floor((x-bx0)/cs),j=Math.floor((y-by0)/cs);i=i<0?0:i>=NX?NX-1:i;j=j<0?0:j>=NY?NY-1:j;return j*NX+i;};
  const cells=new Map(),add=(c,s)=>{let a=cells.get(c);if(!a)cells.set(c,a=[]);if(a[a.length-1]!==s)a.push(s);};
  const M=loose;
  const reg=s=>{
    const ax=X0[s],ay=Y0[s],bx=X1[s],by=Y1[s],xl=Math.min(ax,bx)-M,xr=Math.max(ax,bx)+M;
    const yAt=x=>{if(Math.abs(bx-ax)<1e-12)return null;let t=(x-ax)/(bx-ax);t=t<0?0:t>1?1:t;return ay+(by-ay)*t;};
    const i0=Math.max(0,Math.floor((xl-bx0)/cs)),i1=Math.min(NX-1,Math.floor((xr-bx0)/cs));
    for(let i=i0;i<=i1;i++){const cx0=Math.max(xl,bx0+i*cs),cx1=Math.min(xr,bx0+(i+1)*cs);let ya=yAt(cx0-M),yb=yAt(cx1+M);
      if(ya===null){ya=ay;yb=by;}const lo=Math.min(ya,yb)-M,hi=Math.max(ya,yb)+M;
      const j0=Math.max(0,Math.floor((lo-by0)/cs)),j1=Math.min(NY-1,Math.floor((hi-by0)/cs));for(let j=j0;j<=j1;j++)add(j*NX+i,s);}
  };
  for(let s=0;s<ns;s++)reg(s);
  // 懸空線頭：嚴格容差下沒碰到別的東西，才在使用者容差內接到最近的端點（優先）或線上
  if(ENDS.length){const ns0=ns,conn=[];
    const segD=(x,y,s)=>{const ax=X0[s],ay=Y0[s],dx=X1[s]-ax,dy=Y1[s]-ay,l2=dx*dx+dy*dy;let t=l2?((x-ax)*dx+(y-ay)*dy)/l2:0;t=t<0?0:t>1?1:t;const qx=ax+dx*t,qy=ay+dy*t;return[Math.hypot(qx-x,qy-y),qx,qy];};
    for(const[x,y,own,li]of ENDS){const a=cells.get(cellOf(x,y));if(!a)continue;let hit=false;
      // 「碰到」要和嚴格拓樸一致：離端點夠近（會併成同一點），或落在線段中間（會切開接上）
      for(const s of a){if(s>=ns0||own.includes(s))continue;
        if(Math.hypot(X0[s]-x,Y0[s]-y)<=tol*0.9||Math.hypot(X1[s]-x,Y1[s]-y)<=tol*0.9){hit=true;break;}
        const dx=X1[s]-X0[s],dy=Y1[s]-Y0[s],L=Math.hypot(dx,dy);if(!L)continue;const t=((x-X0[s])*dx+(y-Y0[s])*dy)/(L*L);
        if(t*L>tol*1.1&&(1-t)*L>tol*1.1&&segD(x,y,s)[0]<=tol*0.9){hit=true;break;}}
      // 線頭衝過別條線不到容差長度（出頭）：已經接上了，出頭的小尖刺修掉
      if(!hit){const e=own[0],ex=x,ey=y,ox_=(X0[e]===x&&Y0[e]===y)?X1[e]:X0[e],oy_=(X0[e]===x&&Y0[e]===y)?Y1[e]:Y0[e],rx=ox_-ex,ry=oy_-ey,Ls=Math.hypot(rx,ry);let bt=Infinity;
        if(Ls>0)for(const s of a){if(s>=ns0||own.includes(s))continue;const qx=X1[s]-X0[s],qy=Y1[s]-Y0[s],d=rx*qy-ry*qx;if(Math.abs(d)<1e-12)continue;
          const wx=X0[s]-ex,wy=Y0[s]-ey,t=(wx*qy-wy*qx)/d,v=(wx*ry-wy*rx)/d;if(t<0||t>1||v<0||v>1)continue;if(t*Ls<=loose&&t<bt)bt=t;}
        if(bt<Infinity){const ix=ex+rx*bt,iy=ey+ry*bt;if(X0[e]===x&&Y0[e]===y){X0[e]=ix;Y0[e]=iy;}else{X1[e]=ix;Y1[e]=iy;}continue;}}
      if(hit)continue;
      // 線頭附近容差長度內的頂點（含線頭）都可以當出發點，取離別條線最近的；優先接端點
      const from=[[x,y]];for(const k of own.slice(0,-1)){for(const v of[[X0[k],Y0[k]],[X1[k],Y1[k]]])if(Math.hypot(v[0]-x,v[1]-y)<=loose)from.push(v);}
      let bv=null,bvd=Infinity,bs=null,bsd=Infinity;
      for(const s of a){if(s>=ns0||own.includes(s))continue;
        for(const[fx,fy]of from){const[d,qx,qy]=segD(fx,fy,s);if(d>loose)continue;if(d<bsd){bsd=d;bs=[fx,fy,qx,qy];}
          for(const[vx,vy]of[[X0[s],Y0[s]],[X1[s],Y1[s]]]){const dv=Math.hypot(vx-fx,vy-fy);if(dv<=loose&&dv<bvd){bvd=dv;bv=[fx,fy,vx,vy];}}}}
      const q=bv||bs;if(!q)continue;conn.push([q[0],q[1],q[2],q[3],own,li]);}
    for(const[x,y,qx,qy,own,li]of conn){X0[ns]=x;Y0[ns]=y;X1[ns]=qx;Y1[ns]=qy;R[ns]=R[own[0]];SL[ns]=li;reg(ns);ns++;}
    G.ns=ns;G.snapped=conn.length;}
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
  const{F,locate}=T;let inside=0;const online=[];
  const put=(p,k)=>{p._f=k;if(k<0)return;inside++;const f=F[k];// 圖例一律以插入點為準
    if(p.add)f.add.push(p);else if(p.fac)f.fac.push(p);else if(p.k){f.all.push(p);if(p.fl)f.fl.push(p);if(!f.kinds.has(p.k))f.kinds.set(p.k,p);}};
  for(const p of points){if(G&&p._x==null){p._x=1;const n=G.nearSeg?G.nearSeg(p.x,p.y,0.005):null;// 5mm 內算壓在線上
      if(n){// 插入點剛好壓在線上：先放著，等兩側都有圖例了，再歸到已經有同種圖例的那一側
        const q=[p.x-n.nx*n.d,p.y-n.ny*n.d];online.push({p,a:locate(q[0]+n.nx*0.01,q[1]+n.ny*0.01),b:locate(q[0]-n.nx*0.01,q[1]-n.ny*0.01)});continue;}}
    put(p,locate(p.x,p.y));}
  for(const o of online){const p=o.p,has=k=>k>=0&&(p.k?F[k].kinds.has(p.k):p.add?F[k].add.length>0:false);
    const k=has(o.a)?o.a:has(o.b)?o.b:(p.fl||p.add)?(o.a>=0?o.a:o.b):-1;// 兩側都沒有同種圖例：地物圖例不算進任何一區（樓層、增建註記照樣歸一側）
    put(p,k);}
  return inside;
}
/** 只要分區（找缺口時試補線用） */
function arSplit(lines,points,tol){const G=arGraph(lines,tol);if(!G.ns)return[];const P=arPrune(G),T=arFaces(G,P.alive);arPlace(T,points.map(p=>Object.assign({},p)));return T.F;}

/** 相連的一串被剪掉的邊只標一次，標在懸空的那一端。
 *  整串加起來短於 minLen（預設 AR_STUB）的不算：線頭多出幾公分、或封閉線在轉角衝出去又折回的小尖刺，紙圖上看不出來 */
const AR_STUB=0.05;
function arChains(G,edges,ok,minLen=AR_STUB){
  const{eU,eV,nX,nY,deg0}=G,par=new Map(),f=x=>{while(par.get(x)!==x){par.set(x,par.get(par.get(x)));x=par.get(x);}return x;};
  const E=edges.filter(e=>!ok||ok(e));
  for(const e of E)for(const v of[eU[e],eV[e]])if(!par.has(v))par.set(v,v);
  for(const e of E){const a=f(eU[e]),b=f(eV[e]);if(a!==b)par.set(a,b);}
  const grp=new Map();
  for(const e of E){const r=f(eU[e]);let g=grp.get(r);if(!g)grp.set(r,g={ends:[],e,es:[]});g.es.push(e);for(const v of[eU[e],eV[e]])if(deg0[v]===1)g.ends.push(v);}
  return[...grp.values()].filter(g=>{if(!(minLen>0))return true;let L=0;for(const e of g.es){L+=Math.hypot(nX[eU[e]]-nX[eV[e]],nY[eU[e]]-nY[eV[e]]);if(L>=minLen)return true;}return false;}).map(g=>{const v=g.ends[0];return{x:v!=null?nX[v]:(nX[eU[g.e]]+nX[eV[g.e]])/2,y:v!=null?nY[v]:(nY[eU[g.e]]+nY[eV[g.e]])/2,ends:g.ends,es:g.es};});
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
  const pub=opt.pub||sheetNew.map(s=>s>=(opt.pubLen||500));
  const cellNew=(x,y)=>{const i=Math.floor(x/NC),j=Math.floor(y/NC);let s=0;for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)s+=newLen.get((i+a)+','+(j+b))||0;return s>=15;};
  const boxAt=(x,y)=>{for(let i=0;i<FB.length;i++){const b=FB[i];if(x>b[0]&&x<b[2]&&y>b[1]&&y<b[3])return i;}return-1;};
  const nearFrame=(x,y,d)=>FB.some(b=>(Math.abs(x-b[0])<d||Math.abs(x-b[2])<d)&&y>b[1]-d&&y<b[3]+d||(Math.abs(y-b[1])<d||Math.abs(y-b[3])<d)&&x>b[0]-d&&x<b[2]+d);
  /* 舊圖沿著圖框封口的假邊（2026-11-19）：舊圖的房屋、植被等範圍線跨圖幅時，會沿著圖框邊畫一段封起來，那段不是真的界線。
     兩端都貼在同一條圖框邊上（5cm 內）、而且這條框邊兩側的圖幅都已出圖的線段拿掉（外圍沒有對面圖幅的框邊，封口是真的，不拿）：跨幅的同一棟房子、同一塊地在兩幅裡會合成一區，接邊才比得到兩側屬性；
     原本封閉的屋線在框邊斷開，變成碰到圖框的線頭，接邊也才會逐線比對位置。 */
  if(FB.length){const FT=0.05,XS=[...new Set(FB.flatMap(b=>[b[0],b[2]]))],YS=[...new Set(FB.flatMap(b=>[b[1],b[3]]))];
    const on=(v,A)=>{for(const a of A)if(Math.abs(v-a)<=FT)return a;return null;};
    const both=(a,b)=>a>=0&&b>=0&&a!==b&&pub[a]&&pub[b];
    const along=(x0,y0,x1,y1)=>{const vx=on(x0,XS);if(vx!=null&&Math.abs(x1-vx)<=FT&&Math.abs(y1-y0)>1e-6){const m=(y0+y1)/2;return both(boxAt(vx-1,m),boxAt(vx+1,m));}
      const vy=on(y0,YS);if(vy!=null&&Math.abs(y1-vy)<=FT&&Math.abs(x1-x0)>1e-6){const m=(x0+x1)/2;return both(boxAt(m,vy-1),boxAt(m,vy+1));}return false;};
    // 對面有沒有東西：框邊上各側的觸點（線的頂點貼在框邊上，從哪一側來）和貼框段
    const key=(ax,v)=>ax+':'+Math.round(v*100);const TP=new Map(),AS=[];
    const sideAt=(p,k,ax,v,dir)=>{for(let j=k;j>=0&&j<p.length/2;j+=dir){const d=ax?p[2*j+1]-v:p[2*j]-v;if(Math.abs(d)>FT)return d>0?1:-1;}return 0;};
    for(const L of lines){if(L.r&AR_GATE)continue;const p=L.p,n=p.length/2;
      for(let k=0;k<n;k++){const x=p[2*k],y=p[2*k+1];for(const[ax,A,c,o]of[[0,XS,x,y],[1,YS,y,x]]){const v=on(c,A);if(v==null)continue;
        const sd=sideAt(p,k,ax,v,-1)||sideAt(p,k,ax,v,1);if(!sd)continue;let l=TP.get(key(ax,v));if(!l)TP.set(key(ax,v),l=[]);l.push({s:o,side:sd});
        const sd2=sideAt(p,k,ax,v,1);if(sd2&&sd2!==sd)l.push({s:o,side:sd2});}}}
    const opp=(ax,v,s0,s1,side)=>{const l=TP.get(key(ax,v));if(!l)return false;const a=Math.min(s0,s1),b=Math.max(s0,s1),O=l.filter(t=>t.side!==side);// 對面要碰到這段的兩端，或碰到中間
      return O.some(t=>t.s>a+FT&&t.s<b-FT)||O.some(t=>Math.abs(t.s-a)<=FT)&&O.some(t=>Math.abs(t.s-b)<=FT);};
    const cutAt=[];const out=[];let cut=0;
    for(const L of lines){if(L.r&AR_GATE){out.push(L);continue;}const p=L.p;let cur=[p[0],p[1]],any=false;
      for(let i=2;i<p.length;i+=2){let ok=along(p[i-2],p[i-1],p[i],p[i+1]);
        if(ok){const vx=on(p[i-2],XS),ax=vx!=null&&Math.abs(p[i]-vx)<=FT?0:1,v=ax?on(p[i-1],YS):vx,k=i/2-1;
          const side=sideAt(p,k,ax,v,-1)||sideAt(p,k+1,ax,v,1);ok=!!side;}// 共用框邊上的封口段一律當假邊（2026-11-20 使用者：完全貼著圖框的屋線視為不存在，兩端變懸空再逐點報）
        if(ok){any=true;cut++;cutAt.push(p[i-2],p[i-1],p[i],p[i+1]);if(cur.length>=4)out.push(Object.assign({},L,{p:cur,fcut:true}));cur=[p[i],p[i+1]];}else cur.push(p[i],p[i+1]);}
      if(!any){out.push(L);continue;}if(cur.length>=4)out.push(Object.assign({},L,{p:cur,fcut:true}));}
    lines=out;opt.frameCut=cut;opt.frameCutAt=cutAt;}
  const cnt={};const put=(m)=>{cnt[m.type]=(cnt[m.type]||0)+1;mark(m);};const noFl=[];

  /* ---- 0. 土路路口封口：土路（鬆路面）的線頭接在道路、人行道等線上、路口沒封起來的，和對面土路線的線頭配對（12m 內、互為最近），補一條看不見的封口線（懸空的線頭不補，照樣報懸空） ---- */
  const roadTy=L=>{const n=L.nm||'';return/鬆路面|土路/.test(n)?'鬆路面':/人行道/.test(n)?'人行道':'道路';};
  if(opt.roadFill!==false){const E=[],EGm=new Map(),MC=12;
    const SG=new Map(),SC=4,segAt=[];lines.forEach((L,li)=>{const p=L.p;for(let i=2;i<p.length;i+=2){const k=segAt.length;segAt.push([p[i-2],p[i-1],p[i],p[i+1],li]);
      const i0=Math.floor(Math.min(p[i-2],p[i])/SC),i1=Math.floor(Math.max(p[i-2],p[i])/SC),j0=Math.floor(Math.min(p[i-1],p[i+1])/SC),j1=Math.floor(Math.max(p[i-1],p[i+1])/SC);
      if((i1-i0+1)*(j1-j0+1)>2500)continue;for(let a=i0;a<=i1;a++)for(let b=j0;b<=j1;b++){const q=a*1e7+b;let l=SG.get(q);if(!l)SG.set(q,l=[]);l.push(k);}}});
    const touches=(x,y,li)=>{const l=SG.get(Math.floor(x/SC)*1e7+Math.floor(y/SC));if(!l)return false;for(const k of l){const[ax,ay,cx,cy,lj]=segAt[k];if(lj===li)continue;const dx=cx-ax,dy=cy-ay,l2=dx*dx+dy*dy;if(!l2)continue;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=t<0?0:t>1?1:t;if(Math.hypot(ax+dx*t-x,ay+dy*t-y)<=tol)return true;}return false;};
    lines.forEach((L,li)=>{if(!(L.r&(AR_ROAD|AR_WALK))||(L.r&AR_ELEV)||L.p.length<4||roadTy(L)!=='鬆路面')return;const p=L.p,n=p.length,ty=roadTy(L);
      for(const[x,y]of[[p[0],p[1]],[p[n-2],p[n-1]]]){const k=E.length;E.push({x,y,li,ty,r:L.r&(AR_ROAD|AR_WALK),nm:L.nm});const q=Math.floor(x/MC)*1e7+Math.floor(y/MC);let a=EGm.get(q);if(!a)EGm.set(q,a=[]);a.push(k);}});
    const nbr=(e,f)=>{for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=EGm.get((Math.floor(e.x/MC)+a)*1e7+Math.floor(e.y/MC)+b);if(l)for(const k of l)f(E[k]);}};
    // 和同種線的線頭接在一起的（只是線斷開）不算路口
    const cont=E.map(e=>{if(!touches(e.x,e.y,e.li))return true;/* 懸空的線頭不補 */let c=false;nbr(e,o=>{if(o!==e&&o.li!==e.li&&o.ty===e.ty&&Math.hypot(o.x-e.x,o.y-e.y)<=tol)c=true;});return c;});
    const best=E.map((e,i)=>{if(cont[i])return null;let b=null,bd=MC;nbr(e,o=>{const j=E.indexOf(o);if(o===e||o.li===e.li||o.ty!==e.ty||cont[j])return;const d=Math.hypot(o.x-e.x,o.y-e.y);if(d>tol&&d<bd){bd=d;b=o;}});return b;});
    const nm=[];E.forEach((e,i)=>{const b=best[i];if(!b)return;const j=E.indexOf(b);if(best[j]!==e||j<i)return;nm.push({p:[e.x,e.y,b.x,b.y],r:e.r,nm:e.nm,mouth:true});});
    lines=lines.concat(nm);opt._mouths=nm.length;}
  /* ---- 0b. 植被圖層的散線：封閉 4 點以上、長度超過 3m、或兩端都接在其他線上的＝拿來當範圍線（圖層用錯）→ 照樣當範圍線，另外報；其餘是炸開的圖例碎片，當圖例 ---- */
  const vegBad=[];
  if((opt.veg||[]).length){const SG=new Map(),SC=4,seg=[];lines.forEach((L,li)=>{const p=L.p;for(let i=2;i<p.length;i+=2){const k=seg.length;seg.push([p[i-2],p[i-1],p[i],p[i+1]]);
      const i0=Math.floor(Math.min(p[i-2],p[i])/SC),i1=Math.floor(Math.max(p[i-2],p[i])/SC),j0=Math.floor(Math.min(p[i-1],p[i+1])/SC),j1=Math.floor(Math.max(p[i-1],p[i+1])/SC);
      if((i1-i0+1)*(j1-j0+1)>2500)continue;for(let a=i0;a<=i1;a++)for(let b=j0;b<=j1;b++){const q=a*1e7+b;let l=SG.get(q);if(!l)SG.set(q,l=[]);l.push(k);}}});
    const touch=(x,y)=>{const l=SG.get(Math.floor(x/SC)*1e7+Math.floor(y/SC));if(!l)return false;for(const k of l){const[ax,ay,cx,cy]=seg[k],dx=cx-ax,dy=cy-ay,l2=dx*dx+dy*dy;if(!l2)continue;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=t<0?0:t>1?1:t;if(Math.hypot(ax+dx*t-x,ay+dy*t-y)<=Math.max(tol,0.05))return true;}return false;};
    const add=[];for(const v of opt.veg){const a=v.p,n=a.length/2,closed=n>=4&&Math.hypot(a[0]-a[a.length-2],a[1]-a[a.length-1])<0.01;
      if(closed||v.L>3||(touch(a[0],a[1])&&touch(a[a.length-2],a[a.length-1]))){add.push({p:a,r:AR_OTHER,nm:v.nm});vegBad.push(v);}
      else{let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<a.length;i+=2){x0=Math.min(x0,a[i]);x1=Math.max(x1,a[i]);y0=Math.min(y0,a[i+1]);y1=Math.max(y1,a[i+1]);}points.push({x:(x0+x1)/2,y:(y0+y1)/2,k:v.k});}}
    lines=lines.concat(add);}
  /* ---- 0c. 註記、圖例、文字圖層上畫的一般線段（不是圖塊、不是文字）：有圍成封閉就當範圍線，另報圖層用錯；懸空的會被剪掉，不影響 ---- */
  if((opt.odd||[]).length)lines=lines.concat(opt.odd.map(o=>({p:o.p,r:AR_OTHER|AR_FREE,nm:o.nm,ly:o.ly,odd:true,oh:!!o.h})));
  /* ---- 1. 一般拓樸（不含圖框） ---- */
  const G=arGraph(lines,tol);
  if(!G.ns)return{marks:[],st:{seg:0,ms:Date.now()-t0}};
  const{nX,nY,eU,eV,eR,deg0,aS,aE,NN,NE,X0,Y0,X1,Y1,R,cells,bx0,by0,NX,NY,cs}=G;
  const P=arPrune(G),alive=P.alive;
  {const seen=new Set();for(let e=0;e<NE;e++){if(!alive[e])continue;const li=G.eL[e],L=lines[li];if(!L||!L.odd||seen.has(li))continue;seen.add(li);
    put({x:(nX[eU[e]]+nX[eV[e]])/2,y:(nY[eU[e]]+nY[eV[e]])/2,type:'oddly',msg:`範圍線用錯圖層：這條線畫在 ${L.nm||L.ly}（${L.oh?'樓層、房屋註記':'圖例、文字'}圖層），有圍成封閉，已當成範圍線；應改成範圍類圖層`});}}
  // 高架道路的線段（格網），用來判斷「碰到高架」
  const EV=[],EG=new Map(),EC=10;
  for(const L of lines){if(!(L.r&AR_ELEV))continue;const p=L.p;for(let i=2;i<p.length;i+=2){const k=EV.length;EV.push([p[i-2],p[i-1],p[i],p[i+1]]);
    const i0=Math.floor(Math.min(p[i-2],p[i])/EC),i1=Math.floor(Math.max(p[i-2],p[i])/EC),j0=Math.floor(Math.min(p[i-1],p[i+1])/EC),j1=Math.floor(Math.max(p[i-1],p[i+1])/EC);
    if((i1-i0+1)*(j1-j0+1)>400)continue;for(let a=i0;a<=i1;a++)for(let b=j0;b<=j1;b++){const q=a*1e7+b;let l=EG.get(q);if(!l)EG.set(q,l=[]);l.push(k);}}}
  const evNear=(x,y)=>{const l=EG.get(Math.floor(x/EC)*1e7+Math.floor(y/EC));if(!l)return[];return l;};
  const nearElev=(x,y,d)=>{for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++){const l=EG.get((Math.floor(x/EC)+a)*1e7+Math.floor(y/EC)+b);if(!l)continue;for(const k of l){const[ax,ay,cx,cy]=EV[k],dx=cx-ax,dy=cy-ay,l2=dx*dx+dy*dy;if(!l2)continue;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=t<0?0:t>1?1:t;if(Math.hypot(ax+dx*t-x,ay+dy*t-y)<=d)return true;}}return false;};
  // 單線水溝（五碼小水溝＝七碼單線水）也是範圍線：線頭搭在它上面不算懸空（它自己不參與圍區，因為很少自己圍成一圈）
  const DG=new Map(),DC=20,DS=[];for(const a of (opt.ditch||[]))for(let i=2;i<a.length;i+=2){const k=DS.length;DS.push([a[i-2],a[i-1],a[i],a[i+1]]);
    for(let x=Math.floor(Math.min(a[i-2],a[i])/DC);x<=Math.floor(Math.max(a[i-2],a[i])/DC);x++)for(let y=Math.floor(Math.min(a[i-1],a[i+1])/DC);y<=Math.floor(Math.max(a[i-1],a[i+1])/DC);y++){const g=x*1e7+y;let l=DG.get(g);if(!l)DG.set(g,l=[]);l.push(k);}}
  const nearDitch=(x,y,d)=>{const l=DG.get(Math.floor(x/DC)*1e7+Math.floor(y/DC));if(!l)return false;for(const k of l){const[ax,ay,cx,cy]=DS[k],dx=cx-ax,dy=cy-ay,l2=dx*dx+dy*dy;let t=l2?((x-ax)*dx+(y-ay)*dy)/l2:0;t=t<0?0:t>1?1:t;if(Math.hypot(ax+dx*t-x,ay+dy*t-y)<=d)return true;}return false;};
  const freeEnd=v=>!nearFrame(nX[v],nY[v],0.5)&&!nearElev(nX[v],nY[v],0.3)&&!nearDitch(nX[v],nY[v],0.05);// 碰到圖框、高架、單線水溝的端點都不算懸空
  // 平面道路、人行道不可跨越高架道路（要在高架處中斷）
  if(EV.length){const seen=[];for(const L of lines){if(!(L.r&(AR_ROAD|AR_WALK))||(L.r&AR_ELEV)||L.mouth)continue;const p=L.p;
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
  const hAll=lines.filter(L=>L.r&(AR_HOUSE|AR_TEMP|AR_ADD)).map(L=>({p:L.p,r:hR(L)})).concat(lines.filter(L=>((L.r&AR_Q)||(L.odd&&L.oh))&&!(L.r&(AR_HOUSE|AR_TEMP|AR_ADD))).map(L=>({p:L.p,r:AR_OTHER})));// Q 線也算：看不清楚用 Q 線封閉的房屋不算未封閉
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
    const HP=lines.filter(L=>(L.r&(AR_HOUSE|AR_TEMP))&&L.p.length>=8&&Math.hypot(L.p[0]-L.p[L.p.length-2],L.p[1]-L.p[L.p.length-1])<=Math.max(tol,0.001)).map(L=>{const p=L.p;let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;for(let i=0;i<p.length;i+=2){x0=Math.min(x0,p[i]);x1=Math.max(x1,p[i]);y0=Math.min(y0,p[i+1]);y1=Math.max(y1,p[i+1]);}return{p,bb:[x0,y0,x1,y1]};});
    const inHousePoly=(x,y)=>HP.some(h=>x>=h.bb[0]&&x<=h.bb[2]&&y>=h.bb[1]&&y<=h.bb[3]&&arInRing(h.p,x,y));
    const hasH=new Set();for(const p of points)if(p.k==='H'||p.add){const k=TH.locate(p.x,p.y);if(k>=0)hasH.add(k);}
    // 房屋線圍出的範圍，裡面沒有房屋（樓層）註記、也沒有其他地物圖例（不是中庭空地）：最後再看有沒有已經報成「沒有屬性」
    for(let k=0;k<TH.F.length;k++){if(hasH.has(k))continue;const f=TH.F[k];if(f.area<2||f.area>opt.maxArea||2*f.area/f.per<0.5)continue;
      const c=arInner(f);if(!inHousePoly(c[0],c[1]))continue;if((opt.notes||[]).some(q=>q[0]>=f.bb[0]&&q[0]<=f.bb[2]&&q[1]>=f.bb[1]&&q[1]<=f.bb[3]&&arInRing(f.ring,q[0],q[1])))continue;// 只看在某一棟房屋的封閉線裡面的（房子之間圍出的空地、中庭不算）
      const tk=T.locate(c[0],c[1]);if(tk>=0){const g=T.F[tk];if(g.kinds.size||g.fac.length)continue;}noFl.push({c,f});}
    {const out=[];for(const L of lines){if(!(L.r&AR_ADD)||L.k7||(L.r&(AR_HOUSE|AR_TEMP)))continue;const p=L.p;
      for(let i=2;i<p.length;i+=2){const dx=p[i]-p[i-2],dy=p[i+1]-p[i-1],l=Math.hypot(dx,dy);if(l<0.3)continue;const mx=(p[i]+p[i-2])/2,my=(p[i+1]+p[i-1])/2,nx=-dy/l*0.05,ny=dx/l*0.05;
        if(!hasH.has(TH.locate(mx+nx,my+ny))&&!hasH.has(TH.locate(mx-nx,my-ny)))out.push([mx,my]);}}
      const used=new Set();for(let i=0;i<out.length;i++){if(used.has(i))continue;used.add(i);for(let j=i+1;j<out.length;j++)if(!used.has(j)&&Math.hypot(out[j][0]-out[i][0],out[j][1]-out[i][1])<3)used.add(j);
        put({x:out[i][0],y:out[i][1],type:'addline',msg:'增建線越出永久房屋範圍'});}}
  }

  /* ---- 3. 增建線找不到增建註記（B01）：相連的一組增建線，圍到的各區裡至少一區要有增建註記
     （增建線旁邊沒加蓋、維持原樓層的區塊本來就沒有增建註記，所以不逐段要求兩側） ---- */
  {const ae=[];for(let e=0;e<NE;e++)if(alive[e]&&eR[e]===AR_ADD&&!lines[G.eL[e]].k7)ae.push(e);
    for(const c of arChains(G,ae,null,0)){let ok=false;
      for(const e of c.es){const x0=nX[eU[e]],y0=nY[eU[e]],x1=nX[eV[e]],y1=nY[eV[e]],l=Math.hypot(x1-x0,y1-y0);if(l<1e-6)continue;
        const mx=(x0+x1)/2,my=(y0+y1)/2,nx=-(y1-y0)/l*0.02,ny=(x1-x0)/l*0.02;// 往兩邊各偏 2cm 找區（島狀的增建框外側也找得到）
        for(const k of[locate(mx+nx,my+ny),locate(mx-nx,my-ny)])if(k>=0&&F[k].add.length){ok=true;break;}if(ok)break;}
      if(ok)continue;const e=c.es[Math.floor(c.es.length/2)];
      put({x:(nX[eU[e]]+nX[eV[e]])/2,y:(nY[eU[e]]+nY[eV[e]])/2,type:'addside',msg:'增建線找不到增建註記（這組增建線圍到的區域都沒有增建註記）'});}}

  /* ---- 4. 一區兩種屬性、和道路相通、增建註記位置、空白區 ---- */
  const gapR=opt.gapMax||3;
  // 懸空端點歸到所在的區（柵欄、牆、駁坎、土坎等可懸空的線，端點不當缺口）
  for(let v=0;v<NN;v++){if(deg0[v]!==1)continue;let fr=false;for(let k=aS[v];k<aS[v+1];k++)if(eR[aE[k]]&AR_FREE)fr=true;const k=locate(nX[v],nY[v]);if(k<0)continue;if(fr)(F[k].fends||(F[k].fends=[])).push(v);else(F[k].ends||(F[k].ends=[])).push(v);
    for(let q=aS[v];q<aS[v+1];q++)if(eR[aE[q]]&(AR_ROAD|AR_WALK)){(F[k].rends||(F[k].rends=[])).push(v);break;}}
  const nearK=(x,y)=>{// 最近的幾條不同線上的點
    const L=[];const i0=Math.max(0,Math.floor((x-gapR-bx0)/cs)),i1=Math.min(NX-1,Math.floor((x+gapR-bx0)/cs)),j0=Math.max(0,Math.floor((y-gapR-by0)/cs)),j1=Math.min(NY-1,Math.floor((y+gapR-by0)/cs));const seen=new Set();
    for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const a=cells.get(j*NX+i);if(!a)continue;for(const s of a){if(seen.has(s))continue;seen.add(s);const ax=X0[s],ay=Y0[s],dx=X1[s]-ax,dy=Y1[s]-ay,l2=dx*dx+dy*dy;let t=((x-ax)*dx+(y-ay)*dy)/l2;t=t<0?0:t>1?1:t;
      const qx=ax+dx*t,qy=ay+dy*t,d=Math.hypot(qx-x,qy-y);if(d<=tol||d>gapR)continue;L.push({d,x2:qx,y2:qy});}}
    L.sort((a,b)=>a.d-b.d);const out=[];for(const c of L){if(out.some(o=>Math.hypot(o.x2-c.x2,o.y2-c.y2)<0.05))continue;out.push(c);if(out.length>=4)break;}return out;};
  // 先找真正的線頭（懸空端點）：一般線頭 → 加上柵欄、籬、牆等可懸空線的線頭；都找不到才用區域轉角離別條線近的地方（兩條線平行很近時容易挑錯，所以放最後）
  const findGap=(f,mode,tk)=>findGap1(f,mode,tk,false,false)||((f.fends||[]).length?findGap1(f,mode,tk,true,false):null)||findGap1(f,mode,tk,false,true)||((f.fends||[]).length?findGap1(f,mode,tk,true,true):null);
  const findGap1=(f,mode,tk,useFree,vtx)=>{
    const C=[];for(const v of useFree?(f.ends||[]).concat(f.fends):f.ends||[])for(const n of nearK(nX[v],nY[v]))C.push({x:nX[v],y:nY[v],x2:n.x2,y2:n.y2,d:n.d});
    if(vtx){const seenV=new Set();for(const h of f.hs){const v=hFrom(h);if(seenV.has(v))continue;seenV.add(v);const n=nearK(nX[v],nY[v])[0];if(n&&n.d<=2)C.push({x:nX[v],y:nY[v],x2:n.x2,y2:n.y2,d:n.d});}}
    if(!C.length)return null;C.sort((a,b)=>a.d-b.d);if(C.length>120)C.length=120;
    const seg=e=>({p:[nX[eU[e]],nY[eU[e]],nX[eV[e]],nY[eV[e]]],r:eR[e]});
    const base=[];for(const h of f.hs)base.push(seg(h>>1));
    {const i0=Math.max(0,Math.floor((f.bb[0]-bx0)/cs)),i1=Math.min(NX-1,Math.floor((f.bb[2]-bx0)/cs)),j0=Math.max(0,Math.floor((f.bb[1]-by0)/cs)),j1=Math.min(NY-1,Math.floor((f.bb[3]-by0)/cs));const seen=new Set();
      for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++){const a=cells.get(j*NX+i);if(!a)continue;for(const q of a){if(seen.has(q))continue;seen.add(q);const mx=(X0[q]+X1[q])/2,my=(Y0[q]+Y1[q])/2;
        if(mx<f.bb[0]||mx>f.bb[2]||my<f.bb[1]||my>f.bb[3])continue;if(arInRing(f.ring,mx,my))base.push({p:[X0[q],Y0[q],X1[q],Y1[q]],r:R[q]});}}}
    let full=true;
    const ok=SF=>{if(mode==='mix'){let mx=0;for(const g of SF)mx=Math.max(mx,g.kinds.size);return full?mx<=1:mx<f.kinds.size;}
      if(mode==='roadk'){const G2=SF.filter(g=>g.kinds.has(tk));return G2.length>0&&G2.every(g=>g.kinds.size===1&&g.area<f.area*0.9);}// 補上缺口後，這種地物自己成區、不和別種同區
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
  const crossPt=(f,ba,bb)=>{// 兩幅交界上、在區域裡的一點
      let x0,y0,x1,y1;if(Math.abs(ba[2]-bb[0])<1||Math.abs(ba[0]-bb[2])<1){const x=Math.abs(ba[2]-bb[0])<1?ba[2]:ba[0];x0=x1=x;y0=Math.max(ba[1],bb[1],f.bb[1]);y1=Math.min(ba[3],bb[3],f.bb[3]);}
      else{const y=Math.abs(ba[3]-bb[1])<1?ba[3]:ba[1];y0=y1=y;x0=Math.max(ba[0],bb[0],f.bb[0]);x1=Math.min(ba[2],bb[2],f.bb[2]);}
      {const L=Math.hypot(x1-x0,y1-y0),n=Math.min(400,Math.max(2,Math.ceil(L/0.25))),ins=[];
        for(let i=0;i<=n;i++){const x=x0+(x1-x0)*i/n,y=y0+(y1-y0)*i/n;if(arInRing(f.ring,x,y)&&locate(x,y)===f.id)ins.push([x,y]);}
        if(ins.length)return ins[Math.floor(ins.length/2)];}
      // 取樣沒碰到（區域在框邊上很窄）：用區域邊界和框線的交點，取在區內、最長的一段的中點
      const vert=x0===x1,r=f.ring,T=[vert?y0:x0,vert?y1:x1];
      for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const ax=r[j],ay=r[j+1],bx=r[i],by=r[i+1];
        if(vert){if((ax-x0)*(bx-x0)<0){const t=ay+(by-ay)*(x0-ax)/(bx-ax);if(t>y0&&t<y1)T.push(t);}}else if((ay-y0)*(by-y0)<0){const t=ax+(bx-ax)*(y0-ay)/(by-ay);if(t>x0&&t<x1)T.push(t);}}
      T.sort((a,b)=>a-b);let best=null,bl=0;
      for(let i=0;i+1<T.length;i++){const m=(T[i]+T[i+1])/2,x=vert?x0:m,y=vert?m:y0;if(T[i+1]-T[i]>bl&&arInRing(r,x,y)&&locate(x,y)===f.id){bl=T[i+1]-T[i];best=[x,y];}}
      return best;};
  const mixF=new Set(),edgeF=new Set();
  // 被圖框切開的區：每一幅裡各自只有一種地物、但相鄰兩幅不同 → 是接邊不合，不報一區兩種屬性／相通（交給下面的接邊檢查）
  if(FB.length)for(const f of F){if(f.kinds.size<2)continue;const parts=[];
    for(let i=0;i<FB.length;i++){const b=FB[i];if(!pub[i]||b[2]<f.bb[0]||b[0]>f.bb[2]||b[3]<f.bb[1]||b[1]>f.bb[3])continue;const c=arClipBox(f.ring,b);if(!c.bb||c.bb[2]-c.bb[0]<opt.over||c.bb[3]-c.bb[1]<opt.over)continue;
      const k=new Set();for(const p of f.all)if(p.x>b[0]&&p.x<b[2]&&p.y>b[1]&&p.y<b[3])k.add(p.k);parts.push({k,b});}
    if(parts.length<2||!parts.every(p=>p.k.size<=1))continue;
    const nr=(u,v)=>Math.abs(u-v)<1;let hit=false;// 要有一對相鄰、地物不同、而且區域真的跨過兩幅交界的
    for(let a=0;a<parts.length&&!hit;a++)for(let c=a+1;c<parts.length&&!hit;c++){const A=parts[a],B=parts[c];if(!A.k.size||!B.k.size||[...A.k][0]===[...B.k][0])continue;
      const adj=(nr(A.b[2],B.b[0])||nr(A.b[0],B.b[2]))&&A.b[1]<B.b[3]&&B.b[1]<A.b[3]||(nr(A.b[3],B.b[1])||nr(A.b[1],B.b[3]))&&A.b[0]<B.b[2]&&B.b[0]<A.b[2];
      if(adj&&crossPt(f,A.b,B.b))hit=true;}
    if(hit)edgeF.add(f.id);}
  for(const f of F){const rl=b=>f.rl[b]||0;
    if(f.all.length&&!f.all.some(p=>keep(p.x,p.y)))continue;// 作業範圍外的不用找
    if(edgeF.has(f.id)){mixF.add(f.id);continue;}
    if(f.kinds.size>1&&FB.length){// 有兩種以上地物、而且有線頭斷在圖框上：區域是從圖框缺口漏過去的 → 接邊（範圍線在圖框處不接）
      const fe=[...(f.ends||[]),...(f.fends||[])].filter(v=>nearFrame(nX[v],nY[v],0.3)&&keep(nX[v],nY[v]));
      if(fe.length){mixF.add(f.id);const done=[];for(const v of fe){const x=nX[v],y=nY[v];if(done.some(q=>Math.hypot(q[0]-x,q[1]-y)<1))continue;done.push([x,y]);
        put({x,y,type:'edge',msg:`接邊：範圍線在圖框處不接（區內${[...f.kinds.keys()].map(k=>k==='H'?'房屋':k).join('＋')}從這裡漏過圖框）`,ring:f.ring});}continue;}}
    if(f.kinds.has('H')&&opt.withHouse)for(const k of opt.withHouse)f.kinds.delete(k);// 七碼寺廟（卍）可以和樓層註記同區
    if(f.kinds.size>1&&opt.bigKinds){const big=[...f.kinds.keys()].filter(k=>opt.bigKinds.has(k));
      if(big.length){mixF.add(f.id);const oth=[...f.kinds.keys()].filter(k=>!opt.bigKinds.has(k)).map(k=>k==='H'?'房屋':k),p=f.kinds.get(big[0]);
        const g=findGap(f,'mix');
        const water=big.some(k=>/池|濕地/.test(k)),dNear=(x,y)=>(opt.ditch||[]).some(a=>{for(let i=2;i<a.length;i+=2){const ax=a[i-2],ay=a[i-1],dx=a[i]-ax,dy=a[i+1]-ay,l2=dx*dx+dy*dy;let t=l2?((x-ax)*dx+(y-ay)*dy)/l2:0;t=t<0?0:t>1?1:t;if(Math.hypot(ax+dx*t-x,ay+dy*t-y)<=1)return true;}return false;});
        if(g&&water&&g.all.every(c=>dNear((c.x+c.x2)/2,(c.y+c.y2)/2)))continue;// 水溝接進水體，外框在那裡斷開是正常的
        if(g)put({x:g.x,y:g.y,type:'facility',msg:`大型設施沒有用範圍線包起來：${big.join('、')}（和${oth.join('、')}同區，缺口 ${g.all.map(c=>gapTxt(c.d)).join('、')}m）`,ring:f.ring,gap:g.all.flatMap(c=>[c.x,c.y,c.x2,c.y2]),path:pathOf(f,g,'mix')});
        else put({x:p.x,y:p.y,type:'facility',msg:`大型設施沒有用範圍線包起來：${big.join('、')}（和${oth.join('、')}同區）`,ring:f.ring});continue;}}
    if(opt.roadFill!==false&&f.all.length&&2*f.area/f.per<=8){// 路面（窄長、周邊大多是同一種道路線）裡的圖例都是放錯的
      const by={},src=new Set();for(const h of f.hs){const e=h>>1;if(!lines[G.eL[e]].mouth)src.add(G.eL[e]);if(!(eR[e]&(AR_ROAD|AR_WALK))||(eR[e]&AR_ELEV))continue;const L=lines[G.eL[e]],t=roadTy(L);by[t]=(by[t]||0)+Math.hypot(nX[eU[e]]-nX[eV[e]],nY[eU[e]]-nY[eV[e]]);}
      const top=Object.entries(by).sort((a,b)=>b[1]-a[1])[0];
      const wMax={人行道:4,鬆路面:6,道路:6};// 路面寬度上限（2×面積÷周長）：太寬的多半是被道路線圍起來的綠地、廣場
      if(top&&top[0]==='鬆路面'&&top[1]>=f.per*0.6&&2*f.area/f.per<=wMax[top[0]]&&src.size>=2&&f.hs.some(h=>f2F[faceOf[h^1]]>=0)){/* 一條封閉線自己圍起來的、或整圈浮在別區裡的島（花台、植栽槽）不是路面 */mixF.add(f.id);for(const p of f.all)put({x:p.x,y:p.y,type:'onroad',msg:`圖例在${top[0]}上：${p.k==='H'?'房屋':p.k}（${top[0]}補上路口後填滿，裡面不該有圖例）`,ring:f.ring});continue;}}
    let nextSurf=0;if(f.kinds.size>1&&rl(AR_ROAD)+rl(AR_WALK)>=f.per*0.5){// 道路線另一邊就是沒有圖例的窄長路面（例如街廓外圈的人行道甜甜圈）→ 這區在路面外，不是和道路同區
      for(const h of f.hs){const e=h>>1;if(!(eR[e]&(AR_ROAD|AR_WALK)))continue;const g=f2F[faceOf[h^1]];if(g<0)continue;const o=F[g];
        if(!o.kinds.size&&!o.add.length&&2*o.area/o.per<=8)nextSurf+=Math.hypot(nX[eU[e]]-nX[eV[e]],nY[eU[e]]-nY[eV[e]]);}}
    if(f.kinds.size>1&&rl(AR_ROAD)+rl(AR_WALK)>=f.per*0.5&&(f.rends||[]).length&&nextSurf<(rl(AR_ROAD)+rl(AR_WALK))*0.5){// 道路／人行道線有開口伸進這區才算相通；道路線自己封閉（例如街廓內圈人行道）就當一般區// 道路／人行道圍成的大區裡有好幾種地物：每種各自和道路相通（各找各的缺口）
      mixF.add(f.id);for(const k of f.kinds.keys()){const nm=k==='H'?'房屋':k,g=findGap(f,'roadk',k);
        if(g)put({x:g.x,y:g.y,type:'road',msg:`${nm}和道路／人行道相通（缺口 ${g.all.map(c=>gapTxt(c.d)).join('、')}m）`,ring:f.ring,gap:g.all.flatMap(c=>[c.x,c.y,c.x2,c.y2])});
        else{const p=f.all.find(q=>q.k===k);put({x:p.x,y:p.y,type:'road',msg:`${nm}和道路／人行道同區（找不到 3m 內的缺口：可能少畫範圍線，或圖例放錯區）`,ring:f.ring});}}
      continue;}
    if(f.kinds.size>1){mixF.add(f.id);const names=[...f.kinds.keys()].map(k=>k==='H'?'房屋':k),g=findGap(f,'mix');
      const rEnd=g&&(f.rends||[]).find(v=>g.all.some(c=>Math.hypot(nX[v]-c.x,nY[v]-c.y)<0.01||Math.hypot(nX[v]-c.x2,nY[v]-c.y2)<0.01));
      if(rEnd!=null){const L=lines[G.eL[aE[aS[rEnd]]]]||{},t=/人行道/.test(L.nm||'')?'人行道':/鬆路面/.test(L.nm||'')?'鬆路面道路':'道路';
        put({x:g.x,y:g.y,type:'road',msg:`${t}沒有封閉（缺口 ${g.all.map(c=>gapTxt(c.d)).join('、')}m）：${names.join('＋')}從這裡相通`,ring:f.ring,gap:g.all.flatMap(c=>[c.x,c.y,c.x2,c.y2]),path:pathOf(f,g,'mix')});}
      else if(g)put({x:g.x,y:g.y,type:'mix',msg:`一區兩種屬性：${names.join('＋')}（缺口 ${g.all.map(c=>gapTxt(c.d)).join('、')}m）`,ring:f.ring,gap:g.all.flatMap(c=>[c.x,c.y,c.x2,c.y2]),path:pathOf(f,g,'mix')});
      else{// 找不到缺口：先找插入點跑到範圍外的圖例（離邊界 1m 內，線的另一側是同種地物或沒有地物）
        const r=f.ring,stray=[];
        for(const p of f.all){let bd=1.0,bq=null;for(let i=0,j=r.length-2;i<r.length;j=i,i+=2){const ax=r[j],ay=r[j+1],dx=r[i]-ax,dy=r[i+1]-ay,l2=dx*dx+dy*dy;if(!l2)continue;
            let t=((p.x-ax)*dx+(p.y-ay)*dy)/l2;t=t<0?0:t>1?1:t;const qx=ax+dx*t,qy=ay+dy*t,d=Math.hypot(qx-p.x,qy-p.y);if(d<bd){bd=d;bq=[qx,qy];}}
          if(!bq||bd<1e-6)continue;const ux=(bq[0]-p.x)/bd,uy=(bq[1]-p.y)/bd,k=locate(bq[0]+ux*0.05,bq[1]+uy*0.05);if(k<0||k===f.id)continue;const o=F[k];
          if(o.kinds.has(p.k))stray.push({p,d:bd,same:true});}// 只算對面是同種地物的（圖例從自己那區跑出來）；對面沒有地物的（例如緊貼人行陸橋）不報
        {const allIn=k=>f.all.filter(p=>p.k===k).every(p=>stray.some(s=>s.p===p));for(let i=stray.length-1;i>=0;i--)if(!allIn(stray[i].p.k))stray.splice(i,1);}// 這區裡同種圖例還有別的、不在邊界旁：這種是這區本來的地物，不是跑出來的
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
    if(rl(AR_ADD)>0||rl(AR_TEMP)>=f.per*0.5||rl(AR_GATE)>0||rl(AR_STAIR)>0||rl(AR_WALK)+rl(AR_ROAD)>=f.per*0.2||rl(AR_HOUSE)<f.per*0.5)continue;
    {// 區裡面浮著的島（沒接到外圈的封閉線，例如增建圈）也是這區的邊界，一起算
      let per=f.per;const rr={};const ri=b=>(f.rl[b]||0)+(rr[b]||0);
      for(const g of F){if(g===f||g.area>=f.area||g.bb[0]<f.bb[0]||g.bb[2]>f.bb[2]||g.bb[1]<f.bb[1]||g.bb[3]>f.bb[3])continue;
        if(!arInRing(f.ring,g.ring[0],g.ring[1]))continue;
        per+=g.per;for(const k in g.rl)rr[k]=(rr[k]||0)+g.rl[k];}
      if(per>f.per&&(ri(AR_ADD)>0||ri(AR_TEMP)>=per*0.5||ri(AR_GATE)>0||ri(AR_STAIR)>0||ri(AR_WALK)+ri(AR_ROAD)>=per*0.2||ri(AR_HOUSE)<per*0.5))continue;}
    const c=arInner(f);put({x:c[0],y:c[1],type:'empty',msg:`沒有屬性的區域（${f.area<10?f.area.toFixed(1):Math.round(f.area)} m²）`,ring:f.ring});}

  /* ---- 5. 接邊：圖框切開的區域，兩側都要有屬性且一致（E09，不看距離，以拓樸為準）
     永久和增建分開比（2026-11-19）：五碼交圖時增建線會關掉，
     (a) 房屋：用關掉增建線的房屋區（TH）比兩側樓層註記，整棟同樓層就對，註記在不在增建線內都沒關係；
     (b) 增建：用房屋＋增建線的區（TA），只比邊界有增建線的區兩側的增建註記；
     (c) 其他：一般區（F）裡在房屋裡面的跳過，房屋只當「房屋」一種地物和對面比。
     標記放在這區外框貼在共用框邊上的頂點（優先選拿掉假邊後的斷點），找不到才用框線上的點。 ---- */
  if(FB.length){
    const nr=(u,v)=>Math.abs(u-v)<1;
    const adjOf=(A,B)=>(nr(A[2],B[0])||nr(A[0],B[2]))&&A[1]<B[3]&&B[1]<A[3]?{ax:0,v:nr(A[2],B[0])?A[2]:A[0],a0:Math.max(A[1],B[1]),a1:Math.min(A[3],B[3])}
      :(nr(A[3],B[1])||nr(A[1],B[3]))&&A[0]<B[2]&&B[0]<A[2]?{ax:1,v:nr(A[3],B[1])?A[3]:A[1],a0:Math.max(A[0],B[0]),a1:Math.min(A[2],B[2])}:null;
    const CA=opt.frameCutAt||[];
    const edgePt=(f,e,q)=>{// 這區外框在共用框邊上的頂點：優先斷點，其次離 q 最近
      const r=f.ring,C=[];for(let k=0;k<r.length;k+=2){const x=r[k],y=r[k+1],d=e.ax?y-e.v:x-e.v,s=e.ax?x:y;if(Math.abs(d)<=0.06&&s>=e.a0-0.05&&s<=e.a1+0.05)C.push([x,y]);}
      if(!C.length)return q;const isCut=c=>{for(let k=0;k<CA.length;k+=2)if(Math.hypot(CA[k]-c[0],CA[k+1]-c[1])<0.1)return true;return false;};
      const cut=C.filter(isCut),L=cut.length?cut:C;let b=L[0],bd=Infinity;if(q)for(const c of L){const d=Math.hypot(c[0]-q[0],c[1]-q[1]);if(d<bd){bd=d;b=c;}}return b;};
    const edgeMid=(f,e,loc)=>{// 區域在共用框邊上的一點（區外框貼框邊的頂點的中間）
      const r=f.ring,S=[];for(let k=0;k<r.length;k+=2){const d=e.ax?r[k+1]-e.v:r[k]-e.v,s=e.ax?r[k]:r[k+1];if(Math.abs(d)<=0.06&&s>=e.a0-0.05&&s<=e.a1+0.05)S.push(s);}
      if(S.length){S.sort((a,b)=>a-b);const s=(S[0]+S[S.length-1])/2;return e.ax?[s,e.v]:[e.v,s];}
      // 線直接穿過框邊（沒有頂點在框上，七碼常見）：沿框邊取樣，取在區內那段的中間
      const a0=Math.max(e.a0,e.ax?f.bb[0]:f.bb[1]),a1=Math.min(e.a1,e.ax?f.bb[2]:f.bb[3]);if(!(a1>a0))return null;
      const n=Math.min(400,Math.max(2,Math.ceil((a1-a0)/0.25))),ins=[];
      for(let i=0;i<=n;i++){const t=a0+(a1-a0)*i/n,x=e.ax?t:e.v,y=e.ax?e.v:t;if(arInRing(f.ring,x,y)&&(!loc||loc(x,y)===f.id))ins.push([x,y]);}
      return ins.length?ins[Math.floor(ins.length/2)]:null;};
    const partsOf=f=>{const P=[];for(let i=0;i<FB.length;i++){const b=FB[i];if(b[2]<f.bb[0]||b[0]>f.bb[2]||b[3]<f.bb[1]||b[1]>f.bb[3])continue;
      const c=arClipBox(f.ring,b);if(!c.bb||c.area<=0)continue;if(c.bb[2]-c.bb[0]<opt.over||c.bb[3]-c.bb[1]<opt.over)continue;P.push({i,b});}return P;};
    const inB=(p,b)=>p.x>b[0]&&p.x<b[2]&&p.y>b[1]&&p.y<b[3];
    const eq=(a,b)=>a.size===b.size&&[...a].every(x=>b.has(x));
    // 點放進房屋區（TH／TA）：插入點壓在線上時改用文字中心
    const placeIn=T=>{const M=new Map();if(!T)return M;for(const p of points){let k=T.locate(p.x,p.y);if(k<0&&p.cx!=null)k=T.locate(p.cx,p.cy);if(k<0)continue;let a=M.get(k);if(!a)M.set(k,a=[]);a.push(p);}return M;};
    // 區域在共用框邊上真正跨過去的各段（沿框取樣，在區內的連續段）
    const runs=(f,e,loc)=>{const a0=Math.max(e.a0,e.ax?f.bb[0]:f.bb[1]),a1=Math.min(e.a1,e.ax?f.bb[2]:f.bb[3]);if(!(a1>a0))return[];
      const n=Math.min(2000,Math.max(2,Math.ceil((a1-a0)/0.2))),R=[];let st=null;
      for(let i=0;i<=n;i++){const t=a0+(a1-a0)*i/n,x=e.ax?t:e.v,y=e.ax?e.v:t;const ok=arInRing(f.ring,x,y)&&(!loc||loc(x,y)===f.id);
        if(ok&&st===null)st=t;if((!ok||i===n)&&st!==null){const en=ok?t:a0+(a1-a0)*(i-1)/n;if(en-st>=0.2)R.push((st+en)/2);st=null;}}return R;};
    const into=(e,s,side,d)=>e.ax?[s,e.v+side*d]:[e.v+side*d,s];// side：+1 往框邊正側
    const near1=(L,q)=>{let b=null,bd=Infinity;for(const p of L){const d=Math.hypot(p.x-q[0],p.y-q[1]);if(d<bd){bd=d;b=p;}}return b;};
    const cmp=(f,P,sig,skip,msgOne,msgDiff,q0,isF,loc)=>{const S=P.map(p=>Object.assign({},p,{s:sig(p.b)}));if(!S.some(p=>p.s.n))return;
      for(let a=0;a<S.length;a++)for(let b=a+1;b<S.length;b++){const A=S[a],B=S[b],e=adjOf(A.b,B.b);if(!e)continue;if(!pub[A.i]||!pub[B.i])continue;
        if(skip&&skip(A.s,B.s))continue;const q=q0?q0(f,A.b,B.b):edgeMid(f,e,loc);if(!q||!keep(q[0],q[1]))continue;if(!(isF&&edgeF.has(f.id))&&!cellNew(q[0],q[1]))continue;
        const sideOf=X=>(e.ax?(X.b[1]+X.b[3])/2:(X.b[0]+X.b[2])/2)>e.v?1:-1;
        if(!A.s.n||!B.s.n){const has=A.s.n?A:B,no=has===A?B:A,sd=sideOf(no);
          let R=runs(f,e,loc);if(!R.length)R=[e.ax?q[0]:q[1]];
          for(const s0 of R){let t=into(e,s0,sd,1.5);if(!(arInRing(f.ring,t[0],t[1])&&(!loc||loc(t[0],t[1])===f.id)))t=into(e,s0,sd,0.3);const m=e.ax?[s0,e.v]:[e.v,s0];
            if(!keep(m[0],m[1]))continue;const lb=near1(has.s.pts,m);put({x:m[0],y:m[1],type:'edge',msg:msgOne(has.s.txt),path:lb?[lb.x,lb.y,t[0],t[1]]:undefined});}
          continue;}
        if(A.s.same(B.s))continue;const m=edgePt(f,e,q),la=near1(A.s.pts,m),lb=near1(B.s.pts,m);
        put({x:m[0],y:m[1],type:'edge',msg:msgDiff(A.s.txt,B.s.txt),path:la&&lb?[la.x,la.y,lb.x,lb.y]:undefined});}};
    // (c) 一般區
    // 房屋裡面的區（只有房屋、樓層、增建註記或沒有註記）交給 (a)(b)；被房屋圍起來的中庭、空地照樣比
    const inHouse=f=>{if(!TH)return false;if(f.all.some(p=>p.k&&p.k!=='H'))return false;const c=arInner(f);return c&&TH.locate(c[0],c[1])>=0;};
    for(const f of F){if(mixF.has(f.id)&&!edgeF.has(f.id))continue;// 已判為相通的先不比，避免連帶誤報
      const rl=b=>f.rl[b]||0;const P=partsOf(f);if(P.length<2)continue;if(inHouse(f))continue;
      if(rl(AR_ROAD)+rl(AR_WALK)>=f.per*0.3&&!f.kinds.size&&!f.add.length)continue;// 道路、人行道本來就免註記
      const sig=b=>{const k=new Set(),pts=[];let n=0;for(const p of f.all){if(!inB(p,b))continue;n++;pts.push(p);k.add(p.k==='H'?'房屋':p.k);}return{n,k,pts,txt:[...k].join('＋'),same(o){return eq(k,o.k);}};};
      cmp(f,P,sig,null,t=>`接邊：圖框切開的區域只有一側有屬性（${t}｜無）`,(a,b)=>`接邊：圖框兩側屬性不同（${a}｜${b}）`,crossPt,true);}
    // (a) 房屋（關掉增建線）：樓層註記
    // 沒有被增建線圍起來的增建註記＝整棟（這一塊）的增建，算房屋屬性一起比（例：上 5R＋M1、下 5R＋T）
    const wholeAdd=p=>{if(!p.add)return false;if(!TA)return true;let k=TA.locate(p.x,p.y);if(k<0&&p.cx!=null)k=TA.locate(p.cx,p.cy);return k<0||!(TA.F[k].rl[AR_ADD]>0);};
    if(TH){const PM=placeIn(TH);
      for(const f of TH.F){const P=partsOf(f);if(P.length<2)continue;const L=(PM.get(f.id)||[]).filter(p=>!p.add||wholeAdd(p));
        const sig=b=>{const k=new Set(),pts=[];let n=0;for(const p of L){if(!inB(p,b))continue;pts.push(p);if(p.add){k.add('增建'+(p.tx||''));continue;}n++;k.add(p.fl||(p.k==='H'?'房屋':p.k));}
          return{n,k,pts,txt:[...k].join('＋'),same(o){return eq(k,o.k);}};};
        cmp(f,P,sig,null,t=>`接邊：房屋跨圖框只有一側有樓層註記（${t}｜無）`,(a,b)=>`接邊：房屋跨圖框兩側樓層或增建不同（${a}｜${b}）`,null,false,TH.locate);}}
    // (b) 增建：邊界有增建線的區，兩側增建註記
    if(TA){const PA2=placeIn(TA);
      for(const f of TA.F){if(!(f.rl[AR_ADD]>0))continue;const P=partsOf(f);if(P.length<2)continue;const L=(PA2.get(f.id)||[]).filter(p=>p.add);if(!L.length)continue;
        const sig=b=>{const k=new Set(),pts=[];let n=0;for(const p of L){if(!inB(p,b))continue;n++;pts.push(p);k.add(p.tx||'增建');}return{n,k,pts,txt:[...k].join('＋'),same(o){return eq(k,o.k);}};};
        cmp(f,P,sig,null,t=>`接邊：增建跨圖框只有一側有增建註記（${t}｜無）`,(a,b)=>`接邊：增建跨圖框兩側增建不同（${a}｜${b}）`,null,false,TA.locate);}}
  }

  /* ---- 5b. 屋線沿著圖框封口（G03）：房屋線有一段貼著圖框線走，對面那幅已出圖、但對面同一段沒有房屋（沒有對應的封口、也沒有屋線碰到這段框線）→ 屋線在圖框處不接 ---- */
  if(FB.length){const AL=[];// 貼框的屋線段：{ax:0 直框/1 橫框, v:框線坐標, s0,s1:沿框範圍, side:房屋在框的哪一側, x,y}
    const TC=[];// 屋線碰到框線的點：{ax,v,s,side}
    for(const L of lines){if(!(L.r&(AR_HOUSE|AR_TEMP)))continue;const p=L.p,n=p.length/2;let lx0=Infinity,ly0=Infinity,lx1=-Infinity,ly1=-Infinity;
      for(let k=0;k<p.length;k+=2){lx0=Math.min(lx0,p[k]);lx1=Math.max(lx1,p[k]);ly0=Math.min(ly0,p[k+1]);ly1=Math.max(ly1,p[k+1]);}
      for(const b of FB){if(lx1<b[0]-0.1||lx0>b[2]+0.1||ly1<b[1]-0.1||ly0>b[3]+0.1)continue;if(lx0>b[0]+0.1&&lx1<b[2]-0.1&&ly0>b[1]+0.1&&ly1<b[3]-0.1)continue;for(const[v,ax]of[[b[0],0],[b[2],0],[b[1],1],[b[3],1]]){const d=k=>ax?p[2*k+1]-v:p[2*k]-v,sAt=k=>ax?p[2*k]:p[2*k+1];
        let side=0;for(let k=0;k<n;k++){const q=d(k);if(Math.abs(q)>0.05){side=q>0?1:-1;break;}}if(!side)continue;
        for(let k=0;k<n;k++)if(Math.abs(d(k))<=0.05){const s0=sAt(k);if(ax?(s0<b[0]-0.1||s0>b[2]+0.1):(s0<b[1]-0.1||s0>b[3]+0.1))continue;TC.push({ax,v,s:s0,side});
          if(k+1<n&&Math.abs(d(k+1))<=0.05){const s1=sAt(k+1);if(Math.abs(s1-s0)>=0.3)AL.push({ax,v,s0:Math.min(s0,s1),s1:Math.max(s0,s1),side,x:ax?(s0+s1)/2:v,y:ax?v:(s0+s1)/2});}}}}}
    const done=[];
    for(const a of AL){const mx=a.x,my=a.y;if(done.some(q=>Math.hypot(q[0]-mx,q[1]-my)<2))continue;
      const A=a.ax?boxAt(mx,a.v-1):boxAt(a.v-1,my),B=a.ax?boxAt(mx,a.v+1):boxAt(a.v+1,my);if(A<0||B<0||A===B||!pub[A]||!pub[B]||!keep(mx,my))continue;
      // 對面有房屋：對面也有貼框段重疊，或對面屋線碰到這段框線
      const opp=AL.some(o=>o.ax===a.ax&&Math.abs(o.v-a.v)<0.05&&o.side!==a.side&&o.s0<a.s1-0.1&&o.s1>a.s0+0.1)||TC.some(t=>t.ax===a.ax&&Math.abs(t.v-a.v)<0.05&&t.side!==a.side&&t.s>a.s0+0.05&&t.s<a.s1-0.05);
      if(opp)continue;done.push([mx,my]);
      put({x:mx,y:my,type:'edge',msg:'接邊：屋線沿著圖框封口（圖框處屋線不接，對面那幅沒有接著畫房屋）'});}}
  /* ---- 6. 接邊：線和圖框的交點逐線比對（E03–E08） ---- */
  if(FB.length){
    // 圖框邊（兩幅共用的只算一次）
    const FE=[],fk=new Set();
    for(let i=0;i<FB.length;i++){const b=FB[i];for(const[v,ax,a0,a1]of[[b[0],0,b[1],b[3]],[b[2],0,b[1],b[3]],[b[1],1,b[0],b[2]],[b[3],1,b[0],b[2]]]){
      const k=ax+':'+Math.round(v*100)+':'+Math.round(a0*100);if(fk.has(k))continue;fk.add(k);
      const mid=(a0+a1)/2,pA=ax?boxAt(mid,v-1):boxAt(v-1,mid),pB=ax?boxAt(mid,v+1):boxAt(v+1,mid);if(pA<0||pB<0||!pub[pA]||!pub[pB])continue;FE.push({ax,v,a0,a1});}}
    const band=1.5,over=opt.over,posTol=opt.posTol,found=[];
    const nmOf=L=>L.r&AR_ADD?'增建線':areaSyn(L.nm||'');
    for(const fe of FE){const ends=[[],[]],thru=[];// ends[0]：從負側來、停在框邊的線端；ends[1]：正側
      const U=(x,y)=>fe.ax?[x,y-fe.v]:[y,x-fe.v];// [沿框位置, 到框距離]
      lines.forEach((L,li)=>{if(L.r&AR_GATE)return;const p=L.p,n=p.length/2;if(n<2)return;
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
          if(keep(q[0],q[1]))mk(q[0],q[1],`接邊：圖框兩側線的種類不同（${na}｜${nb}）`,[a.x,a.y,q[0],q[1],b.x,b.y]);continue;}
        // 舊圖在框邊裁切的線兩側應該剛好接在同一點，錯開 5cm 以上就報（例：上幅屋線 816.99、下幅 816.70）
        if(ds>0.05){const q=P2(a.s);if(keep(q[0],q[1])&&cellNew(q[0],q[1]))mk(q[0],q[1],`接邊：${na||nb||'範圍線'}在圖框處兩側錯開 ${ds.toFixed(2)}m`,[a.x,a.y,b.x,b.y]);}}
      for(const side of[0,1])for(const a of ends[side]){if(used[side].has(a))continue;
        // 對面有線剛好在這個位置（不是停在框邊而是轉彎或本來就穿過）就不算中斷
        const q=P2(a.s);if(!keep(q[0],q[1])||!cellNew(q[0],q[1]))continue;
        if(thru.some(t=>Math.abs(t.s-a.s)<=posTol&&t.li!==a.li))continue;
        let near=false;for(const L of lines){if(L===a.L||(L.r&AR_GATE)||!(L.r&AR_ADD)!==!(a.L.r&AR_ADD))continue;const p=L.p;for(let i=2;i<p.length&&!near;i+=2){const[s0,d0]=U(p[i-2],p[i-1]),[s1,d1]=U(p[i],p[i+1]);
          // 對面那一側、框邊 posTol 內有其他線的端點或線段經過
          const sgn=side?-1:1;for(const[s,d]of[[s0,d0],[s1,d1]])if(Math.abs(s-a.s)<=posTol&&d*sgn>=-over&&d*sgn<=band)near=true;}if(near)break;}
        if(near)continue;
        mk(q[0],q[1],`接邊：${nmOf(a.L)||'範圍線'}碰到圖框，對面沒有接著畫（中斷）`,[a.x,a.y,q[0],q[1]]);}
    }
  }
  if(opt.frameCutAt&&opt.frameCutAt.length){const C=opt.frameCutAt,near=(x,y)=>{for(let i=0;i<C.length;i+=2)if(Math.hypot(C[i]-x,C[i+1]-y)<0.3)return true;return false;};
    for(const m of marks){if(!['open','openadd'].includes(m.type)||!near(m.x,m.y))continue;cnt[m.type]--;
      m.msg='接邊：屋線在圖框處對不起來（舊圖沿框封口拿掉後，兩側屋線沒有在同一位置相接）';m.type='edge';cnt.edge=(cnt.edge||0)+1;}}
  {// 缺口兩端都貼著圖框線（0.3m 內）：其實是圖框處線不接 → 歸接邊
    const onF=(x,y)=>nearFrame(x,y,0.3);
    for(const m of marks){if(!m.gap||m.type==='edge')continue;let all=true;for(let i=0;i<m.gap.length;i+=4)if(!(onF(m.gap[i],m.gap[i+1])&&onF(m.gap[i+2],m.gap[i+3])))all=false;
      if(all){cnt[m.type]--;m.type='edge';m.msg='接邊：圖框處'+(m.msg.startsWith('房屋')?'屋線':'範圍線')+'不接（'+m.msg+'）';cnt.edge=(cnt.edge||0)+1;}}}
  for(const{c,f}of noFl){if(marks.some(m=>m.type==='empty'&&m.x>=f.bb[0]&&m.x<=f.bb[2]&&m.y>=f.bb[1]&&m.y<=f.bb[3]&&arInRing(f.ring,m.x,m.y)))continue;
    put({x:c[0],y:c[1],type:'nofloor',msg:`房屋線圍出的範圍沒有房屋（樓層）註記（${f.area<10?f.area.toFixed(1):Math.round(f.area)} m²）`,ring:f.ring});}
  for(const v of vegBad){const a=v.p,m=Math.floor(a.length/4)*2;put({x:a[m],y:a[m+1],type:'veg',msg:`範圍線用錯圖層：畫在${v.nm}（植被圖層），應改成地類界等範圍類圖層`});}
  {// 同一處（1m 內）有好幾種問題：接邊最優先，房屋優先於植被／道路類
    const rank=t=>t==='edge'?0:['open','floor','floorout','openadd','flooradd','addside','addline','addout'].includes(t)?1:2;
    const keepM=[];const sorted=marks.slice().sort((a,b)=>rank(a.type)-rank(b.type));
    for(const m of sorted){if(keepM.some(k=>(rank(k.type)<rank(m.type)&&Math.hypot(k.x-m.x,k.y-m.y)<1)||(k.type==='edge'&&m.type==='edge'&&Math.hypot(k.x-m.x,k.y-m.y)<0.5))){cnt[m.type]--;continue;}keepM.push(m);}// 同一點的接邊只留一筆
    marks.length=0;marks.push(...keepM);}
  {/* 只看新圖相關：每個標記到最近「新圖」（數字開頭圖層）線或註記的距離 m.nd（公尺，最多算到 ND_MAX；0＝問題本身就用到新圖）
      量的是標記本身的範圍：有區域就用區域外框（新圖在區裡也算 0），有缺口用缺口線段，其他用標記點 */
    const ND_MAX=100,NS=20,NG=new Map(),NSeg=[];
    const addG=(k,x0,y0,x1,y1)=>{for(let i=Math.floor(Math.min(x0,x1)/NS);i<=Math.floor(Math.max(x0,x1)/NS);i++)for(let j=Math.floor(Math.min(y0,y1)/NS);j<=Math.floor(Math.max(y0,y1)/NS);j++){const q=i*1e7+j;let l=NG.get(q);if(!l)NG.set(q,l=[]);l.push(k);}};
    for(const L of lines){if(!L.nw)continue;const p=L.p;for(let i=2;i<p.length;i+=2){if(!isFinite(p[i])||!isFinite(p[i-2]))continue;
      if(Math.abs(p[i]-p[i-2])+Math.abs(p[i+1]-p[i-1])>NS*50)continue;NSeg.push([p[i-2],p[i-1],p[i],p[i+1]]);addG(NSeg.length-1,p[i-2],p[i-1],p[i],p[i+1]);}}
    for(const q of points){if(!q.nw)continue;NSeg.push([q.x,q.y,q.x,q.y]);addG(NSeg.length-1,q.x,q.y,q.x,q.y);}
    const pd=(x,y,s)=>{const[ax,ay,bx,by]=s,dx=bx-ax,dy=by-ay,l2=dx*dx+dy*dy;let t=l2?((x-ax)*dx+(y-ay)*dy)/l2:0;t=t<0?0:t>1?1:t;return Math.hypot(ax+dx*t-x,ay+dy*t-y);};
    const xing=(a,b)=>{const r=(p,q,o)=>(q[0]-p[0])*(o[1]-p[1])-(q[1]-p[1])*(o[0]-p[0]);const A=[a[0],a[1]],B=[a[2],a[3]],C=[b[0],b[1]],D=[b[2],b[3]];
      return r(A,B,C)*r(A,B,D)<0&&r(C,D,A)*r(C,D,B)<0;};
    const ssd=(a,b)=>xing(a,b)?0:Math.min(pd(a[0],a[1],b),pd(a[2],a[3],b),pd(b[0],b[1],a),pd(b[2],b[3],a));
    if(NSeg.length)for(const m of marks){
      let geo;if(m.ring&&m.ring.length>=6){geo=[];const r=m.ring;for(let i=0;i<r.length;i+=2){const j=(i+2)%r.length;geo.push([r[i],r[i+1],r[j],r[j+1]]);}}
      else if(m.gap&&m.gap.length>=4)geo=[[m.gap[0],m.gap[1],m.gap[2],m.gap[3]]];else geo=[[m.x,m.y,m.x,m.y]];
      let a=Infinity,b=Infinity,c=-Infinity,d=-Infinity;for(const g of geo){a=Math.min(a,g[0],g[2]);c=Math.max(c,g[0],g[2]);b=Math.min(b,g[1],g[3]);d=Math.max(d,g[1],g[3]);}
      let best=ND_MAX;const seen=new Set();
      for(let i=Math.floor((a-ND_MAX)/NS);i<=Math.floor((c+ND_MAX)/NS);i++)for(let j=Math.floor((b-ND_MAX)/NS);j<=Math.floor((d+ND_MAX)/NS);j++){const l=NG.get(i*1e7+j);if(!l)continue;
        for(const k of l){if(seen.has(k))continue;seen.add(k);const sg=NSeg[k];if(Math.min(sg[0],sg[2])>c+best||Math.max(sg[0],sg[2])<a-best||Math.min(sg[1],sg[3])>d+best||Math.max(sg[1],sg[3])<b-best)continue;
          if(m.ring&&geo.length>2&&arInRing(m.ring,sg[0],sg[1])){best=0;break;}
          for(const g of geo){const v=ssd(g,sg);if(v<best)best=v;}if(!best)break;}if(!best)break;}
      m.nd=best;}
    else for(const m of marks)m.nd=ND_MAX;}
  if(opt.debug)opt.debug.dbg={G,F,GH,TH};
  if(opt.keepTopo)opt.keepTopo.T={F,locate};// 填色用：留下分好的區
  return{marks,st:Object.assign(cnt,{seg:G.ns,node:NN,graphEdges:NE,face:F.length,pts:points.length,inside,frames:FB.length,pub:pub.filter(Boolean).length,ms:Date.now()-t0})};
}
if(typeof module!=='undefined')module.exports={areaRole,areaCheck,areaKindName,areaSyn,AR_HOUSE,AR_ADD,AR_WALK,AR_ROAD,AR_WATER,AR_OTHER,AR_TEMP,AR_FRAME,AR_FREE};
