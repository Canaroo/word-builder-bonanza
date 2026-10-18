// @vitest-environment jsdom
// Every pop-up type must render with the data the game really sends it. A crash here would
// blank the whole screen in the game (this is how an `info` pop-up once took the game down).
import { describe, test, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { GameScreenView, type GameScreenViewProps, type ModalContent } from '../GameScreenView';
import { screenInitialState } from '../GameScreen';
import { MILESTONES_LIST } from '../../../data/milestones';
import { EASTER_EGGS } from '../../../data/easterEggs';
import { POWER_PLAYS_LIST } from '../../../data/powerPlays';
import { CHARMS_LIST } from '../../../data/charms';
import { WORD_BONUSES } from '../../../data/wordBonuses';

const noop = () => {};
const baseProps = (modalContent: ModalContent): GameScreenViewProps => ({
    ...(screenInitialState as any),
    gameState: { ...screenInitialState.gameState, activeCharms: CHARMS_LIST.slice(0, 5), availablePowerPlays: [POWER_PLAYS_LIST[0]] },
    time: 40,
    hand: Array(10).fill(null),
    buildRow: Array(8).fill(null),
    isPaused: false,
    isLoading: false,
    modalContent,
    tilesToSwap: [],
    tileToTransform: null,
    wordFromBuildRow: '',
    totalWords: 0,
    potentialScore: 0,
    maxStrikes: 3,
    challengeButtonText: 'Challenge',
    tileClass: 'tile-arcade',
    isMuted: false,
    isChallengeLock: false,
    highlightedTileIds: { first: null, rest: [] },
    isStrikeChallenge: false,
    strikesRemaining: 3,
    dispatch: noop,
    ...new Proxy({}, { get: () => noop }) as any,
} as GameScreenViewProps);

// Fill in every handler the view might call.
const props = (modalContent: ModalContent): GameScreenViewProps => {
    const p = baseProps(modalContent) as any;
    for (const key of Object.keys(p)) if (key.startsWith('handle') || key === 'showBuffInfo') p[key] = noop;
    ['handleMuteToggle', 'handleCloseModal', 'handleShowMilestoneInfo', 'handleShowEventLog', 'handleMoveToBuild', 'handleReturnToHand',
     'handleShuffle', 'handleSubmit', 'handleClear', 'handleChallenge', 'handleSaveClick', 'handleConfirmSave', 'showBuffInfo',
     'handleActivatePowerPlay', 'handleActivateCharm', 'handleChoosePowerPlay', 'handleChooseCharm', 'handlePassCharm', 'handleKeepPowerPlay',
     'handleAddTileToSwap', 'handleRemoveTileFromSwap', 'handleExecuteSwap'].forEach(k => { p[k] = noop; });
    return p;
};

const cases: [string, ModalContent][] = [
    ['info (Golden Round)', { type: 'info', title: '🌟 GOLDEN ROUND! 🌟', content: 'Your streak has unlocked a Golden Round!' }],
    ['info (auto-close, no data)', { type: 'info', title: '⛓️ PERFECT 4-CHAIN! ⛓️', content: '444!', autoClose: 4000 }],
    ['milestone', { type: 'milestone', title: MILESTONES_LIST[0].name, content: MILESTONES_LIST[0].flavorText, data: MILESTONES_LIST[0] }],
    ['milestone without data', { type: 'milestone', title: 'Milestone', content: 'x' }],
    ['word-bonus', { type: 'word-bonus', title: WORD_BONUSES[0].title, content: WORD_BONUSES[0].description, data: WORD_BONUSES[0] }],
    ['easter-egg', { type: 'easter-egg', title: EASTER_EGGS[0].name, content: '', data: { ...EASTER_EGGS[0], triggerScore: 169 } }],
    ['powerplay-selection', { type: 'powerplay-selection', title: 'PowerPlay Earned!', content: 'Meter full', data: POWER_PLAYS_LIST.slice(1, 4) }],
    ['charm-selection', { type: 'charm-selection', title: 'Charm Earned!', content: '10 words', data: CHARMS_LIST.slice(6, 9) }],
    ['buff-info', { type: 'buff-info', title: 'Buff', data: CHARMS_LIST[0] }],
    ['super-hand', { type: 'super-hand', title: '✨ SUPER HAND! ✨', content: 'Snap', data: { points: 50, gauntletBonus: 150 } }],
    ['save-confirmation', { type: 'save-confirmation', title: 'Save' }],
    ['charm-activation (Shapeshifter)', { type: 'charm-activation', title: 'Activate', data: POWER_PLAYS_LIST.find(p => p.id === 'shapeshiftersTongue') }],
    ['milestone-info', { type: 'milestone-info', title: 'Milestone', data: MILESTONES_LIST[1] }],
];

describe('every pop-up renders', () => {
    test.each(cases)('%s', (_name, modal) => {
        expect(() => renderToString(<GameScreenView {...props(modal)} />)).not.toThrow();
    });

    test('a plain game screen renders (no pop-up)', () => {
        expect(renderToString(<GameScreenView {...props(null)} />)).toContain('Active Buffs');
    });
});

describe('pick-a-tile pop-ups show what you picked', () => {
    const E = { id: 't-e', letter: 'E', points: 1 } as any;
    const A = { id: 't-a', letter: 'A', points: 1 } as any;
    const hookshot = { type: 'powerplay-activation', title: 'Activate: Hookshot', data: POWER_PLAYS_LIST.find(p => p.id === 'hookshot') } as ModalContent;
    const render = (picked: any) => renderToString(
        <GameScreenView {...props(hookshot)} hand={[A, E, ...Array(8).fill(null)]} tileForSelection={picked} />,
    );

    test('nothing picked: Confirm is off and asks for a tile', () => {
        const html = render(null);
        expect(html).toContain('Tap a tile to pick it');
        expect(html).not.toContain('aria-pressed="true"');
    });

    test('picking E marks that tile and names it on the button', () => {
        const html = render({ tile: E, originalIndex: 1 });
        expect(html).toContain('Confirm: E');
        expect(html.match(/aria-pressed="true"/g)).toHaveLength(1);
    });
});

describe('pick-a-letter pop-ups wait for Confirm', () => {
    test('Letter Upgrade shows the A-Z grid with Confirm off until a letter is picked', () => {
        const modal = { type: 'powerplay-activation', title: 'Activate: Letter Upgrade', data: POWER_PLAYS_LIST.find(p => p.id === 'letterUpgrade') } as ModalContent;
        const html = renderToString(<GameScreenView {...props(modal)} />);
        expect(html).toContain('Tap a letter to pick it');
        expect(html.match(/aria-pressed="false"/g)).toHaveLength(26);
    });
});
