import type { OnlineStore, StoredRow } from './types.ts';
export class MemoryOnlineStore implements OnlineStore {
  private rows=new Map<string,StoredRow>();
  async get(id:string){return structuredClone(this.rows.get(id)||null);}
  async find(lookup:string){return structuredClone([...this.rows.values()].find(row=>row.lookup===lookup)||null);}
  async insert(row:StoredRow){if(this.rows.has(row.id)||[...this.rows.values()].some(r=>r.lookup===row.lookup))return false;this.rows.set(row.id,structuredClone(row));return true;}
  async cas(row:StoredRow,expected:number){const previous=this.rows.get(row.id);if(!previous||previous.version!==expected)return false;this.rows.set(row.id,structuredClone(row));return true;}
  async list(actor:string){return structuredClone([...this.rows.values()].filter(row=>Array.isArray(row.data.members)&&(row.data.members as {id:string}[]).some(m=>m.id===actor)));}
  async remove(id:string){this.rows.delete(id);}
  async cleanup(now:string){for(const row of this.rows.values())if(row.expiresAt<now)this.rows.delete(row.id);}
}
interface RestRow {id:string;bucket:StoredRow['bucket'];lookup:string;data:StoredRow['data'];version:number;expires_at:string}
const fromRest=(r:RestRow):StoredRow=>({id:r.id,bucket:r.bucket,lookup:r.lookup,data:r.data,version:r.version,expiresAt:r.expires_at});
const toRest=(r:StoredRow):RestRow=>({id:r.id,bucket:r.bucket,lookup:r.lookup,data:r.data,version:r.version,expires_at:r.expiresAt});
export class RestOnlineStore implements OnlineStore {
  private url:string;private secret:string;private request:typeof fetch;
  constructor(url:string,secret:string,request:typeof fetch=fetch){this.url=url;this.secret=secret;this.request=request;}
  private async call(query:string,method='GET',body?:unknown):Promise<RestRow[]>{
    const headers:Record<string,string>={apikey:this.secret,'Content-Type':'application/json',Prefer:'return=representation'};
    if(this.secret.startsWith('eyJ'))headers.Authorization=`Bearer ${this.secret}`;
    const response=await this.request(`${this.url}/rest/v1/bs_online?${query}`,{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(10000)});
    if(response.status===409&&method==='POST')return [];
    if(!response.ok)throw new Error('Online storage unavailable.');
    const source=await response.text();return source?JSON.parse(source):[];
  }
  async get(id:string){const rows=await this.call(`id=eq.${encodeURIComponent(id)}&limit=1`);return rows[0]?fromRest(rows[0]):null;}
  async find(lookup:string){const rows=await this.call(`lookup=eq.${encodeURIComponent(lookup)}&limit=1`);return rows[0]?fromRest(rows[0]):null;}
  async insert(row:StoredRow){return (await this.call('','POST',toRest(row))).length===1;}
  async cas(row:StoredRow,expected:number){return (await this.call(`id=eq.${encodeURIComponent(row.id)}&version=eq.${expected}`,'PATCH',{data:row.data,version:row.version,expires_at:row.expiresAt})).length===1;}
  async list(actor:string){return (await this.call(`bucket=in.(room,clan,tournament)&data->members=cs.${encodeURIComponent(JSON.stringify([{id:actor}]))}&order=created_at.desc&limit=12`)).map(fromRest);}
  async remove(id:string){await this.call(`id=eq.${encodeURIComponent(id)}`,'DELETE');}
  async cleanup(now:string){await this.call(`expires_at=lt.${encodeURIComponent(now)}`,'DELETE');}
}
