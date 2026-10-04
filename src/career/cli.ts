import { addAgent, evaluationInput, rememberRun } from './operations.ts';
import { createCareerSession } from './session.ts';
import { freshCareer, validateCareer, verifyCareerRun } from './validation.ts';
import { parseJSON } from '../runtime/data.ts';
export async function careerCommand(command: string, args: string[], file: string | null = null) {
    const save = file ? validateCareer(parseJSON(file, 1350000)) : addAgent(freshCareer(), 'studio-agent', 'Studio agent');
    if (command === 'list')
        return save.agents.map(a => ({ id: a.id, name: a.displayName, controller: a.controller.world.family, evidence: a.performanceEvidence.length }));
    if (command === 'show') {
        const agent = save.agents.find(a => a.id === args[0]);
        if (!agent)
            throw new Error('Agent is absent.');
        return agent;
    }
    if (command === 'verify')
        return save.runs.map(r => ({ digest: verifyCareerRun(r).digest, replayed: true }));
    if (command === 'run') {
        const agent = save.agents.find(a => a.id === (args[1] || 'studio-agent'));
        if (!agent)
            throw new Error('Agent is absent.');
        const world = args[0] || 'reserve-lesson';
        const input = evaluationInput(save, agent.id, world, `cli-${save.runs.length + 1}`);
        const session = createCareerSession(agent, world, input);
        let steps = 0;
        while (!session.result().terminal && steps++ < 1000) {
            if (!await session.step())
                throw new Error('Controller halted.');
        }
        const receipt = session.receipt();
        return rememberRun(save, receipt);
    }
    throw new Error('Use list, show, run or verify.');
}
