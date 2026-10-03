import type { OnlineSession, OnlineView } from './types';
export interface OnlineConfig {endpoint:string;publishableKey:string;}
export const ONLINE_KEY='brain-sweat-studio:online:';
export async function loadOnlineConfig():Promise<OnlineConfig>{
  const response=await fetch(`${import.meta.env.BASE_URL}online-service.json`,{cache:'no-store',signal:AbortSignal.timeout(7000)});
  if(!response.ok)throw new Error('Online service configuration is unavailable.');
  const config=await response.json() as OnlineConfig;
  if(!config.endpoint)throw new Error('Online service setup is pending. The offline games and classes are ready.');
  const url=new URL(config.endpoint),local=['localhost','127.0.0.1'].includes(window.location.hostname)&&['localhost','127.0.0.1'].includes(url.hostname);
  if(url.protocol!=='https:'&&!local)throw new Error('Online service needs a secure connection.');
  return config;
}
export function deviceToken(profile:string){
  const key=ONLINE_KEY+profile;let token=localStorage.getItem(key);
  if(!token||!/^[A-Za-z0-9_-]{43}$/.test(token)){token=btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');localStorage.setItem(key,token);}
  return token;
}
export function clearDeviceToken(profile:string){localStorage.removeItem(ONLINE_KEY+profile);}
export async function onlineRequest(config:OnlineConfig,token:string,body:Record<string,unknown>,signal?:AbortSignal):Promise<OnlineSession|{entity:OnlineView;session:OnlineSession}|{deleted:true}>{
  const headers:Record<string,string>={'Content-Type':'application/json',Authorization:`Bearer ${token}`};if(config.publishableKey)headers.apikey=config.publishableKey;
  const deadline=AbortSignal.timeout(12000),requestSignal=signal?AbortSignal.any([signal,deadline]):deadline;
  const response=await fetch(config.endpoint,{method:'POST',headers,body:JSON.stringify(body),signal:requestSignal,cache:'no-store'});
  const data=await response.json();if(!response.ok)throw new Error(data.error||'Online service unavailable. Try again.');return data;
}
export function competitionStandings(view:OnlineView){
  const rows=view.members.map(member=>{const result=view.results[member.id];let points=0,wins=0;
    if(view.status==='complete'&&result)for(let round=0;round<view.seeds.length;round++){
      const ranked=view.members.map(m=>({id:m.id,...view.results[m.id].rounds[round]})).sort((a,b)=>b.score-a.score||a.ticks-b.ticks);
      const best=ranked[0],winners=ranked.filter(r=>r.score===best.score&&r.ticks===best.ticks);
      if(winners.some(r=>r.id===member.id)){points+=winners.length===1?3:1;if(winners.length===1)wins++;}
    }
    return {...member,total:result?.total||0,ticks:result?.rounds.reduce((sum,r)=>sum+r.ticks,0)||0,points,wins,rounds:result?.rounds||[]};
  });
  return rows.sort((a,b)=>b.points-a.points||b.total-a.total||a.ticks-b.ticks||a.name.localeCompare(b.name));
}
