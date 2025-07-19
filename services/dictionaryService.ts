// A service to validate words using multiple sources.
import { internalWords } from '../data/internalWords';
import { geminiService } from './geminiService';

const FREE_DICTIONARY_API_URL = 'https://api.dictionaryapi.dev/api/v2/entries/en/';
const GOOGLE_SHEET_API_URL = 'https://script.google.com/macros/s/AKfycbyvF5In7tK-cOpLNdZAD2_3XwW9MreoiLja1ycTgtjkTJKIAJvRe9X7q9zQCsB-0rQi/exec';

export interface WordDataResult {
    isValid: boolean;
    definition?: string;
}

/**
 * Validates a word and fetches its definition from various sources.
 * It checks an internal word list first, then the Free Dictionary API, then a Google Sheet.
 * As a final step, if a word is still not found, it uses Gemini to adjudicate.
 * If a word is valid but a definition isn't found, it uses Gemini to generate one.
 * @param {string} word - The word to validate.
 * @returns {Promise<WordDataResult>} - An object containing validity and an optional definition.
 */
async function getWordData(word: string): Promise<WordDataResult> {
    if (!word || word.trim().length === 0) {
        return { isValid: false };
    }
    const wordLower = word.toLowerCase();

    // 1. Primary Check: Internal word list (acts as a cache)
    if (internalWords.has(wordLower)) {
        return { isValid: true, definition: internalWords.get(wordLower) };
    }

    // 2. Secondary Check & Definition Source: Free Dictionary API
    try {
        const response = await fetch(`${FREE_DICTIONARY_API_URL}${wordLower}`);
        if (response.ok) {
            const data = await response.json();
            const definition = data[0]?.meanings[0]?.definitions[0]?.definition;
            if (definition) {
                internalWords.set(wordLower, definition); // Cache result
                return { isValid: true, definition };
            }
            // Word is valid but API didn't provide a clear definition. Ask Gemini for a definition.
            const geminiDef = await geminiService.getDefinition(wordLower);
            internalWords.set(wordLower, geminiDef ?? 'A valid word.');
            return { isValid: true, definition: geminiDef ?? 'A valid word.' };
        }
        if (response.status !== 404) {
            console.warn(`Free Dictionary API returned status ${response.status} for "${wordLower}". Proceeding to next check.`);
        }
    } catch (error) {
        console.error(`Error calling Free Dictionary API for "${wordLower}". Proceeding to next check.`, error);
    }

    // 3. Tertiary Check: Google Sheet API
    try {
        const sheetResponse = await fetch(`${GOOGLE_SHEET_API_URL}?word=${encodeURIComponent(wordLower)}`);
        if (sheetResponse.ok) {
            const data = await sheetResponse.json();
            if (data.valid) {
                // Word is valid per Google Sheet, get definition from Gemini.
                const geminiDef = await geminiService.getDefinition(wordLower);
                internalWords.set(wordLower, geminiDef ?? 'A valid word.');
                return { isValid: true, definition: geminiDef ?? 'A valid word.' };
            }
        } else {
             console.warn(`Google Sheet API returned status ${sheetResponse.status} for "${wordLower}".`);
        }
    } catch (error) {
        console.error(`Error calling Google Sheet API for "${wordLower}". Proceeding to next check.`, error);
    }
    
    // 4. Final Check: Gemini AI Adjudication
    try {
        const isGeminiValid = await geminiService.isScrabbleWord(wordLower);
        if (isGeminiValid) {
            // Word is valid per Gemini, get a definition for the logs.
            const geminiDef = await geminiService.getDefinition(wordLower);
            const definition = geminiDef ?? "A word recognized by our expert AI panel.";
            internalWords.set(wordLower, definition); // Cache the result
            return { isValid: true, definition };
        }
    } catch (error) {
        console.error(`Error during Gemini final validation for "${wordLower}".`, error);
    }


    // All checks failed
    return { isValid: false };
}

/**
 * Validates a word using the multi-source checking of getWordData.
 * @param {string} word - The word to validate.
 * @returns {Promise<boolean>} - True if the word is valid, false otherwise.
 */
async function isValidWord(word: string): Promise<boolean> {
    const result = await getWordData(word);
    return result.isValid;
}


export const dictionaryService = {
  isValidWord,
  getWordData,
};