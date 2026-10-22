import { PowerWordData } from '../types';
import { suggestableWords } from './curatedWords';

import { storage, STORAGE_KEYS } from './storage';
import { dayKey } from './progression';

const POWER_WORD_KEY = STORAGE_KEYS.powerWord;

const getPowerWordData = (): PowerWordData | null => {
    try {
        const dataJson = storage.getString(POWER_WORD_KEY);
        return dataJson ? JSON.parse(dataJson) : null;
    } catch (e) {
        console.error("Failed to parse Power Word data from localStorage", e);
        return null;
    }
};

const setPowerWordData = (powerWord: string, definition: string): PowerWordData => {
    const data: PowerWordData = {
        powerWord,
        definition,
        spinTimestamp: Date.now(),
    };
    storage.setJSON(POWER_WORD_KEY, data);
    return data;
};

const getNextSpinTime = (timestamp: number): Date => {
    const lastSpinDate = new Date(timestamp);
    const nextSpinDate = new Date(lastSpinDate);

    // Set to 8 AM on the day of the spin
    nextSpinDate.setHours(8, 0, 0, 0);

    // If the spin was after 8 AM today, the next spin is tomorrow at 8 AM.
    // If the spin was before 8 AM today, the next spin is today at 8 AM.
    if (lastSpinDate.getHours() >= 8) {
        nextSpinDate.setDate(nextSpinDate.getDate() + 1);
    }
    
    return nextSpinDate;
}

/** True when the last spin was before today's 8 AM reset (same day boundary as missions and streaks). */
const canSpin = (now: Date = new Date()): boolean => {
    const data = getPowerWordData();
    if (!data || typeof data.spinTimestamp !== 'number') {
        return true; // Never spun before
    }
    return dayKey(new Date(data.spinTimestamp)) !== dayKey(now);
};

const getCooldownMessage = (): string => {
    const data = getPowerWordData();
    if (!data || canSpin()) {
        return "Spin for your daily Power Word!";
    }
    const nextSpinTime = getNextSpinTime(data.spinTimestamp);
    
    const now = new Date();
    const isToday = nextSpinTime.getDate() === now.getDate() && nextSpinTime.getMonth() === now.getMonth() && nextSpinTime.getFullYear() === now.getFullYear();

    const timeString = nextSpinTime.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

    if(isToday) {
         return `Come back after ${timeString} today to spin again.`;
    }

    return `Come back after ${timeString} tomorrow to spin again.`;
};


const getEligiblePowerWords = (): [string, string][] => {
    return Array.from(suggestableWords.entries()).filter(([word]) => word.length === 4);
};

const spin = (): PowerWordData | null => {
    if (!canSpin()) {
        return null;
    }
    const eligibleWords = getEligiblePowerWords();
    if (eligibleWords.length === 0) {
        console.error("No 4-letter words found in the dictionary for Power Word spin.");
        return null;
    }
    const [word, definition] = eligibleWords[Math.floor(Math.random() * eligibleWords.length)];
    return setPowerWordData(word, definition);
};


export const powerWordService = {
    getPowerWordData,
    setPowerWordData,
    canSpin,
    getCooldownMessage,
    spin,
};
