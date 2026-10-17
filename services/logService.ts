import { FinalGameState } from '../types';

import { storage, STORAGE_KEYS } from './storage';

const SAVED_LOGS_KEY = STORAGE_KEYS.savedLogs;
// Each run stores its full word log; endless runs make these large, so keep the count modest.
const MAX_LOGS = 25;

const getSavedLogs = (): FinalGameState[] => {
    try {
        const logsJson = storage.getString(SAVED_LOGS_KEY);
        // Sort by save timestamp, newest first
        const logs: FinalGameState[] = logsJson ? JSON.parse(logsJson) : [];
        return logs.sort((a, b) => new Date(b.saveTimestamp!).getTime() - new Date(a.saveTimestamp!).getTime());
    } catch (e) {
        console.error('Failed to parse saved logs:', e);
        return [];
    }
};

const autoSaveLog = (logToSave: FinalGameState): { success: boolean, message: string } => {
    let savedLogs = getSavedLogs();
    
    // FIFO logic: drop the oldest unpinned logs so there's room for this one under the cap.
    const unpinnedLogs = savedLogs.filter(log => !log.isPinned);
    const excess = unpinnedLogs.length - (MAX_LOGS - 1);
    if (excess > 0) {
        unpinnedLogs.sort((a, b) => new Date(a.saveTimestamp!).getTime() - new Date(b.saveTimestamp!).getTime());
        const dropped = new Set(unpinnedLogs.slice(0, excess).map(log => log.saveTimestamp));
        savedLogs = savedLogs.filter(log => !dropped.has(log.saveTimestamp));
    }
    
    const newLogWithMetadata: FinalGameState = { 
        ...logToSave, 
        saveTimestamp: new Date().toISOString(),
        isPinned: false, // Default to not pinned
        isViewed: false, // Default to not viewed
    };
    
    const newLogs = [...savedLogs, newLogWithMetadata];
    
    try {
        storage.setJSON(SAVED_LOGS_KEY, newLogs);
        return { success: true, message: 'Run auto-saved!' };
    } catch (e) {
        console.error('Failed to save log:', e);
        return { success: false, message: 'Failed to save run.' };
    }
};

const deleteLog = (logTimestamp: string): { success: boolean } => {
    let savedLogs = getSavedLogs();
    const newLogs = savedLogs.filter(log => log.saveTimestamp !== logTimestamp);
    
    if (newLogs.length === savedLogs.length) {
        return { success: false };
    }

    try {
        storage.setJSON(SAVED_LOGS_KEY, newLogs);
        return { success: true };
    } catch (e) {
        console.error('Failed to delete log:', e);
        return { success: false };
    }
};

const togglePinLog = (logTimestamp: string): { success: boolean } => {
    const savedLogs = getSavedLogs();
    const newLogs = savedLogs.map(log => {
        if (log.saveTimestamp === logTimestamp) {
            return { ...log, isPinned: !log.isPinned };
        }
        return log;
    });

    try {
        storage.setJSON(SAVED_LOGS_KEY, newLogs);
        return { success: true };
    } catch (e) {
        console.error('Failed to pin log:', e);
        return { success: false };
    }
};

const markLogAsViewed = (logTimestamp: string): { success: boolean } => {
    const savedLogs = getSavedLogs();
    let wasChanged = false;
    const newLogs = savedLogs.map(log => {
        if (log.saveTimestamp === logTimestamp && !log.isViewed) {
            wasChanged = true;
            return { ...log, isViewed: true };
        }
        return log;
    });

    if (!wasChanged) return { success: true }; // No change needed

    try {
        storage.setJSON(SAVED_LOGS_KEY, newLogs);
        return { success: true };
    } catch (e) {
        console.error('Failed to mark log as viewed:', e);
        return { success: false };
    }
};

export const logService = {
    getSavedLogs,
    autoSaveLog,
    deleteLog,
    togglePinLog,
    markLogAsViewed,
    MAX_LOGS
};