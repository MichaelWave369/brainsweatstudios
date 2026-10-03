import { isAdvanced } from '../games/advanced/models';
import type { Difficulty, GameId } from '../data/types';
import { difficultyIndex } from '../data/types';
export interface BotStep { label: string; kind: 'click' | 'input' | 'select' | 'check' | 'nth' | 'water'; match?: string; selector?: string; value?: string; index?: number; optional?: boolean }
const click = (match: string, optional = false): BotStep => ({ kind: 'click', match, label: match.replace(/^\^|\$$/g, '').replace(/\\(.)/g, '$1').split('|').join(' / '), optional });
const nth = (selector: string, index: number): BotStep => ({ kind: 'nth', selector, index, label: 'Inspect the next available option' });
const input = (selector: string, value: number): BotStep => ({ kind: 'input', selector, value: String(value), label: `Set the model control to ${value}` });
const select = (selector: string, value: string): BotStep => ({ kind: 'select', selector, value, label: 'Choose the planned option' });
export async function botPlan(game: GameId, difficulty: Difficulty, mission: number): Promise<BotStep[]> {
  if (isAdvanced(game)) return (await import('../games/advanced/botPlans')).advancedBotPlan(game, difficulty, mission);
  const d = difficultyIndex(difficulty); const m = mission % 5; const steps: BotStep[] = [];
  if (game === 'money') return [click('Start the month'), ...Array.from({ length: 4 }, () => click('Find another way'))];
  if (game === 'hustle') return [click('Open for business'), ...Array.from({ length: 5 }, () => click('Run this business day|Finish the workweek|Close today and regroup'))];
  if (game === 'scam') {
    const { messages } = await import('../games/ScamShield'); const count = [6, 7, 8][d];
    for (let n = 0; n < count; n++) { const message = messages[(m * 3 + n * 2 + d) % messages.length]; for (const clue of message.clues) steps.push(click(`^${clue}$`)); steps.push(click({ safe: 'Safe in this context', suspicious: 'Suspicious Stop', verify: 'Verify independently Use' }[message.bucket]), click(n === count - 1 ? 'Close the case' : 'Next inbox message')); }
    return steps;
  }
  if (game === 'media') { for (let n = 0; n < 3; n++) steps.push(nth('.source-card', n), click('^Pin to evidence board$')); return [...steps, click(`^${['Misleading', 'Misleading', 'Unproven', 'Supported', 'Misleading'][m]}$`)]; }
  if (game === 'fix') return [click(['^Loose leg joint$', '^Available wall space$', '^Low virtual pressure gauge$', '^Damaged cord insulation$', '^Gap beside the frame$'][m]), input('input[type=number]', [120, 120, 20, 20, 230][m]), click('Check measurement'), click(['^Hex key$', '^Tape measure$', '^Simulated pump$', '^Trusted adult / professional$', '^Model weather strip$'][m]), click('Check approach'), input('input[type=range]', [50, 62, 45, 100, 55][m]), click(m === 3 ? 'Confirm safe handoff' : 'Run the model test')];
  if (game === 'code') return [...Array.from({ length: [4, 5, 6][d] }, () => click('^Add right command$')), ...Array.from({ length: [4, 5, 6][d] }, () => click('^Add up command$')), click('^Run program$')];
  if (game === 'career') {
    const labels = m === 2 ? ['Kept a small plant-watering checklist.', 'Worked with a group to set up chairs.', 'Arrived on time for a volunteer event.'] : m === 4 ? ['Helped organize a club supply shelf.', 'Kept a small plant-watering checklist.', 'Explained a game calmly to a new player.'] : ['Helped organize a club supply shelf.', 'Arrived on time for a volunteer event.', 'Explained a game calmly to a new player.'];
    return [...labels.map(match => ({ kind: 'check' as const, match, label: 'Select an honest relevant experience' })), click('Plan availability'), ...['Monday', 'Wednesday', 'Saturday'].map(match => ({ kind: 'check' as const, match, label: 'Choose an available shift' })), click('Meet the manager'), click('I’m new to paid work'), click('Continue interview'), click('Tell the lead'), click('Finish application')];
  }
  if (game === 'food') return [...['Oats & whole-grain bread', 'Dry / canned beans', 'Frozen mixed vegetables', 'Apples & oranges'].map(food => click(`^Add ${food}$`)), click('Plan the menus'), ...Array.from({ length: 3 }, (_, i) => select(`#menu-${i}`, '0')), click('Store the groceries'), select('#store-veg', 'freezer'), click('Test my three-day plan')];
  if (game === 'admin') { for (let i = 0; i < 7; i++) steps.push({ ...select('.task-row select', String(i + 1)), index: i }); steps.push(click('Launch my week')); for (let day = 1; day <= 8; day++) { for (let slot = 0; slot < 3; slot++) steps.push(click('^Do now$', true)); steps.push(click(day === 8 ? 'Review my week' : 'Advance to next day')); } return steps; }
  if (game === 'talk') return [click('A collaborative plan Ask'), click('Pause and check their perspective'), ...Array.from({ length: 3 }, (_, i) => [nth('.dialogue-choices button', 0), click(i === 2 ? 'Reflect on the conversation' : 'Continue the story')]).flat()];
  if (game === 'power') return [click('Wind turbine · \\$24'), click('Wind turbine · \\$24'), click('Solar panel · \\$18'), click('Solar panel · \\$18'), ...Array.from({ length: 6 }, (_, i) => click(i === 5 ? 'Run the final hour' : 'Run this weather turn'))];
  if (game === 'rescue') { const water = m === 4; steps.push(click(water ? '^Water station' : '^Help phone'), click(water ? '^Collect Water bottle$' : '^Collect Borrowed phone$')); for (const stop of ['Map desk', 'Covered shelter', 'Crossing', 'Trusted help']) { steps.push(click(`^${stop}`), nth('.dialogue-choices button', 0), click(stop === 'Trusted help' ? 'Complete the rescue plan' : 'Continue exploring')); if (stop === 'Map desk') steps.push(click('^Collect Route map$')); } return steps; }
  if (game === 'music') return [click('Load a starting pattern'), click('Perform my phrase'), select('select[aria-label="Pitch step 16"], select[data-source-label="Pitch step 16"]', '2'), click('Perform my phrase'), click('Save my composition')];
  if (game === 'frequency') { const { frequencyTargets } = await import('../games/FrequencyLab'); for (let i = 0; i < 3 + d; i++) steps.push(input('input[type=range]', frequencyTargets[mission] * (i % 2 ? 2 : 1)), click('Test my signal')); return steps; }
  if (game === 'botany') { for (const plant of ['Leafy herb', 'Shade fern', 'Pollinator flower']) steps.push(click(`^Plant ${plant}`)); steps.push(click('Add mulch', true), click('Start the growing week')); for (let day = 0; day < 6; day++) { steps.push(click('Inspect soil')); for (let i = 0; i < 3; i++) steps.push({ kind: 'water', index: i, label: `Adjust water for pot ${i + 1} after inspecting soil` }); steps.push(click(day === 5 ? 'Review my garden' : 'Grow one day')); } return steps; }
  return [];
}
function source(element: Element): string { return (element.getAttribute('data-source-label') || element.getAttribute('data-source-text') || element.textContent || '').replace(/\s+/g, ' ').trim(); }
function enabled(element: Element) { return element instanceof HTMLElement && !element.matches(':disabled') && !!element.getClientRects().length; }
export function applyBotStep(step: BotStep, root: Element): boolean {
  if (step.kind === 'click') { const button = Array.from(root.querySelectorAll('button')).find(b => new RegExp(step.match!).test(source(b)) && enabled(b)); if (!button) return !!step.optional; button.click(); return true; }
  if (step.kind === 'nth') { const element = root.querySelectorAll(step.selector!)[step.index || 0] as HTMLElement | undefined; if (!element || !enabled(element)) return false; element.click(); return true; }
  if (step.kind === 'check') { const label = Array.from(root.querySelectorAll('label')).find(l => source(l).includes(step.match!)); const checkbox = label?.querySelector('input[type=checkbox]') as HTMLInputElement | undefined; if (!checkbox || !enabled(checkbox)) return false; if (!checkbox.checked) checkbox.click(); return true; }
  if (step.kind === 'water') {
    const pot = root.querySelectorAll('.plant-card')[step.index || 0]; if (!pot) return false;
    const moisture = Number((pot.querySelector('p')?.textContent || '').match(/(\d+)%/)?.[1] || 55);
    const light = Number((pot.querySelector('input[type=range]') as HTMLInputElement).value);
    const weather = Array.from(root.querySelectorAll('.notice')).map(source).join(' ').match(/drying weather index (\d+)/); const heat = Number(weather?.[1] || 8);
    const target = Math.max(0, Math.min(2, Math.round((55 - moisture + heat * 0.65 + light * 1.5) / 18)));
    const current = Number(pot.querySelector('output')?.textContent || 0);
    if (current === target) return true;
    const button = pot.querySelectorAll('.counter button')[current < target ? 1 : 0] as HTMLButtonElement; button.click(); return false;
  }
  const element = root.querySelectorAll(step.selector!)[step.index || 0] as HTMLInputElement | HTMLSelectElement | undefined;
  if (!element || !enabled(element)) return false;
  const prototype = element instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')!.set!.call(element, step.value);
  element.dispatchEvent(new Event(element instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  return element.value === step.value;
}
export function fieldBotStep(root: Element): string | null {
  const buttons = Array.from(root.querySelectorAll('button'));
  const button = buttons.find(b => /^(Start with a small reusable plan|Share resources and test a small step|Explain the evidence and agree on a check-in|Continue field mission|Finish field mission)/.test(source(b)) && enabled(b));
  if (!button) return null; const name = source(button); button.click(); return name;
}
