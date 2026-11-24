// Single place for everything the game saves on the device.
// Bump STORAGE_VERSION and add a step to MIGRATIONS whenever a saved shape changes.

export const STORAGE_KEYS = {
    version: 'wordNerdStorageVersion',
    playerName: 'playerName',
    lexCoins: 'wordBuilderLexCoins',
    unlockedPacks: 'wordBuilderUnlockedPacks',
    selectedPack: 'wordBuilderSelectedPack',
    savedGame: 'wordBuilderBonanzaSave',
    /** The daily run's own save slot, so a regular run can't wipe an unfinished daily attempt. */
    savedDailyGame: 'wordNerdDailySave',
    /** v7.67.5: which open copy of the game owns each save slot (only the newest copy saves). */
    savedGameOwner: 'wordBuilderBonanzaSaveOwner',
    savedDailyGameOwner: 'wordNerdDailySaveOwner',
    /** Per player: the day of their scored daily run and how it went (services/daily.ts). */
    dailyRecord: 'wordNerdDailyRecord',
    savedLogs: 'wordBuilderBonanzaSavedLogs',
    missedWords: 'wordBuilderMissedWords',
    powerWord: 'wordBuilderPowerWord',
    definitionCache: 'wordBuilderBonanzaCache',
    leaderboard: 'wordNerdLeaderboard',
    lastSubmittedScore: 'wordNerdLastSubmittedScore',
    personalBest: 'wordNerdPersonalBest',
    bonusCollection: 'wordNerdBonusCollection',
    profile: 'wordNerdProfile',
    missions: 'wordNerdMissions',
    statsMissionsDay: 'wordNerdStatsMissionsDay',
    players: 'wordNerdPlayers',
    career: 'wordNerdCareer',
    charmUpgradeTips: 'wordNerdCharmUpgradeTips',
    gatePasswordsSeen: 'wordNerdGatePasswordsSeen',
    /** Per player: how many times the Skill Shot intro card has been shown (it shows twice). */
    skillShotTips: 'wordNerdSkillShotTips',
    gemTips: 'wordNerdGemTips',
    /** Per player: the game day the Play button last offered the Daily Challenge (it asks once a day). */
    dailyChooserDay: 'wordNerdDailyChooserDay',
    musicOwned: 'wordNerdMusicOwned',
    musicTrack: 'wordNerdMusicTrack',
    eventMusic: 'wordNerdEventMusic',
    shopNewsSeen: 'wordNerdShopNewsSeen',
    /** Per player: ids of bones (other players' fallen runs) they've taken a charm from. */
    bonesLooted: 'wordNerdBonesLooted',
    /** Per player: each boss's record against them, for Grudge Matches (services/grudges.ts). */
    grudges: 'wordNerdGrudges',
    /** Per player: early run endings in a row, for the Head Start (services/headStart.ts). */
    headStart: 'wordNerdHeadStart',
} as const;

export type StorageKey = typeof STORAGE_KEYS[keyof typeof STORAGE_KEYS];

export const STORAGE_VERSION = 1;

// MIGRATIONS[n] upgrades saved data from version n to n + 1.
const MIGRATIONS: Record<number, () => void> = {};

const getString = (key: StorageKey): string | null => {
    try {
        return localStorage.getItem(key);
    } catch {
        return null;
    }
};

const setString = (key: StorageKey, value: string): boolean => {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (e) {
        // Usually the storage quota; the game keeps running without saving.
        console.error(`Failed to save "${key}"`, e);
        return false;
    }
};

const getJSON = <T>(key: StorageKey, fallback: T): T => {
    const raw = getString(key);
    if (raw === null) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch (e) {
        console.error(`Saved "${key}" is corrupted, discarding it.`, e);
        remove(key);
        return fallback;
    }
};

const setJSON = (key: StorageKey, value: unknown): boolean => setString(key, JSON.stringify(value));

const remove = (key: StorageKey) => {
    try {
        localStorage.removeItem(key);
    } catch { /* storage unavailable */ }
};

/** Runs any pending migrations. Call once before the app renders. */
const init = () => {
    let version = Number(getString(STORAGE_KEYS.version) ?? STORAGE_VERSION);
    while (version < STORAGE_VERSION) {
        MIGRATIONS[version]?.();
        version++;
    }
    setString(STORAGE_KEYS.version, String(STORAGE_VERSION));
};

export const storage = { getString, setString, getJSON, setJSON, remove, init };
