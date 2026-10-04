import type { ControllerSpec } from '../agents/contracts.ts';
import type { AgentReceipt } from '../agents/session.ts';
import type { WorldController, WorldPlan, WorldReceipt } from '../worlds/receipts.ts';
import type { FamilyArtifactType, FamilyContent, FamilyReceipt } from '../families/types.ts';
export const CAREER_LIMITS = { bytes: 1350000, agents: 8, runs: 8, notes: 12, artifacts: 24, handoffs: 16 } as const;
export type Partition = 'CAREER' | 'TRAIN' | 'HOLDOUT' | 'TRANSFER';
export type MemoryCondition = 'FRESH' | 'FROZEN' | 'PRIOR';
export interface PublicNote {
    id: string;
    scope: 'EPISODE' | 'WORLD' | 'CAREER';
    worldId: string | null;
    episode: string | null;
    sourceRun: string | null;
    partition: Partition;
    text: string;
}
export interface AgentPassport {
    schema: 'agent-passport@1';
    id: string;
    displayName: string;
    createdLocally: boolean;
    controller: {
        world: WorldController;
        garage: ControllerSpec;
    };
    publicCapabilities: ('public-notes' | 'world-plan' | 'family-artifacts')[];
    compatibleWorlds: string[];
    memoryMode: 'PUBLIC_SCOPED';
    inventory: string[];
    performanceEvidence: string[];
    teams: string[];
    roleHistory: {
        runId: string;
        worldId: string;
        role: string;
    }[];
    licenses: [
    ];
    vehicleRef: string | null;
    voiceRef: null;
    mediaRefs: string[];
}
export interface EvaluationInput {
    mode: 'CAREER' | 'BENCHMARK';
    partition: Partition;
    condition: MemoryCondition;
    episode: string;
    notes: PublicNote[];
    artifacts: PortableArtifact[];
    snapshotHash: string;
}
export interface CareerRun {
    schema: 'career-run@1';
    agentId: string;
    actor: string;
    worldId: string;
    family: 'infrastructure' | 'navigation' | 'cooperation' | 'arena' | 'racing' | 'performance' | 'research' | 'media' | 'music';
    controller: WorldController | ControllerSpec;
    evaluation: EvaluationInput;
    receipt: WorldReceipt | AgentReceipt | FamilyReceipt;
    digest: string;
}
interface ArtifactEnvelope {
    schema: 'career-artifact@1';
    id: string;
    version: '1.0.0';
    creator: string;
    creationRun: string;
    contentHash: string;
    compatibleWorlds: string[];
    bytes: number;
}
export type PortableArtifact = ArtifactEnvelope & ({type:'world-plan';content:WorldPlan}|{type:FamilyArtifactType;content:FamilyContent});
export interface WorldHandoffRecord {
    schema: 'career-handoff@1';
    agentId: string;
    source: string;
    destination: string;
    memory: string[];
    accepted: string[];
    rejected: {
        id: string;
        reason: string;
    }[];
    acceptedCapabilities: string[];
    rejectedCapabilities: string[];
    input: EvaluationInput;
    snapshotHash: string;
}
export interface CareerSave {
    schema: 'agent-locker@1';
    agents: AgentPassport[];
    notes: Record<string, PublicNote[]>;
    runs: CareerRun[];
    artifacts: PortableArtifact[];
    handoffs: WorldHandoffRecord[];
}
