// Local players: several people can share one device, each with their own identity (stats,
// Boss Badges, streak, Collection, equipped badge and title). Credits and shop purchases stay
// shared on the device. The first player keeps the original save keys, so nothing moves;
// every other player's data lives under the same keys with a "#slot" suffix.
import { storage, STORAGE_KEYS, type StorageKey } from './storage';

export interface LocalPlayer {
    slot: number;
    /** As typed (uppercase is how the game shows it). */
    name: string;
    lastPlayed?: number;
}

interface PlayerDirectory {
    current: number;
    players: LocalPlayer[];
}

/** Names match regardless of case and surrounding spaces ("dad" is "DAD"). */
export const sameName = (a: string, b: string) => a.trim().toUpperCase() === b.trim().toUpperCase();

const loadDirectory = (): PlayerDirectory => {
    const saved = storage.getJSON<PlayerDirectory | null>(STORAGE_KEYS.players, null);
    if (saved && Array.isArray(saved.players) && saved.players.length) return saved;
    // First time: the device's existing data belongs to whoever last typed their name.
    const name = (storage.getString(STORAGE_KEYS.playerName) ?? '').trim();
    return { current: 0, players: [{ slot: 0, name: name || 'PLAYER' }] };
};

const saveDirectory = (d: PlayerDirectory) => storage.setJSON(STORAGE_KEYS.players, d);

/** Everyone who has played on this device, most recent first. */
export const listPlayers = (): LocalPlayer[] =>
    [...loadDirectory().players].sort((a, b) => (b.lastPlayed ?? 0) - (a.lastPlayed ?? 0));

export const currentPlayer = (): LocalPlayer => {
    const d = loadDirectory();
    return d.players.find(p => p.slot === d.current) ?? d.players[0];
};

/**
 * Makes `name` the current player, creating a profile if it's new. A blank name keeps the current
 * player. Returns the player now in charge.
 */
export const switchToPlayer = (name: string, now = Date.now()): LocalPlayer => {
    const d = loadDirectory();
    const clean = name.trim();
    if (!clean) return currentPlayer();
    let player = d.players.find(p => sameName(p.name, clean));
    if (!player) {
        // The original player may still be the unnamed placeholder: claim it instead of adding one.
        const placeholder = d.players.length === 1 && d.players[0].name === 'PLAYER' && !d.players[0].lastPlayed ? d.players[0] : null;
        player = placeholder ?? { slot: Math.max(...d.players.map(p => p.slot)) + 1, name: clean };
        if (placeholder) placeholder.name = clean; else d.players.push(player);
    }
    player.name = clean;
    player.lastPlayed = now;
    d.current = player.slot;
    saveDirectory(d);
    return player;
};

/** The storage key for the current player's copy of a per-player save. */
export const playerKey = (key: StorageKey): StorageKey => {
    const slot = currentPlayer().slot;
    return (slot === 0 ? key : `${key}#${slot}`) as StorageKey;
};
