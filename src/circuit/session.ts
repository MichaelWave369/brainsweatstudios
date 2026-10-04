import type { ProviderAdapter } from '../agents/contracts.ts';
import { clone, hash } from '../runtime/data.ts';
import { demand } from '../career/validation.ts';
import { FamilySession } from '../families/session.ts';
import { WorldSession } from '../worlds/session.ts';
import { freshMemory } from '../worlds/receipts.ts';
import { validateCircuit, sealEvent } from './evidence.ts';
import { admittedInputs, controllerFor, eventId, familyInputs, partCount, planPart, roleAgent, type PartPlan } from './plans.ts';
import { measuredParts } from './scoring.ts';
import type { CircuitAdmission, CircuitEvent, CircuitPart, CircuitSave, CircuitSeason, CircuitShift, SeasonRound } from './types.ts';
export class CircuitSession {
    readonly source: CircuitSave; readonly season: CircuitSeason; readonly round: SeasonRound; readonly id: string;
    readonly completed: CircuitPart[] = []; status: 'READY' | 'REQUESTING' | 'STOPPED' | 'PAUSED' | 'COMPLETE' | 'ERROR' = 'STOPPED'; error = '';
    private current: { plan: PartPlan; admissions: CircuitAdmission[]; shifts: CircuitShift[]; session: FamilySession | WorldSession } | null = null;
    private generation = 0; private busy = false;
    constructor(input: unknown, seasonId: string, roundId: string, readonly partition: CircuitEvent['partition'] = 'CAREER', readonly seedIndex = 0, private adapters: Record<string, ProviderAdapter> = {}) {
        this.source = validateCircuit(input);
        const season = this.source.seasons.find(s => s.spec.id === seasonId); demand(season, 'Choose a retained season.'); this.season = season;
        const round = season.spec.rounds.find(r => r.id === roundId); demand(round, 'Choose a declared round.'); this.round = round; this.id = eventId(season, round, partition, seedIndex);
        const saved = this.source.events.find(e => e.id === this.id);
        if (saved) for (const part of saved.parts) {
            if (part.native.result.terminal) this.completed.push(part);
            else {
                const plan = planPart(season, round, partition, seedIndex, this.completed);
                this.current = { plan, admissions: part.admissions, shifts: [...part.shifts], session: part.native.schema === 'family-episode@1' ? FamilySession.restore(part.native, adapters) : WorldSession.restore(part.native, this.worldAdapters(plan)) };
            }
        }
        const roundIndex = season.spec.rounds.indexOf(round);
        demand(season.spec.rounds.slice(0, roundIndex).every(r => this.source.events.some(e => e.seasonHash === season.digest && e.roundId === r.id && e.partition === partition && e.seedIndex === seedIndex && e.ending === 'COMPLETE')), 'Finish the earlier declared rounds first.');
        demand((season.spec.mode === 'CAREER') === (partition === 'CAREER'), 'Choose the season partition.');
        if (!this.current && this.completed.length < partCount(season, round)) this.prepare();
    }
    private worldAdapters(plan: PartPlan) { return Object.fromEntries(Object.entries(plan.bindings).flatMap(([role, b]) => { const c = controllerFor(this.season, b.agentId, role, this.round.memory), adapter = this.adapters[c.provider]; return adapter ? [[role, adapter]] : []; })); }
    private prepare() {
        const plan = planPart(this.season, this.round, this.partition, this.seedIndex, this.completed), admissions = admittedInputs(this.source, this.season, this.round, this.partition, this.id, this.completed, plan);
        const controllers = Object.fromEntries(Object.entries(plan.bindings).map(([role, b]) => [role, controllerFor(this.season, b.agentId, role, this.round.memory)]));
        demand(Object.values(controllers).every(c => c.provider !== 'ollama' || this.adapters.ollama?.id === 'ollama'), 'Connect a local provider explicitly; Circuit does not install or contact models.');
        let session: FamilySession | WorldSession;
        if (plan.pack) {
            const world = new WorldSession(plan.pack, 'town-zero', plan.seed, controllers, this.worldAdapters(plan));
            for (const a of admissions) {
                if (a.notes.length || a.assets.length) world.setMemory(a.role, { ...freshMemory(), facts: a.notes.map(n => n.text), plans: a.assets.flatMap(s => [(s.content as { goal: string }).goal]).slice(0, 6) });
                a.assets.forEach(s => world.setPlan(a.role, s.content));
            }
            session = world;
        } else session = new FamilySession(plan.config!, controllers, familyInputs(admissions), this.adapters);
        this.current = { plan, admissions, shifts: [], session }; session.stop();
    }
    pause() { this.generation++; this.current?.session.pause(); this.status = 'PAUSED'; }
    stop() { this.pause(); this.status = 'STOPPED'; }
    resume() { demand(!this.busy, 'Wait for the pending Circuit turn.'); this.status = this.completed.length === partCount(this.season, this.round) ? 'COMPLETE' : 'READY'; this.error = ''; }
    private shiftedAgent(role: string) {
        const c = this.current!; if (!(c.session instanceof WorldSession)) return c.plan.bindings[role].agentId;
        const team = this.season.teams.find(t => t.id === c.plan.bindings[role].teamId)!;
        return roleAgent(team, role, Object.keys(c.plan.bindings).indexOf(role), Math.floor(c.session.env.result().tick / this.round.shiftTicks));
    }
    humanRoles(): { role: string; agentId: string; legal: string[] }[] {
        if (!this.current) return [];
        const c = this.current, world = c.session instanceof WorldSession ? c.session : null;
        const roles = world && world.env.world.spec.turnMode === 'ordered' ? [world.env.actors[world.env.snapshot().turn].id] : Object.keys(c.plan.bindings);
        return roles.flatMap(role => { const agentId = this.shiftedAgent(role), controller = controllerFor(this.season, agentId, role, this.round.memory); if (controller.family !== 'human') return []; const legal = world ? world.env.observe(role).legalActions.map(a => a.type) : (c.session as FamilySession).env.observe(role).legal; return [{ role, agentId, legal: [...legal] }]; });
    }
    observation() { if (!this.current) return null; const role = Object.keys(this.current.plan.bindings)[0]; return { phase: this.current.plan.phase, role, teamIds: this.current.plan.teamIds, view: this.current.session.env.observe(role), result: this.current.session.env.result() }; }
    async step(human: Record<string, string> = {}): Promise<boolean> {
        demand(!this.busy && this.status === 'READY', 'Resume and settle the previous Circuit turn before advancing.');
        if (!this.current) { if (this.completed.length === partCount(this.season, this.round)) { this.status = 'COMPLETE'; return false; } this.prepare(); }
        const c = this.current!, generation = this.generation;
        this.busy = true; this.status = 'REQUESTING';
        try {
            if (c.session instanceof WorldSession) {
                const tick = c.session.env.result().tick;
                if (tick > 0 && tick % this.round.shiftTicks === 0) for (const role of Object.keys(c.plan.bindings)) {
                    const agentId = this.shiftedAgent(role), controller = controllerFor(this.season, agentId, role, this.round.memory);
                    if (c.session.recorder.controller(role).id !== controller.id) { c.session.handoff(role, controller, `Circuit shift: ${agentId}`, this.adapters[controller.provider]); c.shifts.push({ index: c.session.recorder.records.length, tick, role, agentId, controller }); }
                }
            }
            c.session.resume();
            const advanced = await c.session.step(human);
            if (generation !== this.generation) return false;
            if (!advanced && !c.session.env.result().terminal) { this.status = 'ERROR'; this.error = c.session.error || 'A Circuit proposal was rejected.'; return false; }
            if (c.session.env.result().terminal) { this.completed.push(this.currentPart()); this.current = null; }
            this.status = this.completed.length === partCount(this.season, this.round) ? 'COMPLETE' : 'READY';
            return !!advanced;
        } catch (e) { if (generation === this.generation) { this.status = 'ERROR'; this.error = e instanceof Error ? e.message : 'Circuit turn rejected.'; } return false; }
        finally { this.busy = false; }
    }
    private currentPart(): CircuitPart { const c = this.current!; return { id: c.plan.id, phase: c.plan.phase, teamIds: c.plan.teamIds, bindings: c.plan.bindings, admissions: c.admissions, shifts: clone(c.shifts), native: c.session.receipt() }; }
    receipt(): CircuitEvent {
        const parts = this.current ? [...this.completed, this.currentPart()] : [...this.completed], complete = parts.length === partCount(this.season, this.round) && parts.every(p => p.native.result.terminal);
        const base: Omit<CircuitEvent, 'digest'> = { schema: 'circuit-event@1', id: this.id, seasonHash: this.season.digest, roundId: this.round.id, partition: this.partition, seedIndex: this.seedIndex, parts, ending: complete ? 'COMPLETE' : this.status === 'ERROR' ? 'ERROR' : 'STOPPED', measures: measuredParts(parts, this.season, this.round.metrics) };
        return sealEvent(base, this.season, this.source);
    }
    fingerprint() { return hash(this.receipt()); }
}
