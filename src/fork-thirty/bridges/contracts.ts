export type BridgeDirection = 'outbound-proposal' | 'inbound-artifact';

export type BridgeActivation = 'operator-only';

export type BridgeBinding = 'unbound';

export interface BridgeOperationContract {
  operation: string;
  capability: string;
  direction: BridgeDirection;
}

export interface ForkThirtyBridgeContract {
  schema: 'fork-thirty-bridge-contract@1';
  bridgeId: string;
  target: string;
  activation: BridgeActivation;
  binding: BridgeBinding;
  mutationPolicy: 'proposal-only';
  operations: readonly BridgeOperationContract[];
}

export interface BridgeRequest<TPayload = unknown> {
  schema: 'fork-thirty-bridge-request@1';
  requestId: string;
  bridgeId: string;
  agentId: string;
  capability: string;
  operation: string;
  payload: TPayload;
}

export interface BridgeReceipt {
  schema: 'fork-thirty-bridge-receipt@1';
  requestId: string;
  bridgeId: string;
  outcome: 'rejected' | 'accepted' | 'completed' | 'failed';
  artifactRefs: readonly string[];
  note?: string;
}

export function assertBridgeContractsUnique(contracts: readonly ForkThirtyBridgeContract[]): void {
  const ids = new Set<string>();
  for (const contract of contracts) {
    if (ids.has(contract.bridgeId)) throw new Error(`Duplicate bridge contract: ${contract.bridgeId}`);
    ids.add(contract.bridgeId);

    const operations = new Set<string>();
    for (const operation of contract.operations) {
      if (operations.has(operation.operation)) {
        throw new Error(`Duplicate operation for ${contract.bridgeId}: ${operation.operation}`);
      }
      operations.add(operation.operation);
    }
  }
}
