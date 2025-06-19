
import { GoogleGenAI, GenerateContentResponse, GroundingMetadata } from "@google/genai";
import { DictionaryEntry } from './types';

const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  console.warn("API_KEY environment variable not set. Gemini API calls will fail.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY || "MISSING_API_KEY" });
const geminiTextModel = 'gemini-2.5-flash-preview-04-17';

export async function validateWordWithApi(word: string): Promise<DictionaryEntry[]> {
  const response = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Word not found: '${word}' is not a valid English word.`);
    }
    throw new Error(`Dictionary API error: ${response.statusText}`);
  }
  return response.json() as Promise<DictionaryEntry[]>;
}

export async function getKidFriendlyDefinition(word: string, originalDefinition: string): Promise<string> {
  if (!API_KEY) return `Definition: ${originalDefinition.split(';')[0]}. (Gemini API key not configured)`;
  try {
    const prompt = `You are a fun dictionary for kids. Explain the word '${word}' to a 10-year-old. Make your explanation one simple, fun sentence. For context, the technical definition is: "${originalDefinition}" Return only the explanation.`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: geminiTextModel,
        contents: prompt,
    });

    const text = response.text;
    if (text) {
      return text.trim();
    }
    throw new Error("AI response format invalid or empty.");
  } catch (error) {
    console.error("Error getting kid-friendly definition from Gemini:", error);
    return `Definition: ${originalDefinition.split(';')[0]}. (AI definition failed)`;
  }
}

export async function getAIHint(availableLetters: string): Promise<string | null> {
  if (!API_KEY) {
    console.warn("Gemini API key not configured. Hint feature disabled.");
    return null; 
  }
  try {
    const prompt = `From the letters "${availableLetters}", find one valid English word that is at least 3 letters long. Return only the single word in uppercase, nothing else. If no word can be formed, return "NOWORD".`;
    
    const response: GenerateContentResponse = await ai.models.generateContent({
        model: geminiTextModel,
        contents: prompt,
        config: {
          temperature: 0.7, // Slightly creative for hints
        }
    });
    
    const text = response.text;
    if (text && text.trim() !== "NOWORD") {
      return text.trim().toUpperCase();
    }
    return null;
  } catch (error) {
    console.error("Error getting hint from Gemini:", error);
    return null;
  }
}

// Example function for search grounding (if needed for other features)
export async function getRecentInfo(query: string): Promise<{text: string, metadata?: GroundingMetadata}> {
  if (!API_KEY) return {text: "Search feature disabled (API key missing).", metadata: { groundingChunks: [] }};
  try {
    const response: GenerateContentResponse = await ai.models.generateContent({
      model: geminiTextModel,
      contents: query,
      config: {
        tools: [{googleSearch: {}}],
      }
    });
    return {text: response.text, metadata: response.candidates?.[0]?.groundingMetadata};
  } catch (error) {
    console.error("Error with Gemini search grounding:", error);
    return {text: "Could not retrieve information at this time.", metadata: { groundingChunks: [] }};
  }
}
