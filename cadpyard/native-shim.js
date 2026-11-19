// Cadpyard：把原生 App 的功能包成 Cadpy 原本用的 Capacitor 外掛介面
(function(){
  if(!window.CadNative)return;
  const cbs=new Map();let seq=0;
  window.__cadCb=(id,ok,data)=>{const c=cbs.get(id);if(!c)return;cbs.delete(id);
    if(ok)c.res(data);else c.rej(new Error(typeof data==='string'?data:((data&&data.message)||'error')));};
  const call=(p,m,o)=>new Promise((res,rej)=>{const id=++seq;cbs.set(id,{res,rej});CadNative.call(p,m,JSON.stringify(o||{}),id);});
  const plug=n=>new Proxy({},{get:(_,m)=>(typeof m==='string'&&m!=='then')?(o=>call(n,m,o)):undefined});
  window.Capacitor={isNativePlatform:()=>true,Plugins:{SupportFolder:plug('SupportFolder'),Filesystem:plug('Filesystem'),Share:plug('Share')}};
  window.CadCall=call;
  const st=document.createElement('style');st.textContent='html,body{background:transparent!important}';document.head.appendChild(st);
})();
