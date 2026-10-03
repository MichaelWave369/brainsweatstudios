import { authoredController, qController } from './controllers.ts';
import { configuration } from './environment.ts';
import { hash } from './data.ts';
import { recordEpisode, runHeadless, verifyReceipt } from './receipts.ts';
import { ENVIRONMENTS } from './types.ts';
import { roverFresh, trainRover } from '../training/models.ts';

// No DOM, React mount, browser, network or provider credentials required.
export function runHarness(episodes = 1000) {
  if (!Number.isInteger(episodes) || episodes < 10 || episodes > 10000) throw new Error('Choose 10–10,000 sweep episodes.');
  const started = performance.now(); let steps = 0, successes = 0, replays = 0;
  let learner = roverFresh('storm'); for (let i = 0; i < 40; i++) learner = trainRover(learner, 25);
  const learnedHash = hash(learner), controllers = ENVIRONMENTS.map(id => id === 'rover' ? qController(learner.q) : authoredController(id));
  for (let i = 0; i < episodes; i++) {
    const id = ENVIRONMENTS[i % 5], config = configuration(id, 20000 + i, i % 3, i % 3 === 0 ? 'transfer' : 'standard', id === 'rover' ? 'storm' : 'courier'), controller = controllers[i % 5];
    const a = runHeadless(config, controller), b = runHeadless(config, controller);
    if (a.finalHash !== b.finalHash || hash(a.result) !== hash(b.result)) throw new Error(`Determinism failed for sweep ${i}.`);
    steps += a.result.ticks + b.result.ticks; successes += Number(a.result.success);
    if (i < 15) { const receipt = recordEpisode(config, controller); if (verifyReceipt(receipt).finalHash !== a.finalHash || receipt.steps.length > 120) throw new Error('Replay regression.'); replays++; }
  }
  if (hash(learner) !== learnedHash) throw new Error('Sweep changed the frozen learner.');
  const ms = performance.now() - started;
  return { episodes, steps, successes, verifiedReplays: replays, milliseconds: Math.round(ms), stepsPerSecond: Math.round(steps / (ms / 1000)), runtime: '1.0.0', seedRecipe: '20000 + index; five families, three difficulties, standard/transfer' };
}
