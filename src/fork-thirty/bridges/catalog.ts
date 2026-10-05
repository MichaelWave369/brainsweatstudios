import type { BridgeManifest } from '../contracts';
import type { BridgeRequest, ForkThirtyBridgeContract } from './contracts';
import { assertBridgeContractsUnique } from './contracts';

const frozen = <T extends string>(values: readonly T[]): readonly T[] => Object.freeze([...values]);

const bridge = (
  id: string,
  target: string,
  capabilities: readonly string[],
): BridgeManifest => Object.freeze({
  schema: 'fork-thirty-bridge@1',
  id,
  target,
  status: 'interface-only',
  capabilities: frozen(capabilities),
  authority: Object.freeze([]),
});

const operation = (operation: string, capability: string, direction: 'outbound-proposal' | 'inbound-artifact') =>
  Object.freeze({ operation, capability, direction });

const contract = (
  bridgeId: string,
  target: string,
  operations: readonly ReturnType<typeof operation>[],
): ForkThirtyBridgeContract => Object.freeze({
  schema: 'fork-thirty-bridge-contract@1',
  bridgeId,
  target,
  activation: 'operator-only',
  binding: 'unbound',
  mutationPolicy: 'proposal-only',
  operations: Object.freeze([...operations]),
});

export const bridgeManifests: readonly BridgeManifest[] = Object.freeze([
  bridge('commonline', 'Commonline', ['voice', 'comms', 'performance']),
  bridge('domistika', 'Domistika', ['visual-assets', 'agent-art']),
  bridge('auralith', 'Auralith', ['media-transform', 'image-pipeline']),
  bridge('infinite-porch', 'Infinite Porch', ['presence', 'transport']),
  bridge('phios', 'PhiOS', ['host-environment', 'governed-launch']),
]);

export const bridgeContracts: readonly ForkThirtyBridgeContract[] = Object.freeze([
  contract('commonline', 'Commonline', [
    operation('voice.plan', 'voice', 'outbound-proposal'),
    operation('comms.compose', 'comms', 'outbound-proposal'),
    operation('performance.cue', 'performance', 'outbound-proposal'),
    operation('artifact.reference', 'performance', 'inbound-artifact'),
  ]),
  contract('domistika', 'Domistika', [
    operation('visual.plan', 'visual-assets', 'outbound-proposal'),
    operation('agent-art.plan', 'agent-art', 'outbound-proposal'),
    operation('artifact.reference', 'visual-assets', 'inbound-artifact'),
  ]),
  contract('auralith', 'Auralith', [
    operation('media.recipe', 'media-transform', 'outbound-proposal'),
    operation('image.recipe', 'image-pipeline', 'outbound-proposal'),
    operation('artifact.reference', 'media-transform', 'inbound-artifact'),
  ]),
  contract('infinite-porch', 'Infinite Porch', [
    operation('presence.announce', 'presence', 'outbound-proposal'),
    operation('transport.propose', 'transport', 'outbound-proposal'),
    operation('presence.reference', 'presence', 'inbound-artifact'),
  ]),
  contract('phios', 'PhiOS', [
    operation('launch.propose', 'governed-launch', 'outbound-proposal'),
    operation('host.describe', 'host-environment', 'outbound-proposal'),
    operation('capability.reference', 'host-environment', 'inbound-artifact'),
  ]),
]);

assertBridgeContractsUnique(bridgeContracts);

export function createBridgeRequest<TPayload>(
  request: Omit<BridgeRequest<TPayload>, 'schema'>,
): BridgeRequest<TPayload> {
  const contract = bridgeContracts.find(item => item.bridgeId === request.bridgeId);
  if (!contract) throw new Error(`Unknown bridge: ${request.bridgeId}`);

  const declared = contract.operations.some(
    item => item.operation === request.operation && item.capability === request.capability,
  );
  if (!declared) {
    throw new Error(
      `Operation ${request.operation} is not declared for capability ${request.capability} on ${request.bridgeId}`,
    );
  }

  return Object.freeze({
    schema: 'fork-thirty-bridge-request@1',
    ...request,
  });
}
