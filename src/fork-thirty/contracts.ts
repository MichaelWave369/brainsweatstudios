export type AuthorityScope = 'world' | 'memory' | 'media' | 'network' | 'operator';

export type AuthoritySource = 'world-rule' | 'operator-grant';

export type AgentMemoryScope = 'episode' | 'world' | 'career';

export type AgentRiskProfile = 'low' | 'guarded' | 'elevated';

export interface AuthorityGrant {
  scope: AuthorityScope;
  actions: readonly string[];
  source: AuthoritySource;
}

export interface AgentManifest {
  schema: 'fork-thirty-agent@1';
  id: string;
  displayName: string;
  role: string;
  summary: string;
  capabilities: readonly string[];
  defaultMemoryScope: AgentMemoryScope;
  preferredWorlds: readonly string[];
  bridgeAffinities: readonly string[];
  riskProfile: AgentRiskProfile;
  authority: readonly AuthorityGrant[];
}

export interface BridgeManifest {
  schema: 'fork-thirty-bridge@1';
  id: string;
  target: string;
  status: 'interface-only' | 'disabled' | 'enabled';
  capabilities: readonly string[];
  authority: readonly AuthorityGrant[];
}

export interface ForkThirtyManifest {
  schema: 'fork-thirty-manifest@1';
  lineage: {
    upstream: string;
    baselineCommit: string;
    baselineVersion: string;
  };
  invariant: 'Agents propose. The world decides.';
  features: Readonly<Record<string, boolean>>;
}

export function canExerciseAuthority(
  subject: Pick<AgentManifest | BridgeManifest, 'authority'>,
  scope: AuthorityScope,
  action: string,
): boolean {
  return subject.authority.some(grant => grant.scope === scope && grant.actions.includes(action));
}

export function assertUniqueIds(items: readonly { id: string }[], label: string): void {
  const ids = new Set<string>();
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate ${label} id: ${item.id}`);
    ids.add(item.id);
  }
}
