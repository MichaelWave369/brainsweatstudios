import { AGENT_IDS, type ArenaKind, type PolicyRule } from './arenaRules.ts';
import { qController, ruleController, validateQ, validateRules } from './controllers.ts';
import { clone, exact, freeze, hash, integer, plain } from './data.ts';
import { ENVIRONMENT_VERSION, RUNTIME_VERSION, type Controller, type ControllerMetadata, type EnvironmentId } from './types.ts';

type Parameters = { rules: PolicyRule[] } | { q: number[][]; mode: 'courier' | 'storm'; trainingEpisodes: number };
export interface ControllerPackage {
  schema: 'controller@1'; runtime: string; controller: ControllerMetadata;
  compatible: { environment: EnvironmentId; version: string }[];
  parameters: Parameters; digest: string;
}
function seal(controller: Controller, environment: EnvironmentId, parameters: Parameters): ControllerPackage {
  const data = { schema: 'controller@1' as const, runtime: RUNTIME_VERSION, controller: controller.metadata(), compatible: [{ environment, version: ENVIRONMENT_VERSION }], parameters: clone(parameters) };
  return freeze({ ...data, digest: hash(data) });
}
export function packageRules(kind: ArenaKind, rules: PolicyRule[], authored = false): ControllerPackage {
  return seal(ruleController(rules, authored ? 'authored' : 'rules'), kind, { rules: validateRules(rules) });
}
export function packageRover(q: number[][], mode: 'courier' | 'storm', trainingEpisodes: number): ControllerPackage {
  if (!['courier', 'storm'].includes(mode) || !integer(trainingEpisodes, 0, 100000)) throw new Error('Invalid rover package parameters.');
  return seal(qController(q), 'rover', { q: validateQ(q), mode, trainingEpisodes });
}
export function controllerFromPackage(pkg: ControllerPackage): Controller {
  return 'rules' in pkg.parameters ? ruleController(pkg.parameters.rules, pkg.controller.family === 'authored' ? 'authored' : 'rules') : qController(pkg.parameters.q);
}
export function validatePackage(input: unknown, environment?: EnvironmentId): ControllerPackage {
  if (!plain(input) || !exact(input, ['schema', 'runtime', 'controller', 'compatible', 'parameters', 'digest']) || input.schema !== 'controller@1' || input.runtime !== RUNTIME_VERSION || !Array.isArray(input.compatible) || input.compatible.length !== 1 || !plain(input.parameters)) throw new Error('Invalid or incompatible controller package.');
  const entry = input.compatible[0];
  if (!plain(entry) || !exact(entry, ['environment', 'version']) || entry.version !== ENVIRONMENT_VERSION || environment && entry.environment !== environment) throw new Error('Controller does not support this environment/version.');
  const parameters = input.parameters; let controller: Controller;
  if (exact(parameters, ['rules']) && (AGENT_IDS as readonly unknown[]).includes(entry.environment)) {
    if (!plain(input.controller) || !['rules', 'authored'].includes(String(input.controller.family))) throw new Error('Invalid rule controller family.');
    controller = ruleController(validateRules(parameters.rules), input.controller.family === 'authored' ? 'authored' : 'rules');
  } else if (exact(parameters, ['q', 'mode', 'trainingEpisodes']) && entry.environment === 'rover' && ['courier', 'storm'].includes(String(parameters.mode)) && integer(parameters.trainingEpisodes, 0, 100000)) {
    controller = qController(validateQ(parameters.q));
  } else throw new Error('Invalid controller parameters or compatibility.');
  if (hash(input.controller) !== hash(controller.metadata())) throw new Error('Controller policy hash or version differs.');
  const { digest, ...data } = input;
  if (digest !== hash(data)) throw new Error('Controller package integrity hash differs.');
  return freeze(clone(input)) as unknown as ControllerPackage;
}
// Preserve the legacy data-only policy file for arenas/online duels.
export function importController(input: unknown, environment: EnvironmentId): ControllerPackage {
  if (plain(input) && exact(input, ['version', 'kind', 'rules']) && input.version === 1 && input.kind === environment && (AGENT_IDS as readonly string[]).includes(environment)) return packageRules(environment as ArenaKind, validateRules(input.rules));
  return validatePackage(input, environment);
}
