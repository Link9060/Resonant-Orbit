'use client';
import { useEffect, useRef, useState } from 'react';
type Pin = { number:number; title:string; href:string; anchor:number[] };
type Next = {title:string;date?:string;time?:string;reason:string;href:string};
type API = {data:(path:string,options?:{method?:string;body?:unknown})=>Promise<unknown>;nextMove:()=>Promise<{next:Next|null;source:string}>;openPanel:(name:string,module?:string)=>void};
const anchors = [[-.9,.12,.46],[.12,.96,.35],[.85,-.2,-.48],[-.12,-.95,-.28],[.16,.14,-.98]];
function navigate(href:string){const os=(window as Window & {ArrowOS?:{navigate?:(href:string,module?:string)=>void}}).ArrowOS;if(os?.navigate)os.navigate(href,'orbit');else location.assign(href);}
function api() { return (window as Window & {ArrowOS?:API}).ArrowOS; }
export function OrbitLocations({hidden=false}:{hidden?:boolean}) {
  const [pins,setPins]=useState<Pin[]>([]); const [targets,setTargets]=useState<{id:string;title:string;href:string}[]>([]); const [editing,setEditing]=useState(false);
  const [title,setTitle]=useState(''); const [href,setHref]=useState('/waypoint/?tab=today');
  const [next,setNext]=useState<Next|null>(null); const [source,setSource]=useState('loading'); const [notice,setNotice]=useState('');
  const [ready,setReady]=useState(false); const [busy,setBusy]=useState(false); const timer=useRef<ReturnType<typeof setTimeout>|null>(null);
  useEffect(()=>{
    let cancelled=false;
    let refreshing=false;
    const refreshTargets=async()=>{
      if(!api()||refreshing)return;
      refreshing=true;
      try{
        const [tasks,plans]=await Promise.all([api()!.data('/rest/v1/todos?completed=eq.false&select=id,title&order=due_on.asc.nullslast&limit=80'),api()!.data('/rest/v1/waypoint_items?status=eq.active&select=id,title,source_key&limit=60')]) as [{id:string;title:string}[],{id:string;title:string;source_key:string}[]];
        if(!cancelled)setTargets([...tasks.map(t=>({id:t.id,title:t.title,href:'/waypoint/?tab=today&item='+encodeURIComponent(t.id)})),...plans.map(p=>({id:p.id,title:p.title,href:'/waypoint/?tab=plans&item='+encodeURIComponent(p.source_key||p.id)}))]);
      }finally{refreshing=false;}
    };
    const init=async()=> {
      if (!api()) { timer.current=setTimeout(init,250); return; }
      try {
        const user=await api()!.data('/auth/v1/user') as {user_metadata?:{arrow_orbit_locations?:Pin[]}};
        const saved=user.user_metadata?.arrow_orbit_locations;
        if (!cancelled && Array.isArray(saved)) setPins(saved.filter(p=>p && p.number>=5&&p.number<=9&&typeof p.title==='string'&&safeHref(p.href)).slice(0,5).map((p,i)=>({...p,number:5+i,anchor:anchors[i]})));
        if (!cancelled) setReady(true);
        await refreshTargets();
      } catch { if(!cancelled) setNotice('Your quick locations could not load. Refresh to retry.'); }
      if (!cancelled) await refreshNext();
    };
    void init();
    const interval=setInterval(()=>void refreshNext(),60000);
    const update=()=>{void refreshNext();void refreshTargets().catch(()=>setNotice('Your shortcut choices could not refresh. Try again.'));}; window.addEventListener('arrow:planning-changed',update);
    window.addEventListener('focus',update);
    return ()=>{cancelled=true;if(timer.current)clearTimeout(timer.current);clearInterval(interval);window.removeEventListener('arrow:planning-changed',update);window.removeEventListener('focus',update);};
  },[]);
  async function refreshNext() {
    if(!api())return;
    try { const result=await api()!.nextMove();setNext(result.next);setSource(result.source); }
    catch { setSource('unavailable'); }
  }
  useEffect(()=>{
    const handler=(event:KeyboardEvent)=>{
      if(event.defaultPrevented||hidden||editing||event.metaKey||event.ctrlKey||event.altKey||event.target instanceof HTMLElement&&event.target.closest('input,textarea,select,[contenteditable="true"]'))return;
      if(event.key==='0'){event.preventDefault();navigate(next?.href||'/waypoint/?tab=today');}
      const pin=pins.find(p=>String(p.number)===event.key);if(pin){event.preventDefault();navigate(pin.href);}
    }; window.addEventListener('keydown',handler);return()=>window.removeEventListener('keydown',handler);
  },[pins,next,hidden,editing]);
  async function save(value:Pin[]) {
    setBusy(true);setNotice('');
    try { await api()!.data('/auth/v1/user',{method:'PUT',body:{data:{arrow_orbit_locations:value}}});setPins(value);setEditing(false);setTitle('');setNotice('Quick locations saved to your account.'); }
    catch {setNotice('Locations were not saved. Please retry.');}
    finally{setBusy(false);}
  }
  if(hidden)return null;
  return <>
    <button className="orbit-extra-location orbit-smart-location" data-orbit-extra data-anchor=".04,.65,-.74" type="button" onClick={()=>navigate(next?.href||'/waypoint/?tab=today')} title={next?`${next.title} · ${next.date||'No date'} ${next.time||''} · ${next.reason}`:'Open your next move in Waypoint'}>
      <kbd>0</kbd><span><strong>What’s next</strong><small>{next?next.title:source==='loading'?'Checking your plans…':source==='unavailable'?'Open Waypoint':'You’re clear'}{next?.date?` · ${next.date}`:''}{next?.time?` ${next.time}`:''}</small></span>
    </button>
    {pins.map(pin=><button key={pin.number} className="orbit-extra-location" data-orbit-extra data-anchor={pin.anchor.join(',')} type="button" onClick={()=>navigate(pin.href)} title={pin.title}><kbd>{pin.number}</kbd><span><strong>{pin.title}</strong><small>Quick location</small></span></button>)}
    <div className="orbit-location-tools"><button type="button" onClick={()=>setEditing(!editing)}>Quick locations · {pins.length}/5</button>{notice&&<p role="status">{notice}</p>}</div>
    {editing&&<section className="orbit-location-editor" aria-label="Manage Orbit quick locations">
      <header><h2>Quick locations</h2><button type="button" onClick={()=>setEditing(false)} aria-label="Close quick locations">×</button></header>
      <p>Keys 5–9 open your shortcuts. Key 0 opens your next move.</p>
      {pins.map(pin=><div className="orbit-pin-row" key={pin.number}><kbd>{pin.number}</kbd><span>{pin.title}</span><button disabled={busy} type="button" onClick={()=>void save(pins.filter(p=>p.number!==pin.number).map((p,i)=>({...p,number:i+5,anchor:anchors[i]})))}>Remove</button></div>)}
      {pins.length<5&&<form onSubmit={event=>{event.preventDefault();const safe=safeHref(href);if(!safe||!title.trim()){setNotice('Name this location and choose an ARROW destination.');return;}void save([...pins,{number:5+pins.length,title:title.trim().slice(0,60),href:safe,anchor:anchors[pins.length]}]);}}>
        <label>Name<input required maxLength={60} value={title} onChange={e=>setTitle(e.target.value)} placeholder="Homework, next ride, project…"/></label>
        <label>Destination<select value={href} onChange={e=>{setHref(e.target.value);const target=targets.find(t=>t.href===e.target.value);if(target)setTitle(target.title);}}><option value="/waypoint/?tab=today">Tasks</option><option value="/waypoint/?tab=plans">Plans</option><option value="/waypoint/?tab=calendar">Calendar</option><option value="/waypoint/?tab=direction">Goals</option><option value="/atlas/">Atlas</option><option value="/ravin/">RAVIN</option><option value="/relay/">Relay</option>{targets.map(target=><option key={target.id} value={target.href}>{target.title}</option>)}</select></label>
        <button type="submit" disabled={busy||!ready}>{busy?'Saving…':'Add location'}</button>
      </form>}
    </section>}
  </>;
}
function safeHref(value:string) {try{const u=new URL(value,location.origin);return u.origin===location.origin&&/^\/(waypoint|atlas|ravin|relay)\//.test(u.pathname)?u.pathname+u.search+u.hash:null;}catch{return null;}}
