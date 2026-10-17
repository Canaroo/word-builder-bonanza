// @vitest-environment jsdom
// Every PowerPlay and Charm must do something visible when used, without crashing.
import { describe, test, expect, vi } from 'vitest';
import { gameReducer, screenInitialState, type GameScreenState } from '../GameScreen';
import { POWER_PLAYS_LIST } from '../../../data/powerPlays';
import { CHARMS_LIST } from '../../../data/charms';
import * as gameUtils from '../../gameUtils';
import { RACK_SIZE } from '../../../constants';

// These PowerPlays are handled in the GameScreen component (they need hooks or async work),
// not in the reducer; they're checked by reading the code and in the browser.
const COMPONENT_HANDLED = new Set(['withGreatPower', 'carmenSandiego', 'gumpLuck', 'happyPlace', 'warioWarp', 'schruteBucks', 'iceIceMaybe', 'scroogeSwipe', 'sliders']);

const startState = (): GameScreenState => {
    vi.spyOn(Math, 'random').mockReturnValue(0.42);
    const bag = gameUtils.createTileBag();
    const { hand, tileBag } = gameUtils.dealNewHand(bag);
    const padded = Array(RACK_SIZE).fill(null);
    hand.forEach((t, i) => (padded[i] = t));
    const s: GameScreenState = { ...screenInitialState, hand: padded, tileBag, time: 40, isLoading: false };
    return { ...s, gameState: { ...s.gameState, score: 400, strikes: 1, highestScoringWord: { word: 'CAT', score: 30 } as any } };
};

const observableChange = (before: GameScreenState, after: GameScreenState) =>
    after.modalContent !== before.modalContent ||
    after.gameState.log.length !== before.gameState.log.length ||
    after.gameState.activeBuffs.length !== before.gameState.activeBuffs.length ||
    JSON.stringify(after.gameState.activePowerPlays) !== JSON.stringify(before.gameState.activePowerPlays) ||
    after.gameState.score !== before.gameState.score ||
    after.gameState.strikes !== before.gameState.strikes ||
    after.gameState.shuffleCount !== before.gameState.shuffleCount ||
    after.gameState.challengeCount !== before.gameState.challengeCount ||
    after.time !== before.time ||
    after.hand !== before.hand;

describe('PowerPlays', () => {
    // The real flow: pick from an offer (some take effect immediately), then activate from the tray.
    test.each(POWER_PLAYS_LIST.map(p => [p.id, p] as const))('%s does something visible', (id, powerPlay) => {
        const before = startState();
        const offered = { ...before, gameState: { ...before.gameState, powerPlayOffer: [powerPlay] } };
        const chosen = gameReducer(offered, { type: 'CHOOSE_POWER_PLAY', payload: { powerPlay, allOffered: [powerPlay] } });
        const inTray = chosen.gameState.availablePowerPlays.some(p => p.id === id);
        if (!inTray) {
            expect(observableChange(offered, chosen)).toBe(true); // took effect on pick
            return;
        }
        if (COMPONENT_HANDLED.has(id)) return;
        const activated = gameReducer(chosen, { type: 'ACTIVATE_POWER_PLAY', payload: powerPlay });
        expect(observableChange(chosen, activated)).toBe(true);
    });
});

describe('Charms', () => {
    test.each(CHARMS_LIST.map(c => [c.id, c] as const))('%s can be chosen', (_id, charm) => {
        const before = startState();
        const after = gameReducer(before, { type: 'CHOOSE_CHARM', payload: { charm, hand: before.hand, allOffered: [charm] } });
        const activated = after.gameState.activeCharms.some(c => c.id === charm.id)
            || after.gameState.activeBuffs.some(b => b.id === charm.id)
            || after.gameState.availableCharms.some(c => c.id === charm.id)
            || observableChange(before, after);
        expect(activated).toBe(true);
    });
});
