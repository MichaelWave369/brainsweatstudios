import { createProvider } from '../agents/registry.ts';
import { createAgentSession } from '../agents/session.ts';
import { worldConfig } from '../runtime/garageWorlds.ts';
import { freshMemory } from '../worlds/receipts.ts';
import { WorldSession } from '../worlds/session.ts';
import { townPack } from '../worlds/townZero.ts';
import { type AgentPassport, type CareerRun, type EvaluationInput } from './types.ts';
import { demand, validateEvaluation, validatePassport } from './validation.ts';
import { sealRun } from './operations.ts';
// All controller proposals pass the existing native validators. This layer
// binds operational identity and admits public inputs; it owns no world state.
export function createCareerSession(passport: AgentPassport, worldId: string, input: EvaluationInput) {
    const agent = validatePassport(passport), evaluation = validateEvaluation(input);
    demand(agent.compatibleWorlds.includes(worldId), 'Agent/world compatibility is absent.');
    if (['town-zero', 'reserve-lesson'].includes(worldId)) {
        const pack = townPack(), spec = pack.worlds.find(w => w.id === worldId)!;
        const actor = spec.roles[0].id;
        const controller = agent.controller.world;
        demand(controller.provider !== 'ollama', 'Connect a local model explicitly in the Agent Garage; the Locker does not auto-connect providers.');
        const session = new WorldSession(pack, worldId, 369, { [actor]: controller });
        if (evaluation.notes.length)
            session.setMemory(actor, { ...freshMemory(), facts: evaluation.notes.map(n => n.text) });
        evaluation.artifacts.forEach(a => session.setPlan(actor, a.content));
        return {
            actor, kind: 'world' as const,
            status: () => session.status, observation: () => session.env.observe(actor), result: () => session.env.result(),
            actions: () => session.env.observe(actor).legalActions.map(a => a.type),
            step: async (action?: string) => { session.resume(); const ok = await session.step(action ? { [actor]: action } : undefined); return !!ok; },
            pause: () => session.pause(), stop: () => session.stop(),
            recordPlan: () => { demand(session.env.result().tick > 0, 'Advance before creating a portable plan.'); session.setPlan(actor, { schema: 'world-plan@1', goal: 'Preserve public reserves.', steps: ['Inspect visible conditions.', 'Choose a legal refill or repair.'], risks: ['Delayed demand can consume reserves.'], fallbacks: ['Wait when no legal operation is useful.'] }); },
            receipt: (): CareerRun => { session.stop(); return sealRun({ agentId: agent.id, actor, worldId, family: 'infrastructure', controller, evaluation, receipt: session.receipt() }); },
        };
    }
    demand(['survey', 'community', 'signal-maze'].includes(worldId), 'This destination has no career adapter.');
    demand(evaluation.condition === 'FRESH', 'V7 career adapters currently require fresh inputs.');
    const config = worldConfig(worldId as 'survey' | 'community' | 'signal-maze');
    const actor = worldId === 'community' ? 'engineer' : 'pilot';
    const controller = agent.controller.garage;
    demand(controller.provider !== 'ollama', 'Connect a local model explicitly in the Agent Garage; the Locker does not auto-connect providers.');
    const session = createAgentSession({ config, controllers: worldId === 'community' ? { engineer: controller, logistics: controller } : { pilot: controller }, providers: controller.provider === 'mock' ? [createProvider('mock')] : [] });
    return {
        actor, kind: 'garage' as const, status: () => ['IDLE', 'WAITING'].includes(session.status) ? 'READY' : session.status, observation: () => session.observation(), result: () => session.result(),
        actions: () => session.observation().legalActions.map(a => a.type),
        step: async (action?: string) => { session.resume(); await session.step(action ? { type: action } : undefined); return !session.lastError; },
        pause: () => session.pause(), stop: () => session.stop(), recordPlan: () => { throw new Error('This destination does not admit world plans.'); },
        receipt: (): CareerRun => { session.pause(); return sealRun({ agentId: agent.id, actor, worldId, family: worldId === 'community' ? 'cooperation' : 'navigation', controller, evaluation, receipt: session.receipt() }); },
    };
}
export type CareerSession = ReturnType<typeof createCareerSession>;
