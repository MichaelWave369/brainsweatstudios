import { clone, freeze, hash } from '../runtime/data.ts';
import type { CircuitAsset, CircuitBinding, CircuitEvent, CircuitPart } from './types.ts';
export function bindingAt(part: CircuitPart, actor: string, index = 0): CircuitBinding {
    const initial = part.bindings[actor], shift = part.shifts.filter(s => s.role === actor && s.index <= index).at(-1);
    return shift ? { teamId: initial.teamId, agentId: shift.agentId } : initial;
}
export function partAssets(eventId: string, partition: CircuitEvent['partition'], part: CircuitPart): CircuitAsset[] {
    const outputs = part.native.schema === 'family-episode@1' ? part.native.outputs.map(o => ({ actor: o.actor, index: 0, type: o.type, content: o.content, contentHash: o.contentHash })) : part.native.artifacts.filter(a => a.kind === 'plan').map(a => ({ actor: a.actor, index: a.index, type: 'world-plan' as const, content: a.value, contentHash: hash(a.value) }));
    return outputs.map(o => {
        const b = bindingAt(part, o.actor, o.index);
        return { schema: 'circuit-asset@1', id: `asset-${hash({ native: part.native.digest, actor: o.actor, type: o.type, hash: o.contentHash }).slice(0, 24)}`, teamId: b.teamId, creator: b.agentId, type: o.type, content: clone(o.content), contentHash: o.contentHash, origin: 'NATIVE', sourceEvent: eventId, sourcePart: part.id, sourceDigest: part.native.digest, partition } as CircuitAsset;
    });
}
const assetsByEvent = new WeakMap<CircuitEvent, CircuitAsset[]>();
export function eventAssets(event: CircuitEvent): CircuitAsset[] {
    const immutable = Object.isFrozen(event) && Object.isFrozen(event.parts) && event.parts.every(p => Object.isFrozen(p) && Object.isFrozen(p.native));
    const cached = immutable && assetsByEvent.get(event); if (cached) return cached;
    const assets = event.parts.flatMap(p => partAssets(event.id, event.partition, p));
    if (immutable) { freeze(assets); assetsByEvent.set(event, assets); } return assets;
}
