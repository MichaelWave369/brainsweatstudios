import { clone, exact, freeze, hash, integer, plain } from '../runtime/data.ts';
import { assertData } from '../worlds/compiler.ts';
import { demand, digest, identifier } from '../career/validation.ts';
import { localProgram } from './presentation.ts';
import { CIRCUIT_FAMILIES, type CircuitEvent, type CircuitPart } from './types.ts';
import { circuitText } from './specs.ts';
export type { PerformanceBus } from '../performance/bus.ts';
export type { ProviderAdapter as AgentEnvironmentPort } from '../agents/contracts.ts';
const KINDS = ['VisualAssetBus', 'VoiceBus', 'MediaBus'] as const;
export interface CircuitPortData {
    schema: 'circuit-port-data@1'; kind: typeof KINDS[number]; syntheticOnly: true;
    eventId: string; nativeDigest: string; publicProgram: ReturnType<typeof localProgram>; digest: string;
}
export interface PresentationBus {
    id: string; kind: CircuitPortData['kind'];
    prepare(packet: CircuitPortData, signal: AbortSignal): Promise<{ accepted: true; packetHash: string }>;
    stop(): void;
}
export type VisualAssetBus = PresentationBus & { kind: 'VisualAssetBus' };
export type VoiceBus = PresentationBus & { kind: 'VoiceBus' };
export type MediaBus = PresentationBus & { kind: 'MediaBus' };
export function validatePortData(value: unknown): CircuitPortData {
    assertData(value, 130000, 25000, 24);
    demand(plain(value) && exact(value, ['schema', 'kind', 'syntheticOnly', 'eventId', 'nativeDigest', 'publicProgram', 'digest']) && value.schema === 'circuit-port-data@1' && KINDS.includes(value.kind as never) && value.syntheticOnly === true && identifier(value.eventId) && digest(value.nativeDigest) && digest(value.digest) && plain(value.publicProgram) && exact(value.publicProgram, ['schema', 'mode', 'eventId', 'sourceDigest', 'family', 'cameraRole', 'index', 'caption', 'commentary', 'publicView', 'result', 'attribution', 'inputSnapshots']) && value.publicProgram.schema === 'circuit-program@1' && value.publicProgram.eventId === value.eventId && value.publicProgram.sourceDigest === value.nativeDigest, 'Invalid bounded synthetic Circuit port data.');
    const p = value.publicProgram;
    demand(p.mode === 'local simulated broadcast' && CIRCUIT_FAMILIES.includes(p.family as never) && identifier(p.cameraRole) && integer(p.index, 0, 100000) && circuitText(p.caption, 240) && Array.isArray(p.commentary) && p.commentary.length > 0 && p.commentary.length <= 3 && p.commentary.every(v => circuitText(v, 200)) && plain(p.publicView) && plain(p.result) && plain(p.attribution) && exact(p.attribution, ['teamId', 'agentId']) && identifier(p.attribution.teamId) && identifier(p.attribution.agentId) && Array.isArray(p.inputSnapshots) && p.inputSnapshots.length <= 8 && p.inputSnapshots.every(digest), 'Invalid Circuit public presentation fields.');
    const { digest: proof, ...base } = value; demand(hash(base) === proof, 'Circuit port packet digest differs.'); return freeze(clone(value)) as unknown as CircuitPortData;
}
export function portData(kind: CircuitPortData['kind'], event: CircuitEvent, part: CircuitPart, index: number) {
    const base = { schema: 'circuit-port-data@1' as const, kind, syntheticOnly: true as const, eventId: event.id, nativeDigest: part.native.digest, publicProgram: localProgram(event, part, index) };
    return validatePortData({ ...base, digest: hash(base) });
}
export async function prepareCircuitPort(bus: PresentationBus, input: unknown, signal: AbortSignal) {
    const data = validatePortData(input); demand(bus.kind === data.kind && identifier(bus.id) && !signal.aborted, 'Circuit presentation port is unavailable.');
    try { const result = await bus.prepare(data, signal); demand(!signal.aborted && result.accepted === true && result.packetHash === hash(data), 'Circuit port acknowledgement differs.'); return result; }
    catch (error) { bus.stop(); throw error; }
}
