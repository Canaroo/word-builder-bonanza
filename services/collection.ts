// The current player's Bonus Collection: every secret bonus they've found, across runs.
import { SECRET_BONUSES } from '../data/secretBonuses';
import type { SecretBonus } from '../types';
import { storage, STORAGE_KEYS } from './storage';
import { playerKey } from './players';

export interface CollectedBonus {
    /** When it was first found (ms since epoch). */
    firstFoundAt: number;
    timesFound: number;
}

type Collection = Record<string, CollectedBonus>;

const isEntry = (v: unknown): v is CollectedBonus =>
    !!v && typeof v === 'object' && typeof (v as CollectedBonus).firstFoundAt === 'number' && typeof (v as CollectedBonus).timesFound === 'number';

const KNOWN_IDS = new Set(SECRET_BONUSES.map(b => b.id));

/** Found bonuses that still exist in data/secretBonuses.ts. */
export const getCollection = (): Collection => {
    const saved = storage.getJSON<unknown>(playerKey(STORAGE_KEYS.bonusCollection), {});
    if (!saved || typeof saved !== 'object') return {};
    return Object.fromEntries(
        Object.entries(saved as Record<string, unknown>).filter(([id, v]) => KNOWN_IDS.has(id) && isEntry(v))
    ) as Collection;
};

/** Marks a bonus as found. Returns true the first time it's ever found on this device. */
export const recordFound = (id: string, now = Date.now()): boolean => {
    if (!KNOWN_IDS.has(id)) return false;
    const collection = getCollection();
    const existing = collection[id];
    collection[id] = existing
        ? { ...existing, timesFound: existing.timesFound + 1 }
        : { firstFoundAt: now, timesFound: 1 };
    storage.setJSON(playerKey(STORAGE_KEYS.bonusCollection), collection);
    return !existing;
};

export const collectionProgress = () => {
    const collection = getCollection();
    return { found: Object.keys(collection).length, total: SECRET_BONUSES.length };
};

/** The clue shown for a bonus that hasn't been found yet. */
export const hintFor = (b: SecretBonus): string => {
    if (b.hint?.trim()) return b.hint.trim();
    if (b.score) {
        const { kind, digits } = b.score;
        if (kind === 'equals') return `Land on one exact ${digits.length}-digit score.`;
        if (kind === 'endsWith') return `A score ending in a certain ${digits.length}-digit number.`;
        if (kind === 'over') return `Push your score past a certain ${digits.length}-digit number.`;
        return `A score containing a certain ${digits.length}-digit number.`;
    }
    const word = b.word ?? '';
    return b.source ? `A ${word.length}-letter word from ${b.source}.` : `A ${word.length}-letter word starting with ${word[0]?.toUpperCase()}.`;
};
