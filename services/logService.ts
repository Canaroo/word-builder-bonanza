import { FinalGameState } from '../types';

const SAVED_LOGS_KEY = 'wordBuilderBonanzaSavedLogs';
const MAX_LOGS = 100;

const getSavedLogs = (): FinalGameState[] => {
    try {
        const logsJson = localStorage.getItem(SAVED_LOGS_KEY);
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
    
    // FIFO logic: If we are at or over the cap, remove the oldest unpinned log.
    const unpinnedLogs = savedLogs.filter(log => !log.isPinned);
    if (unpinnedLogs.length >= MAX_LOGS) {
        // Sort unpinned logs by date to find the oldest one
        unpinnedLogs.sort((a, b) => new Date(a.saveTimestamp!).getTime() - new Date(b.saveTimestamp!).getTime());
        const oldestLogTimestamp = unpinnedLogs[0].saveTimestamp;
        // Filter the main logs array to remove the oldest unpinned log
        if(oldestLogTimestamp) {
            savedLogs = savedLogs.filter(log => log.saveTimestamp !== oldestLogTimestamp);
        }
    }
    
    const newLogWithMetadata: FinalGameState = { 
        ...logToSave, 
        saveTimestamp: new Date().toISOString(),
        isPinned: false, // Default to not pinned
        isViewed: false, // Default to not viewed
    };
    
    const newLogs = [...savedLogs, newLogWithMetadata];
    
    try {
        localStorage.setItem(SAVED_LOGS_KEY, JSON.stringify(newLogs));
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
        localStorage.setItem(SAVED_LOGS_KEY, JSON.stringify(newLogs));
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
        localStorage.setItem(SAVED_LOGS_KEY, JSON.stringify(newLogs));
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
        localStorage.setItem(SAVED_LOGS_KEY, JSON.stringify(newLogs));
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