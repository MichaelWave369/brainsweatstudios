import type { AgentPassport, Partition } from '../career/types.ts';
import type { FamilyArtifactType, FamilyConfig, FamilyContent, FamilyId, FamilyReceipt } from '../families/types.ts';
import type { WorldController, WorldPlan, WorldReceipt } from '../worlds/receipts.ts';
import type { WorldPack } from '../worlds/types.ts';

export const CIRCUIT_LIMITS = { bytes: 6000000, agents: 8, teams: 4, seasons: 3, rounds: 12, events: 36, parts: 16, notes: 24, grants: 24, operators: 4, batchBytes: 16000000, batchTrials: 36 } as const;
export const CIRCUIT_FAMILIES = ['auto-circuit', 'cache-quest', 'town-zero', 'web-scout', 'stunt-show', 'ensemble-lab', 'stream-studio'] as const;
export type CircuitFamily = typeof CIRCUIT_FAMILIES[number];
export const CIRCUIT_METRICS = ['racing', 'navigation', 'resources', 'coordination', 'research', 'creative', 'recovery'] as const;
export type CircuitMetric = typeof CIRCUIT_METRICS[number];
export type CircuitMeasures = Record<CircuitMetric, number | null>;
export const CIRCUIT_FORMATS = ['race-league', 'cache-rally', 'town-relay', 'research', 'stunt-festival', 'original-performance', 'local-show'] as const;
export type CircuitFormat = typeof CIRCUIT_FORMATS[number];
export interface CircuitTeam {
    schema: 'circuit-team@1'; id: string; title: string; members: string[];
    preferences: Record<string, string[]>;
}
export interface SeasonRound {
    id: string; title: string; family: CircuitFamily; format: CircuitFormat;
    seeds: Record<Partition, number[]>;
    controllerRules: ('baseline' | 'mock' | 'human' | 'local')[];
    memory: 'FRESH' | 'TEAM_PUBLIC'; artifacts: 'NONE' | 'TEAM' | 'SHARED';
    teamPolicy: 'SOLO' | 'COOPERATIVE' | 'RELAY'; metrics: CircuitMetric[];
    config: FamilyConfig | null; townDays: 7 | 30 | null;
    stages: number; shiftTicks: number;
}
export interface SeasonSpec {
    schema: 'season-spec@1'; id: string; title: string; mode: 'CAREER' | 'GAUNTLET';
    teamIds: string[]; rounds: SeasonRound[];
}
export interface CircuitSeason {
    schema: 'circuit-season@1'; spec: SeasonSpec; agents: AgentPassport[]; teams: CircuitTeam[]; digest: string;
}
export interface CircuitBinding { teamId: string; agentId: string }
export interface CircuitShift { index: number; tick: number; role: string; agentId: string; controller: WorldController }
export type CircuitAssetType = FamilyArtifactType | 'world-plan' | 'world-pack';
export interface CircuitAsset {
    schema: 'circuit-asset@1'; id: string; teamId: string; creator: string;
    type: CircuitAssetType; content: FamilyContent | WorldPlan | WorldPack; contentHash: string;
    origin: 'NATIVE' | 'OPERATOR'; sourceEvent: string | null; sourcePart: string | null;
    sourceDigest: string | null; partition: Partition;
}
export interface CircuitNote {
    id: string; teamId: string; scope: 'TEAM' | 'WORLD'; family: CircuitFamily | null;
    partition: Partition; sourceEvent: string | null; text: string;
}
export interface CircuitAdmission { role: string; teamId: string; notes: CircuitNote[]; assets: CircuitAsset[]; snapshotHash: string }
export interface CircuitPart {
    id: string; phase: 'qualifying' | 'race' | 'solo' | 'cooperative' | 'relay' | 'campaign' | 'show' | 'performance' | 'research';
    teamIds: string[]; bindings: Record<string, CircuitBinding>; admissions: CircuitAdmission[];
    shifts: CircuitShift[]; native: FamilyReceipt | WorldReceipt;
}
export interface CircuitEvent {
    schema: 'circuit-event@1'; id: string; seasonHash: string; roundId: string;
    partition: Partition; seedIndex: number; parts: CircuitPart[];
    ending: 'STOPPED' | 'COMPLETE' | 'ERROR'; measures: Record<string, CircuitMeasures>;
    digest: string;
}
export interface ArtifactGrant { id: string; assetId: string; contentHash: string; fromTeam: string; toTeam: string }
export interface ListeningReview { eventId: string; partId: string; text: string }
export interface CircuitSave {
    schema: 'circuit-save@1'; agents: AgentPassport[]; teams: CircuitTeam[]; seasons: CircuitSeason[];
    events: CircuitEvent[]; notes: CircuitNote[]; grants: ArtifactGrant[];
    operators: CircuitAsset[]; reviews: ListeningReview[];
}
export interface CircuitBatch {
    schema: 'circuit-batch@1'; season: CircuitSeason; trials: CircuitEvent[]; digest: string;
}
export const formatFamily: Record<CircuitFormat, CircuitFamily> = {
    'race-league': 'auto-circuit', 'cache-rally': 'cache-quest', 'town-relay': 'town-zero',
    research: 'web-scout', 'stunt-festival': 'stunt-show', 'original-performance': 'ensemble-lab', 'local-show': 'stream-studio',
};
export const familyMetrics: Record<CircuitFamily, CircuitMetric[]> = {
    'auto-circuit': ['racing', 'coordination', 'recovery'], 'cache-quest': ['navigation', 'coordination', 'recovery'],
    'town-zero': ['resources', 'coordination', 'recovery'], 'web-scout': ['research', 'coordination'],
    'stunt-show': ['creative', 'coordination', 'recovery'], 'ensemble-lab': ['creative', 'coordination'],
    'stream-studio': ['creative', 'research', 'coordination'],
};
export const familyOfNative = (part: CircuitPart): CircuitFamily => part.native.schema === 'world-episode@1' ? 'town-zero' : part.native.config.family;
export const nativeTicks = (part: CircuitPart) => part.native.schema === 'world-episode@1' ? part.native.result.tick : part.native.result.ticks;
export type NativeFamily = FamilyId;
