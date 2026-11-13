// The upgrade picker shows each charm's own numbers before and after (v7.36).
import { describe, test, expect } from 'vitest';
import { charmUpgradePreview } from '../rules';
import { CHARMS_LIST, UPGRADABLE_CHARM_IDS } from '../../data/charms';
import { CHARM_UPGRADE } from '../../config/gameplay';

const up = (n: number) => Math.round(n * (100 + CHARM_UPGRADE.percent) / 100);

describe('charmUpgradePreview', () => {
  test('point values, before and after', () => {
    expect(charmUpgradePreview('Words that reuse 2 or more letters earn +40 points.')).toEqual([{ from: 40, to: up(40) }]);
    expect(charmUpgradePreview('+60 points. A palindrome earns +400 instead.')).toEqual([{ from: 60, to: up(60) }, { from: 400, to: up(400) }]);
  });

  test('leaves out time, percentages and penalties', () => {
    expect(charmUpgradePreview('+300 points and +10 seconds.')).toEqual([{ from: 300, to: up(300) }]);
    expect(charmUpgradePreview('Words score +50%.')).toBeNull();
    expect(charmUpgradePreview('25% chance for +100, 10% chance for -25.')).toEqual([{ from: 100, to: up(100) }]);
  });

  test('most upgradable charms show real numbers', () => {
    const upgradable = CHARMS_LIST.filter(c => UPGRADABLE_CHARM_IDS.has(c.id));
    const withNumbers = upgradable.filter(c => charmUpgradePreview(c.description));
    expect(withNumbers.length / upgradable.length).toBeGreaterThan(0.9);
  });
});
