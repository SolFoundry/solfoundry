/** Real-time PR status hook with WebSocket support. @module usePRStatus */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { PRStatus, PRStatusEvent } from '../types/prStatus';
import { mockPRStatuses } from '../data/mockPRStatus';
/** Fetches and subscribes to PR status. */
export function usePRStatus({prStatusId,wsUrl,realtime=true,reconnectInterval=5000}:
  {prStatusId?:string;wsUrl?:string;realtime?:boolean;reconnectInterval?:number}={}) {
  const [prStatus,set]=useState<PRStatus|null>(null);
  const [isLoading,setL]=useState(true), [error,setE]=useState<string|null>(null);
  const [isConnected,setC]=useState(false), [lastEvent,setEv]=useState<PRStatusEvent|null>(null);
  const ws=useRef<WebSocket|null>(null);
  const load=useCallback(()=>{setL(true);setE(null);
    const f=prStatusId?mockPRStatuses.find(s=>s.id===prStatusId)??null:mockPRStatuses[0]??null;
    set(f);if(!f&&prStatusId)setE('Not found');setL(false);},[prStatusId]);
  const apply=useCallback((ev:PRStatusEvent)=>{setEv(ev);set(p=>p?{...p,...ev.data}:p);},[]);
  useEffect(()=>{load();},[load]);
  useEffect(()=>{if(!realtime||!wsUrl||!prStatusId)return;let t:ReturnType<typeof setTimeout>;
    const go=()=>{const w=new WebSocket(`${wsUrl}/pr-status/${prStatusId}`);ws.current=w;
      w.onopen=()=>setC(true);w.onclose=()=>{setC(false);t=setTimeout(go,reconnectInterval);};
      w.onerror=()=>w.close();w.onmessage=e=>{try{apply(JSON.parse(e.data));}catch{/**/}};};
    go();return()=>{clearTimeout(t);ws.current?.close();};},[wsUrl,prStatusId,realtime,reconnectInterval,apply]);
  return {prStatus,isLoading,error,isConnected,refresh:load,lastEvent};
}
