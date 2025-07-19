import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

interface WordCheckResult {
    possible: boolean;
    word: string | null;
}

/**
 * Asks Gemini if a valid Scrabble word can be formed from a given set of letter tiles.
 * Uses a structured JSON response for reliability and speed.
 * @param {string[]} letters - An array of single-character strings representing the tiles.
 * @returns {Promise<WordCheckResult>} - An object indicating if a word is possible and what that word is.
 */
async function checkWordPossibility(letters: string[]): Promise<WordCheckResult> {
    if (!letters || letters.length === 0) {
        return { possible: false, word: null };
    }
    
    const prompt = `You are a Scrabble expert. Analyze the following letters: ${letters.join(', ')}.
Determine if a valid, common English Scrabble word of 3 or more letters can be formed using only these letters.
- If a word is possible, provide one such word.
- If no word is possible, indicate that.
Follow the JSON schema precisely. The 'word' should be uppercase. If not possible, the 'word' field should be an empty string.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        possible: {
                            type: Type.BOOLEAN,
                            description: 'Set to true if a word can be formed, otherwise false.'
                        },
                        word: {
                            type: Type.STRING,
                            description: 'If possible, one valid uppercase word. Otherwise, an empty string.'
                        }
                    },
                    required: ['possible', 'word']
                }
            }
        });

        const jsonText = response.text.trim();
        const result: WordCheckResult = JSON.parse(jsonText);
        
        // Sanitize result
        if (result.possible && result.word && /^[A-Z]+$/.test(result.word)) {
            return { possible: true, word: result.word };
        }
        
        return { possible: false, word: null };

    } catch (error) {
        console.error('Error in checkWordPossibility:', error);
        return { possible: false, word: null };
    }
}


/**
 * Asks Gemini for a simple, one-sentence definition of a word.
 * @param {string} word - The word to define.
 * @returns {Promise<string | null>} - A single-sentence definition, or null on error.
 */
async function getDefinition(word: string): Promise<string | null> {
    if (!word || word.trim().length === 0) {
        return null;
    }

    const prompt = `Provide a simple, one-sentence definition for the word: "${word}".
    Return only the definition text. Do not include the word itself or any other leading text.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        
        const text = response.text.trim();

        if (text) {
            return text;
        }
        
        return null;
    } catch (error) {
        console.error(`Error getting definition for "${word}" from Gemini:`, error);
        return null;
    }
}


/**
 * Asks Gemini if a specific word is a valid Scrabble word.
 * @param {string} word - The word to validate.
 * @returns {Promise<boolean>} - True if the word is considered valid, false otherwise.
 */
async function isScrabbleWord(word: string): Promise<boolean> {
    if (!word || word.trim().length < 3) {
        return false;
    }

    const prompt = `You are a Scrabble dictionary referee.
Is the word "${word.toUpperCase()}" a valid, common English Scrabble word?
- It must be a real word found in standard English dictionaries (like Merriam-Webster, Collins).
- It should not be a proper noun, abbreviation, or require punctuation.
Respond using the specified JSON schema.`;

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        isValid: {
                            type: Type.BOOLEAN,
                            description: 'Set to true if the word is a valid Scrabble word, otherwise false.'
                        }
                    },
                    required: ['isValid']
                }
            }
        });

        const jsonText = response.text.trim();
        const result: { isValid: boolean } = JSON.parse(jsonText);
        
        return result.isValid;

    } catch (error) {
        console.error(`Error in isScrabbleWord for "${word}":`, error);
        return false; // Fail safe, assume invalid on error
    }
}


export const geminiService = {
  checkWordPossibility,
  getDefinition,
  isScrabbleWord,
};