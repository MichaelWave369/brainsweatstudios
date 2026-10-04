import type { WorldController } from '../worlds/receipts.ts';
export const FAMILY_IDS = ['auto-circuit', 'stunt-show', 'cache-quest', 'web-scout', 'stream-studio', 'ensemble-lab'] as const;
export type FamilyId = typeof FAMILY_IDS[number];
export const FAMILY_TITLES: Record<FamilyId, string> = { 'auto-circuit': 'Agent Auto Circuit', 'stunt-show': 'Stunt Show Lab', 'cache-quest': 'Cache Quest', 'web-scout': 'Web Scout', 'stream-studio': 'Stream Studio', 'ensemble-lab': 'Ensemble Lab' };
export interface VehicleSpec { schema: 'vehicle-spec@1'; id: string; mass: number; power: number; capacity: number; grip: number; braking: number; cooling: number; reliability: number; aero: number; setup: { wing: number; gearing: number } }
export interface TrackSpec { schema: 'track-spec@1'; id: string; segments: { length: number; curvature: number; surface: 'smooth' | 'rough'; elevation: number; risk: number; sector: number; pit: boolean }[]; weather: 'dry' | 'rain' }
export interface TrackNotes { schema: 'track-notes@1'; trackHash: string; sectors: { sector: number; ticks: number }[]; incidents: number; pits: number }
export interface PerformancePlan { schema: 'performance-plan@1'; participants: string[]; sequence: { at: number; action: string; music: string; camera: string }[]; fallbacks: string[] }
export interface CacheRoute { schema: 'cache-route@1'; mapHash: string; visited: { x: number; y: number }[]; discoveries: number; returned: boolean }
export interface ResearchDossier { schema: 'research-dossier@1'; finding: string; sources: { url: string; tick: number; contentHash: string; excerpt: string }[]; compared: boolean }
export interface ShowRundown { schema: 'show-rundown@1'; title: string; segments: { title: string; caption: string; camera: string; audio: string; graphic: string; sourceHashes: string[] }[] }
export interface InstrumentSpec { id: string; kind: 'keys' | 'bass' | 'drum' | 'pad' | 'voice'; range: [number, number] }
export interface VoicePartSpec { id: string; range: [number, number]; syllables: string[] }
export interface TempoMap { beat: number; bpm: number }
export interface CueSpec { beat: number; part: string; type: 'entry' | 'cutoff' | 'dynamics'; level: number }
export interface ScoreSpec { schema: 'score-spec@1'; title: string; bars: number; meter: number; key: number; tempo: TempoMap[]; chords: { beat: number; root: number; quality: 'major' | 'minor' }[]; cues: CueSpec[]; parts: { id: string; instrument: InstrumentSpec; voice: VoicePartSpec | null; notes: { beat: number; duration: number; pitch: number; velocity: number; syllable: string }[] }[] }
export interface PerformanceEvent { beat: number; timeMs: number; role: string; kind: 'note' | 'rest' | 'entry' | 'cutoff' | 'dynamics'; pitch: number; duration: number; velocity: number; syllable: string }
export type FamilyArtifactType = 'vehicle-setup' | 'track-notes' | 'performance-plan' | 'cache-route' | 'research-dossier' | 'show-rundown' | 'music-score';
export type FamilyContent = VehicleSpec | TrackNotes | PerformancePlan | CacheRoute | ResearchDossier | ShowRundown | ScoreSpec;
export interface FamilyArtifactInput { type: FamilyArtifactType; contentHash: string; content: FamilyContent }
export interface FamilyPublicInput { snapshotHash: string; notes: string[]; artifacts: FamilyArtifactInput[] }
export interface FamilyConfig { schema: 'family-config@1'; family: FamilyId; seed: number; maxTicks: number; race: { mode: 'solo' | 'head-to-head' | 'multi-car' | 'endurance'; laps: number; vehicles: VehicleSpec[]; track: TrackSpec } | null; score: ScoreSpec | null }
export interface FamilyObservation { family: FamilyId; role: string; tick: number; state: Record<string, unknown>; legal: string[]; input: FamilyPublicInput }
export interface FamilyResult { terminal: boolean; success: boolean; ticks: number; reason: 'running' | 'complete' | 'budget'; measures: Record<string, number>; public: Record<string, unknown> }
export interface FamilyOutput { actor: string; type: FamilyArtifactType; content: FamilyContent; contentHash: string }
export interface FamilyMachine { roles: string[]; observe(role: string): Record<string, unknown>; legal(role: string): string[]; advance(intents: Record<string, string>): string[]; result(): Omit<FamilyResult, 'ticks' | 'reason'>; stateHash(): string; outputs(actor: string): FamilyOutput[] }
export interface FamilyDecision { source: 'baseline' | 'human' | 'model'; requestHash: string | null; response: string | null }
export interface FamilyFrame { tick: number; intents: Record<string, string>; observations: Record<string, string>; decisions: Record<string, FamilyDecision>; events: string[]; stateHash: string }
export interface FamilyReceipt { schema: 'family-episode@1'; config: FamilyConfig; initialControllers: Record<string, WorldController>; inputs: Record<string, FamilyPublicInput>; records: FamilyFrame[]; result: FamilyResult; outputs: FamilyOutput[]; ending: 'STOPPED' | 'COMPLETE' | 'ERROR'; digest: string }
