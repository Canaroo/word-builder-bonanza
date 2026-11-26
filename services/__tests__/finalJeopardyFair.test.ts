// v7.92.0 (the owner's rule): Final Jeopardy only plays a category the final hand can actually make,
// and a miss always has a real word to show.
import { describe, test, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { FINAL_CATEGORIES, finalCategoryFor, finalCategorySolution } from '../rules';
import { canBeMadeFromLetters } from '../rackMatch';
import { createTileBag, dealNewHand } from '../gameUtils';

const common = readFileSync('public/words/common.txt', 'utf8').split(/\s+/).filter(w => w.length >= 3).map(w => w.toUpperCase());
const wordsFor = (letters: string[]) => common.filter(w => canBeMadeFromLetters(w, letters));

describe('Final Jeopardy categories fit the hand', () => {
  test('keeps the dealt category when a word fits it, else picks one that fits', () => {
    expect(finalCategoryFor('five', ['STONE', 'TON'])).toBe('five');
    expect(finalCategoryFor('six', ['STONE', 'TON'], () => 0)).not.toBe('six');
    const picked = finalCategoryFor('six', ['STONE', 'TON'], () => 0);
    expect(['STONE', 'TON'].some(w => FINAL_CATEGORIES[picked].test(w))).toBe(true);
    expect(finalCategoryFor('six', [])).toBe('none');
  });
  test('the solution is the longest word that fits', () => {
    expect(finalCategorySolution('stStart', ['TO', 'STONE', 'TON'])).toBe('STONE');
    expect(finalCategorySolution('none', ['STONE'])).toBeNull();
  });
  test('500 real final hands: every played category has a word from those tiles', { timeout: 60000 }, () => {
    let kept = 0, swapped = 0, none = 0;
    const ids = Object.keys(FINAL_CATEGORIES);
    for (let i = 0; i < 500; i++) {
      const { hand } = dealNewHand(createTileBag());
      const letters = hand.map(t => t.letter);
      const words = wordsFor(letters);
      const dealt = ids[i % ids.length];
      const cat = finalCategoryFor(dealt, words);
      if (cat === 'none') { none++; continue; }
      if (cat === dealt) kept++; else swapped++;
      const sol = finalCategorySolution(cat, words)!;
      expect(sol, `${letters.join('')} ${cat}`).toBeTruthy();
      expect(canBeMadeFromLetters(sol, letters)).toBe(true);
      expect(FINAL_CATEGORIES[cat].test(sol)).toBe(true);
    }
    console.log(`kept ${kept}, swapped ${swapped}, no category ${none} of 500`);
  });
});
