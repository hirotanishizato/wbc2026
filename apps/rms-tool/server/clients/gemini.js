/**
 * Gemini client wrapper.
 *
 * Uses @google/genai. The tenant may store its own GEMINI_API_KEY; if
 * not set the platform default from env is used. Tenant-specific keys
 * are useful when each shop wants its own billing.
 */
import { GoogleGenAI } from "@google/genai";
import { config } from "../config.js";

function makeClient(apiKey) {
  return new GoogleGenAI({ apiKey });
}

export async function generateText({ apiKey, prompt, system, model }) {
  const key = apiKey || config.gemini.apiKey;
  if (!key) {
    throw new Error(
      "No Gemini API key configured. Set GEMINI_API_KEY on the platform or on the tenant.",
    );
  }
  const client = makeClient(key);
  const useModel = model || config.gemini.model;
  const res = await client.models.generateContent({
    model: useModel,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: system ? { systemInstruction: system } : undefined,
  });
  const text =
    res.text ??
    res.response?.text?.() ??
    res.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") ??
    "";
  return { text, model: useModel };
}
