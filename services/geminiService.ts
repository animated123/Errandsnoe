import { GoogleGenAI, Type } from "@google/genai";
import { ErrandCategory } from "../types";

class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  }

  async parseErrandDescription(description: string) {
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Parse the following errand description and extract the category, a concise title, and any location mentioned.
      Description: "${description}"
      
      Categories available: ${Object.values(ErrandCategory).join(", ")}`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            category: { type: Type.STRING, description: "The best matching category" },
            title: { type: Type.STRING, description: "A short, catchy title" },
            location: { type: Type.STRING, description: "The destination or pickup location if mentioned" },
            isShopping: { type: Type.BOOLEAN, description: "Whether this is a shopping task" }
          },
          required: ["category", "title"]
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return null;
    }
  }

  async extractReceiptTotal(imageBase64: string) {
    const response = await this.ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { text: "Extract the total amount spent from this receipt. Return ONLY the number." },
        { inlineData: { mimeType: "image/jpeg", data: imageBase64 } }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            total: { type: Type.NUMBER, description: "The total amount on the receipt" }
          },
          required: ["total"]
        }
      }
    });

    try {
      return JSON.parse(response.text);
    } catch (e) {
      console.error("Failed to parse Gemini response", e);
      return null;
    }
  }
}

export const geminiService = new GeminiService();
