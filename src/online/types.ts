import type { ArenaKind, PolicyRule } from '../runtime/arenaRules.ts';
export type EntityType='room'|'clan'|'tournament';
export type TeamSignal='ready'|'help'|'good-round';
export interface OnlineMember { id:string;name:string;ready:boolean; }
export interface Evaluation { rules:PolicyRule[];rounds:{seed:number;score:number;ticks:number;complete:boolean;environmentVersion?:string;receiptHash?:string;finalHash?:string}[];total:number; }
export interface DispatchLog { actor:string;name:string;task:number;action:string;accepted:boolean; }
export interface EntityData {
  owner:string;name:string;code:string;members:OnlineMember[];status:'lobby'|'active'|'complete'|'closed';
  arena:ArenaKind;mode:'dispatch'|'duel';seeds:number[];submissions:Record<string,Evaluation>;
  task:number;phase:number;turn:number;risks:number;log:DispatchLog[];signals:{actor:string;signal:TeamSignal}[];clan:string;
}
export interface OnlineView extends Omit<EntityData,'submissions'> {
  id:string;type:EntityType;version:number;expiresAt:string;submitted:string[];results:Record<string,Omit<Evaluation,'rules'>>;
}
export interface OnlineSession { actor:{id:string;name:string};entities:OnlineView[]; }
export interface StoredRow { id:string;bucket:EntityType|'device'|'rate';lookup:string;data:Record<string,unknown>;version:number;expiresAt:string; }
export interface OnlineStore {
  get(id:string):Promise<StoredRow|null>;find(lookup:string):Promise<StoredRow|null>;
  insert(row:StoredRow):Promise<boolean>;cas(row:StoredRow,expected:number):Promise<boolean>;
  list(actor:string):Promise<StoredRow[]>;remove(id:string):Promise<void>;cleanup(now:string):Promise<void>;
}
