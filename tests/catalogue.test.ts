import { describe, expect, it } from 'vitest';
import { readCatalogue } from '../scripts/studio-catalogue.mjs';
import { studio, studioDescription } from '../src/data/studio';
import { games, MISSIONS_PER_WORLD, totalMissions } from '../src/data/games';
import { DIFFICULTIES } from '../src/data/types';
import { evaluateController } from '../src/online/server';
import { workedPolicy } from '../src/runtime/arenaRules';
import { configuration } from '../src/runtime/environment';
import { ruleController } from '../src/runtime/controllers';
import { recordEpisode } from '../src/runtime/receipts';

describe('catalogue and deployed authority consistency', () => {
  it('build-only metadata matches actual manifests, badge totals and version', async () => {
    expect(await readCatalogue()).toEqual(studio); expect(games.every(g => g.missions === MISSIONS_PER_WORLD)).toBe(true);
    expect(totalMissions).toBe(games.length * MISSIONS_PER_WORLD * DIFFICULTIES.length);
    expect(studioDescription).toContain(`${games.length} free game worlds`); expect(studioDescription).not.toContain('Twelve');
  });
  it('server competition hashes identify the same authoritative local run', () => {
    const rules = workedPolicy('space'), round = evaluateController('space', [53], rules).rounds[0], receipt = recordEpisode(configuration('space', 53, 1), ruleController(rules));
    expect(round.environmentVersion).toBe(receipt.config.version); expect(round.receiptHash).toBe(receipt.digest); expect(round.finalHash).toBe(receipt.finalHash); expect(round.score).toBe(receipt.result.score);
  });
});
