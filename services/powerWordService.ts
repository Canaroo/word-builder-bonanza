import { PowerWordData } from '../types';
import { curatedWords } from './curatedWords';

import { storage, STORAGE_KEYS } from './storage';

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

const canSpin = (): boolean => {
    const data = getPowerWordData();
    if (!data) {
        return true; // Never spun before
    }
    const nextSpinTime = getNextSpinTime(data.spinTimestamp);
    return Date.now() >= nextSpinTime.getTime();
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
    return Array.from(curatedWords.entries()).filter(([word]) => word.length === 4);
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
