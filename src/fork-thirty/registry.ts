import type { AgentManifest, BridgeManifest, ForkThirtyManifest } from './contracts';
import { cast } from './cast';
import { assertUniqueIds } from './contracts';

export const forkThirty: ForkThirtyManifest = Object.freeze({
  schema: 'fork-thirty-manifest@1',
  lineage: Object.freeze({
    upstream: 'larrinamsalva/brainsweatstudios',
    baselineCommit: '91c697a06d74c328d7425b63bd55e32932340788',
    baselineVersion: '12.0.0',
  }),
  invariant: 'Agents propose. The world decides.',
  features: Object.freeze({
    castRuntime: false,
    bridgeRuntime: false,
    persistentServices: false,
    localModelRuntime: false,
    societyLayer: false,
  }),
});

export const agents: readonly AgentManifest[] = cast;

export const bridges: readonly BridgeManifest[] = Object.freeze([
  Object.freeze({
    schema: 'fork-thirty-bridge@1',
    id: 'commonline',
    target: 'Commonline',
    status: 'interface-only',
    capabilities: Object.freeze(['voice', 'comms', 'performance']),
    authority: Object.freeze([]),
  }),
  Object.freeze({
    schema: 'fork-thirty-bridge@1',
    id: 'domistika',
    target: 'Domistika',
    status: 'interface-only',
    capabilities: Object.freeze(['visual-assets', 'agent-art']),
    authority: Object.freeze([]),
  }),
  Object.freeze({
    schema: 'fork-thirty-bridge@1',
    id: 'auralith',
    target: 'Auralith',
    status: 'interface-only',
    capabilities: Object.freeze(['media-transform', 'image-pipeline']),
    authority: Object.freeze([]),
  }),
  Object.freeze({
    schema: 'fork-thirty-bridge@1',
    id: 'infinite-porch',
    target: 'Infinite Porch',
    status: 'interface-only',
    capabilities: Object.freeze(['presence', 'transport']),
    authority: Object.freeze([]),
  }),
  Object.freeze({
    schema: 'fork-thirty-bridge@1',
    id: 'phios',
    target: 'PhiOS',
    status: 'interface-only',
    capabilities: Object.freeze(['host-environment', 'governed-launch']),
    authority: Object.freeze([]),
  }),
]);

assertUniqueIds(agents, 'agent');
assertUniqueIds(bridges, 'bridge');
